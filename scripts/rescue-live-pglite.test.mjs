import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { PGlite } from "@electric-sql/pglite";
import { parseArguments, validateTarget, validateInspectorTarget, expressionFor,
  inspectRuntime, backupRuntime, runRescue, RescueError, connectInspector } from "./rescue-live-pglite.mjs";

const pid = 123;
const current = "/srv/white-gloss-releases/qonto-409f755";
const directory = `${current}/.recovery/2026-09-07T12-00-00-000Z-12345678-1234-1234-1234-123456789abc`;
const target = { pid, current, uid: 1000, gid: 1000, started: "1234" };
const input = {
  pid, current, cwd: current, executable: "/usr/bin/node", nodeOptions: "",
  cmdline: "/usr/bin/node\0/srv/white-gloss-current/.output/server/index.mjs\0",
  status: "Uid:\t1000\t1000\t1000\t1000\nGid:\t1000\t1000\t1000\t1000\n",
  stat: `123 (node) ${["S", ...Array(18).fill("0"), "1234"].join(" ")}`,
};

function runtimeContext(pg, overrides = {}) {
  let bytes;
  const files = new Map();
  const memoryFs = {
    realpathSync: (path) => path,
    lstatSync: () => ({ isSymbolicLink: () => false }),
    statSync: () => ({ isDirectory: () => true, uid: 1000, mode: 0o40700 }),
    openSync(path, flags, mode) {
      if (path === directory) return 2;
      assert.equal(path, `${directory}/database.tar`);
      assert.equal(flags, "wx"); assert.equal(mode, 0o600);
      if (files.has(path)) throw Object.assign(new Error("exists"), { code: "EEXIST" });
      files.set(path, true); return 1;
    },
    writeSync(fd, buffer, offset, length) {
      assert.equal(fd, 1); bytes = Uint8Array.from(buffer.subarray(offset, offset + length)); return length;
    },
    fsyncSync() {}, closeSync() {},
  };
  const context = vm.createContext({
    process: { pid, version: "v22.23.2", cwd: () => current, getuid: () => 1000,
      env: { DATABASE_URL: "private-database-url", BETTER_AUTH_SECRET: "private-secret" },
      getBuiltinModule: (name) => name === "fs" ? memoryFs : crypto,
    },
    __pgliteInstance__: pg ? Promise.resolve(pg) : undefined,
    ...overrides,
  });
  return { context, getBytes: () => bytes, files, memoryFs };
}

test("CLI requires an explicit mode and bounded positive PID; no paths or eval", () => {
  assert.deepEqual(parseArguments(["inspect", "--pid", "123"]), { mode: "inspect", pid });
  for (const args of [[], ["inspect", "--pid", "0"], ["inspect", "--pid", "-1"],
    ["backup", "--pid", "2147483648"], ["eval", "--pid", "123"], ["inspect", "--pid", "123", "extra"]]) {
    assert.throws(() => parseArguments(args), RescueError);
  }
  assert.throws(() => expressionFor("backup", pid, "/root/private"), /unsafe_backup_directory/);
  assert.throws(() => expressionFor("backup", pid, `${directory}/../outside`), /unsafe_backup_directory/);
});

test("process validation accepts the legacy release but refuses unrelated processes and inspector overrides", () => {
  assert.deepEqual(validateTarget(input), target);
  for (const patch of [
    { cmdline: "/usr/bin/node\0/tmp/server.mjs\0" },
    { cmdline: "/usr/bin/node\0--inspect\0/srv/white-gloss-current/.output/server/index.mjs\0" },
    { executable: "/usr/bin/python3" }, { cwd: "/srv/other" },
    { current: "/srv/white-gloss-releases/../other" }, { nodeOptions: "--inspect-port=0.0.0.0:9229" },
    { nodeOptions: "--disable-sigusr1" }, { status: input.status.replaceAll("1000", "0") },
  ]) assert.throws(() => validateTarget({ ...input, ...patch }), RescueError);
});

