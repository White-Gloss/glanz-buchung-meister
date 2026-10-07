#!/usr/bin/env node
import { qaBase, controlBase, qaPort, controlPort, tlsPort } from "./ports.mjs";
import { assertIsolatedGithubCi } from "../hosting-policy.mjs";
assertIsolatedGithubCi();
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, closeSync, openSync } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputRoot = resolve(projectRoot, ".qa-output");
const base = qaBase;
const identityUrl = controlBase + "/identity";
const runId = randomUUID();
const abort = new AbortController();
const children = [];
const reservations = [];
const summary = {
  runId,
  startedAt: new Date().toISOString(),
  status: "running",
  checks: [],
};
let signalExitCode;

function interrupt(signal) {
  signalExitCode = signal === "SIGINT" ? 130 : 143;
  process.exitCode = signalExitCode;
  summary.status = "failed";
  summary.error = `QA interrupted by ${signal}`;
  abort.abort(new Error(`QA interrupted by ${signal}`));
}
const onInterrupt = () => interrupt("SIGINT");
const onTerminate = () => interrupt("SIGTERM");
process.once("SIGINT", onInterrupt);
process.once("SIGTERM", onTerminate);

function log(message) {
  console.log(message);
  appendFileSync(resolve(outputRoot, "runner.log"), `${message}\n`);
}

async function reservePort(port) {
  const server = createServer();
  await new Promise((accept, reject) => {
    server.once("error", (error) =>
      reject(
        new Error(
          `Port ${port} is unavailable; refusing to reuse an existing server (${error.code}).`,
        ),
      ),
    );
    server.listen({ port, host: "127.0.0.1", exclusive: true }, accept);
  });
  reservations.push(server);
}

async function releasePorts() {
  while (reservations.length) {
    const server = reservations.pop();
    await new Promise((accept, reject) =>
      server.close((error) => (error ? reject(error) : accept())),
    );
  }
}

function startNode(name, args, command = process.execPath) {
  abort.signal.throwIfAborted();
  const descriptor = openSync(resolve(outputRoot, `${name}.log`), "w");
  let child;
  try {
    child = spawn(command, args, {
      cwd: projectRoot,
      env: { ...process.env, QA_RUN_ID: runId, FRONTEND_BASE_URL: base },
      windowsHide: true,
      // Linux CI only: npm exec and its Node child share an owned process group.
      detached: true,
      stdio: ["ignore", descriptor, descriptor],
    });
  } finally {
    closeSync(descriptor);
  }
  const record = { name, child, closed: false, stopped: false, error: null };
  record.done = new Promise((accept) => {
    child.once("error", (error) => {
      record.error = error;
    });
    child.once("close", (code, signal) => {
      record.closed = true;
      accept({ code, signal, error: record.error });
    });
  });
  children.push(record);
  return record;
}

function requireRunning(record) {
  if (
    record.closed ||
    record.error ||
    record.child.exitCode !== null ||
    record.child.signalCode !== null
  ) {
    throw new Error(`${record.name} exited unexpectedly; see .qa-output/${record.name}.log.`);
  }
}

async function waitForReady(server) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    abort.signal.throwIfAborted();
    requireRunning(server);
    let identity;
    try {
      identity = await fetch(identityUrl, {
        redirect: "error",
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(2_000)]),
      });
    } catch {
      await delay(200, undefined, { signal: abort.signal });
      continue;
    }
    // A matching JSON body alone could belong to an older isolated process.
    assert.equal(
      identity.headers.get("x-qa-run-id"),
      runId,
      "The identity endpoint does not belong to this QA run.",
    );
    assert.equal(identity.status, 200, "The isolated identity endpoint is not healthy.");
    assert.deepEqual(await identity.json(), {
      isolated: true,
      database: "in-memory-pglite",
      externalFetch: "blocked",
    });
    try {
      const response = await fetch(base, {
        redirect: "error",
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(2_000)]),
      });
      const html = await response.text();
      if (
        response.ok &&
        response.headers.get("content-type")?.includes("text/html") &&
        html.includes("<main")
      ) {
        requireRunning(server);
        return;
      }
    } catch {
      // The identity listener starts before the production application is ready.
    }
    await delay(200, undefined, { signal: abort.signal });
  }
  throw new Error(
    "The isolated server was not ready within 60 seconds; see .qa-output/isolated-server.log.",
  );
}