test("inspector discovery accepts exactly one local Node target", () => {
  const url = "ws://127.0.0.1:9229/12345678-1234-1234-1234-123456789abc";
  assert.equal(validateInspectorTarget([{ type: "node", webSocketDebuggerUrl: url }]), url);
  for (const invalid of [[], [{ type: "page", webSocketDebuggerUrl: url }],
    [{ type: "node", webSocketDebuggerUrl: url.replace("127.0.0.1", "0.0.0.0") }],
    [{ type: "node", webSocketDebuggerUrl: url.replace("9229", "1234") }]]) {
    assert.throws(() => validateInspectorTarget(invalid), RescueError);
  }
});

test("inspection only returns presence/counts and never creates an absent database", async () => {
  const missing = runtimeContext(undefined);
  const result = await vm.runInContext(`(${inspectRuntime.toString()})(${pid})`, missing.context);
  assert.equal(result.pgliteExists, false);
  assert.equal(result.configuration.DATABASE_URL, true);
  assert.equal(result.configuration.WHATSAPP_ACCESS_TOKEN, false);
  assert.doesNotMatch(JSON.stringify(result), /private-database-url|private-secret/);
  await assert.rejects(vm.runInContext(expressionFor("backup", pid, directory), missing.context), /no_existing_pglite/);
  assert.equal(missing.files.size, 0);
  assert.equal(missing.context.__pgliteInstance__, undefined);
});

test("real PGlite snapshot under runExclusive is restorable during parallel writes, with no nested-SQL deadlock", { timeout: 20_000 }, async () => {
  const pg = await PGlite.create();
  let restored;
  try {
    await pg.exec("CREATE TABLE bookings (id integer PRIMARY KEY, note text); INSERT INTO bookings SELECT n, 'private-test-note' FROM generate_series(1,20) n");
    const runtime = runtimeContext(pg);
    const originalQuery = pg.query.bind(pg);
    const originalExec = pg.exec.bind(pg);
    const dumpContext = new AsyncLocalStorage();
    const originalDump = pg.dumpDataDir.bind(pg);
    pg.dumpDataDir = (...args) => dumpContext.run(true, () => originalDump(...args));
    pg.query = (...args) => { assert.notEqual(dumpContext.getStore(), true, "dump must not issue nested query"); return originalQuery(...args); };
    pg.exec = (...args) => { assert.notEqual(dumpContext.getStore(), true, "dump must not issue nested exec/CHECKPOINT"); return originalExec(...args); };
    const writes = (async () => { for (let n = 21; n <= 45; n++) await pg.query("INSERT INTO bookings VALUES ($1, $2)", [n, "private-test-note"]); })();
    const result = await vm.runInContext(`(${backupRuntime.toString()})(${pid},${JSON.stringify(directory)})`, runtime.context);
    await writes;
    assert.equal(result.complete, true);
    assert.equal(result.bytes, runtime.getBytes().length);
    assert.equal(result.sha256, crypto.createHash("sha256").update(runtime.getBytes()).digest("hex"));
    assert.doesNotMatch(JSON.stringify(result), /private-test-note|private-secret/);
    assert.equal(runtime.context.__whiteGlossRecoveryInProgress__, undefined);
    restored = await PGlite.create({ loadDataDir: new Blob([runtime.getBytes()]) });
    const saved = Number((await restored.query("SELECT count(*) AS count FROM bookings")).rows[0].count);
    assert.ok(saved >= 20 && saved <= 45, `snapshot has ${saved} committed rows`);
    assert.equal(Number((await pg.query("SELECT count(*) AS count FROM bookings")).rows[0].count), 45);
    await assert.rejects(vm.runInContext(expressionFor("backup", pid, directory), runtime.context), /exists/);
  } finally { await restored?.close(); await pg.close(); }
});

test("backup refuses an open transaction and a concurrent rescue without touching snapshot storage", async () => {
  const pg = { dumpDataDir: () => assert.fail("must not dump"), runExclusive: (fn) => fn(), isInTransaction: () => true };
  const runtime = runtimeContext(pg);
  await assert.rejects(vm.runInContext(expressionFor("backup", pid, directory), runtime.context), /active_transaction/);
  assert.equal(runtime.files.size, 0);
  runtime.context.__whiteGlossRecoveryInProgress__ = true;
  await assert.rejects(vm.runInContext(expressionFor("backup", pid, directory), runtime.context), /backup_already_in_progress/);
});

function orchestration(overrides = {}) {
  const calls = [];
  const client = { socket: { close: () => calls.push("socket.close") },
    async evaluate(expression) {
      calls.push(expression);
      if (expression === "process.pid") return pid;
      if (expression.startsWith("setTimeout")) return true;
      if (expression.includes("async function inspectRuntime")) return { pgliteExists: true, recoveryInProgress: false };
      return { complete: true, path: `${directory}/database.tar`, bytes: 2048, sha256: "a".repeat(64) };
    },
  };
  return { calls, client, deps: {
    platform: "linux", uid: 0, readTarget: () => target,
    assertPortFree: async () => calls.push("port.checked"),
    signal: (sentPid, signal) => calls.push([sentPid, signal]),
    waitForInspector: async () => "local-url", connect: async () => client,
    prepareDirectory: () => { calls.push("directory.created"); return directory; },
    waitForPortClosed: async () => calls.push("port.closed"), ...overrides,
  } };
}

test("inspect orchestration signals only the verified target and closes inspector without a backup directory", async () => {
  const { calls, deps } = orchestration();
  await runRescue({ mode: "inspect", pid }, deps);
  assert.deepEqual(calls.slice(0, 3), ["port.checked", [pid, "SIGUSR1"], "process.pid"]);
  assert.equal(calls.includes("directory.created"), false);
  assert.ok(calls.includes("port.closed"));
});

test("occupied port, non-root and changed PID identity fail before SIGUSR1", async () => {
  for (const patch of [
    { uid: 1000 }, { platform: "win32" },
    { assertPortFree: async () => { throw new RescueError("inspector_port_in_use"); } },
    { readTarget: (() => { let n = 0; return () => ({ ...target, started: String(++n) }); })() },
  ]) {
    const { calls, deps } = orchestration(patch);
    await assert.rejects(runRescue({ mode: "inspect", pid }, deps), RescueError);
    assert.equal(calls.some(Array.isArray), false);
  }
});

test("backup orchestration validates the result and closes inspector on failure", async () => {
  const success = orchestration();
  assert.equal((await runRescue({ mode: "backup", pid }, success.deps)).backup.complete, true);
  assert.ok(success.calls.includes("directory.created"));
  const failure = orchestration();
  const evaluate = failure.client.evaluate.bind(failure.client);
  failure.client.evaluate = (expression) => expression.includes("async function backupRuntime")
    ? Promise.reject(new RescueError("target_timeout_operation_may_continue")) : evaluate(expression);
  await assert.rejects(runRescue({ mode: "backup", pid }, failure.deps), /target_timeout_operation_may_continue/);
  assert.ok(failure.calls.includes("port.closed"));
});

test("cleanup failure is explicit and retains the original failure code", async () => {
  const failure = orchestration({ waitForPortClosed: async () => { throw new Error("not closed"); } });
  const evaluate = failure.client.evaluate.bind(failure.client);
  failure.client.evaluate = (expression) => expression.includes("async function inspectRuntime")
    ? Promise.reject(new RescueError("target_evaluation_failed")) : evaluate(expression);
  await assert.rejects(runRescue({ mode: "inspect", pid }, failure.deps), /target_evaluation_failed; inspector_cleanup_unconfirmed_process_preserved/);
});