async function runCheck(server, name, args, timeoutMs = 120_000, command = process.execPath) {
  requireRunning(server);
  log(`QA: ${name}`);
  const check = startNode(name, args, command);
  const stageAbort = new AbortController();
  try {
    try {
      const result = await Promise.race([
        check.done,
        server.done.then(() => {
          throw new Error("The isolated server stopped during a check.");
        }),
        delay(timeoutMs, undefined, {
          signal: AbortSignal.any([abort.signal, stageAbort.signal]),
        }).then(() => {
          throw new Error(`${name} exceeded its ${timeoutMs / 1000}-second deadline.`);
        }),
      ]);
      if (result.error || result.code !== 0) {
        throw new Error(
          `${name} failed (${result.error?.message ?? result.signal ?? result.code}); see .qa-output/${name}.log.`,
        );
      }
    } finally {
      stageAbort.abort();
      // A timed-out npm wrapper must not leave its audit alongside the next check.
      await stopChild(check);
    }
    summary.checks.push({ name, passed: true });
    log(`QA: ${name} passed`);
  } catch (error) {
    summary.checks.push({ name, passed: false, error: error.message });
    throw error;
  }
}

function signalOwnedGroup(record, signal) {
  try {
    process.kill(-record.child.pid, signal);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

async function waitForOwnedGroupExit(record) {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline && signalOwnedGroup(record, 0)) {
    await delay(50);
  }
  return !signalOwnedGroup(record, 0);
}

async function stopChild(record) {
  if (!record.child.pid || record.stopped) return;
  if (signalOwnedGroup(record, "SIGTERM") && !await waitForOwnedGroupExit(record)) {
    signalOwnedGroup(record, "SIGKILL");
    if (!await waitForOwnedGroupExit(record)) {
      throw new Error(`Could not stop owned group ${record.name} (PID ${record.child.pid}).`);
    }
  }
  await Promise.race([record.done, delay(3_000, undefined, { ref: false })]);
  if (!record.closed)
    throw new Error(`Could not stop owned child ${record.name} (PID ${record.child.pid}).`);
  record.stopped = true;
}

await mkdir(outputRoot, { recursive: true });
await writeFile(resolve(outputRoot, "runner.log"), "");
try {
  await access(resolve(projectRoot, ".output/server/index.mjs"));
  for (const port of [qaPort, controlPort, tlsPort]) await reservePort(port);
  await releasePorts();
  log("QA: starting a fresh isolated production server");
  const server = startNode("isolated-server", ["scripts/qa/isolated-server.mjs"]);
  await waitForReady(server);
  await runCheck(server, "frontend-ssr", ["--test", "scripts/frontend-ssr.test.mjs"]);
  await runCheck(server, "flows", ["scripts/qa/check-flows.mjs"]);
  await runCheck(server, "sitemap", ["scripts/qa/check-sitemap.mjs"]);
  await runCheck(server, "seo", ["scripts/qa/check-seo.mjs"]);
  // The expanded city list adds 18 full scroll-throughs across three viewports.
  // Keep every page and assertion; only this stage gets a bounded extra minute.
  await runCheck(server, "responsive", ["scripts/qa/check-responsive.mjs"], 180_000);
  await runCheck(server, "booking-ui", ["scripts/qa/check-booking-ui.mjs"]);
  const diagnosticFailures = [];
  for (const check of [
    {
      name: "lighthouse",
      command: "npm",
      args: ["exec", "--yes", "--package=@lhci/cli@0.15.1", "--", "node", "scripts/qa/check-lighthouse.mjs"],
      timeoutMs: 270_000,
    },
    {
      name: "hero-stability",
      command: process.execPath,
      args: ["scripts/qa/check-hero-stability.mjs"],
      timeoutMs: 120_000,
    },
  ]) {
    try {
      await runCheck(server, check.name, check.args, check.timeoutMs, check.command);
    } catch (error) {
      diagnosticFailures.push(error.message);
      log(`QA: ${error.message}`);
    }
  }
  if (diagnosticFailures.length) throw new Error(diagnosticFailures.join("; "));
  summary.status = "passed";
} catch (error) {
  summary.status = "failed";
  summary.error = error.message;
  process.exitCode = signalExitCode ?? 1;
  log(`QA: ${error.message}`);
} finally {
  for (const record of children.toReversed()) {
    try {
      await stopChild(record);
    } catch (error) {
      summary.status = "failed";
      summary.cleanupError = error.message;
      process.exitCode = signalExitCode ?? 1;
      log(`QA: ${error.message}`);
    }
  }
  await releasePorts();
  summary.finishedAt = new Date().toISOString();
  await writeFile(resolve(outputRoot, "run-summary.json"), JSON.stringify(summary, null, 2));
  process.off("SIGINT", onInterrupt);
  process.off("SIGTERM", onTerminate);
}
log(`QA: ${summary.status}; logs and results are in .qa-output/.`);