test("actual Node inspector evaluates the exact expressions against real PGlite and closes; filesystem paths are projected into a temporary sandbox", { timeout: 20_000 }, async () => {
  const sandbox = fs.mkdtempSync(path.join(tmpdir(), "white-gloss-rescue-transport-"));
  const localDirectory = path.join(sandbox, ".recovery", path.posix.basename(directory));
  fs.mkdirSync(localDirectory, { recursive: true, mode: 0o700 });
  // The CLI is Linux-only. Project its fixed /srv paths into this Windows-safe
  // sandbox; database, builtins, files, inspector, expressions and socket are real.
  const program = `
    import { PGlite } from '@electric-sql/pglite';
    import fs from 'node:fs';
    const pg = await PGlite.create();
    await pg.exec('CREATE TABLE bookings(id int); INSERT INTO bookings VALUES(1),(2)');
    globalThis.__pgliteInstance__ = Promise.resolve(pg);
    const actualBuiltin = process.getBuiltinModule.bind(process);
    const actualRoot = ${JSON.stringify(sandbox)};
    const logicalRoot = ${JSON.stringify(current)};
    const map = value => typeof value === 'string' && value.startsWith(logicalRoot) ? actualRoot + value.slice(logicalRoot.length) : value;
    const projected = Object.create(fs);
    projected.realpathSync = value => { const actual = fs.realpathSync(map(value)); return logicalRoot + actual.slice(actualRoot.length).replaceAll('\\\\', '/'); };
    projected.lstatSync = value => fs.lstatSync(map(value));
    projected.statSync = value => { const stat = fs.statSync(map(value)); return { isDirectory: () => stat.isDirectory(), uid: 1000, mode: 0o40700 }; };
    projected.openSync = (value, flags, mode) => value === ${JSON.stringify(directory)} ? -99 : fs.openSync(map(value), flags, mode);
    projected.fsyncSync = fd => { if(fd !== -99) fs.fsyncSync(fd); };
    projected.closeSync = fd => { if(fd !== -99) fs.closeSync(fd); };
    process.cwd = () => logicalRoot;
    process.getuid = () => 1000;
    process.getBuiltinModule = name => name === 'fs' ? projected : actualBuiltin(name);
    console.log('READY');
    setInterval(() => {}, 1000);
  `;
  const child = spawn(process.execPath, ["--inspect=127.0.0.1:0", "--input-type=module", "-e", program],
    { cwd: process.cwd(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let client;
  try {
    const ready = new Promise((resolve, reject) => {
      let stdout = "", stderr = "";
      const timer = setTimeout(() => reject(new Error("child inspector not ready")), 10_000);
      const check = () => {
        const url = /ws:\/\/127\.0\.0\.1:\d+\/[0-9a-f-]{36}/.exec(stderr)?.[0];
        if (url && stdout.includes("READY")) { clearTimeout(timer); resolve(url); }
      };
      child.stdout.on("data", data => { stdout += data; check(); });
      child.stderr.on("data", data => { stderr += data; check(); });
      child.once("exit", () => { clearTimeout(timer); reject(new Error("child exited before ready")); });
    });
    const inspectorUrl = await ready;
    client = await connectInspector(inspectorUrl);
    const actualPid = await client.evaluate("process.pid");
    assert.equal(actualPid, child.pid);
    const inspection = await client.evaluate(expressionFor("inspect", child.pid));
    assert.equal(inspection.tables.bookings, 2);
    assert.deepEqual(inspection.capabilities, { dumpDataDir: true, runExclusive: true, isInTransaction: true });
    const backup = await client.evaluate(expressionFor("backup", child.pid, directory));
    const saved = fs.readFileSync(path.join(localDirectory, "database.tar"));
    assert.equal(backup.bytes, saved.length);
    assert.equal(backup.sha256, crypto.createHash("sha256").update(saved).digest("hex"));
    const restored = await PGlite.create({ loadDataDir: new Blob([saved]) });
    try { assert.equal(Number((await restored.query("SELECT count(*) AS n FROM bookings")).rows[0].n), 2); }
    finally { await restored.close(); }
    await client.evaluate("setTimeout(() => process.getBuiltinModule('inspector').close(), 250); true");
    const closed = new Promise(resolve => client.socket.addEventListener("close", resolve, { once: true }));
    client.socket.close();
    await closed;
    await new Promise(resolve => setTimeout(resolve, 400));
    const endpoint = new URL(inspectorUrl); endpoint.protocol = "http:"; endpoint.pathname = "/json/list";
    await assert.rejects(fetch(endpoint, { signal: AbortSignal.timeout(500) }), /fetch failed/);
    assert.equal(child.exitCode, null, "closing the inspector preserves the running process");
  } finally {
    client?.socket.close(); child.kill();
    await new Promise(resolve => child.exitCode === null ? child.once("exit", resolve) : resolve());
    const checked = path.resolve(sandbox);
    assert.ok(checked.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(checked).startsWith("white-gloss-rescue-transport-"));
    fs.rmSync(checked, { recursive: true, force: true });
  }
});
