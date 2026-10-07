// Never launch a browser or access a URL outside the existing isolated Linux CI.
import { assertIsolatedGithubCi } from "../hosting-policy.mjs";
assertIsolatedGithubCi();
import assert from "node:assert/strict";
import { access, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { delimiter, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { qaBase, controlBase } from "./ports.mjs";

const budgetArgument = process.argv[2] || "--budget-ms=240000";
assert.match(budgetArgument, /^--budget-ms=\d+$/);
assert.equal(process.argv.length <= 3, true, "Unexpected Lighthouse arguments");
const budgetMs = Number(budgetArgument.split("=")[1]);
assert.ok(budgetMs >= 30_000 && budgetMs <= 240_000, "Invalid Lighthouse runtime budget");
assert.ok(process.env.QA_RUN_ID, "An owned isolated QA run is required");
assert.equal(process.env.FRONTEND_BASE_URL, qaBase, "Only the owned QA origin may be audited");

const output = resolve(".qa-output/lighthouse");
const classical = ["performance", "accessibility", "best-practices", "seo"];
const minimumScores = { performance: 0.995, accessibility: 0.95, "best-practices": 0.9, seo: 0.95 };
const metricIds = ["first-contentful-paint", "largest-contentful-paint", "speed-index", "total-blocking-time", "cumulative-layout-shift"];
const started = Date.now();
const abort = new AbortController();
let activeChrome;
let killOwnedBrowsers;
const summary = {
  startedAt: new Date(started).toISOString(),
  status: "running",
  url: `${qaBase}/`,
  source: "Actual PR production build served by this run's isolated QA server",
  commit: process.env.GITHUB_SHA,
  qaRunId: process.env.QA_RUN_ID,
  runtimeBudgetMs: budgetMs,
  throttling: "Existing @lhci/cli@0.15.1 tool's default simulated mobile / desktop preset; no reduced throttling",
  scope: "Synthetic isolated lab measurements; not production response time, field CWV or ranking proof",
  gates: { minimumMedianScores: minimumScores, maximumMedianCls: 0.1 },
  target: "100 displayed performance points, mobile and desktop",
  runs: [],
  profiles: {},
  requestFiltering: "none",
  forwardedHost: "white-gloss.de (same production head rules as the Caddy proxy)",
  externalRequests: [],
};

function cancel(signal) {
  abort.abort(new Error(`Lighthouse interrupted by ${signal}`));
  if (activeChrome) Promise.resolve(activeChrome.kill()).catch(() => undefined);
  killOwnedBrowsers?.();
  activeChrome = undefined;
}
const onInterrupt = () => cancel("SIGINT");
const onTerminate = () => cancel("SIGTERM");
process.once("SIGINT", onInterrupt);
process.once("SIGTERM", onTerminate);
const watchdog = setTimeout(() => cancel("runtime budget"), budgetMs);

function median(values) {
  assert.ok(values.length === 3 && values.every(Number.isFinite), "Three valid samples required");
  return [...values].sort((a, b) => a - b)[1];
}

async function existingLhciPackage() {
  // npm exec exposes the already configured LHCI tool's executable through PATH.
  // Resolve its dependencies from that package, without adding project packages.
  for (const directory of (process.env.PATH || "").split(delimiter)) {
    let executable;
    try { executable = await realpath(resolve(directory, "lhci")); } catch { continue; }
    let parent = dirname(executable);
    for (let depth = 0; depth < 5; depth++) {
      const packagePath = resolve(parent, "package.json");
      try {
        const pkg = JSON.parse(await readFile(packagePath, "utf8"));
        if (pkg.name === "@lhci/cli") {
          assert.equal(pkg.version, "0.15.1", "Use the repository's existing pinned Lighthouse CI tool");
          return packagePath;
        }
      } catch (error) { if (error.code === "ERR_ASSERTION") throw error; }
      parent = dirname(parent);
    }
  }
  throw new Error("Run through npm exec --yes --package=@lhci/cli@0.15.1 -- node scripts/qa/check-lighthouse.mjs");
}

async function withinDeadline(operation, milliseconds) {
  abort.signal.throwIfAborted();
  let timer;
  let onAbort;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Lighthouse run exceeded ${milliseconds} ms`)), milliseconds);
        onAbort = () => reject(abort.signal.reason);
        abort.signal.addEventListener("abort", onAbort, { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timer);
    abort.signal.removeEventListener("abort", onAbort);
  }
}

await mkdir(output, { recursive: true });
try {
  // The control identity must belong to this runner, not an old server on the port.
  const identity = await fetch(`${controlBase}/identity`, {
    redirect: "error",
    signal: AbortSignal.any([abort.signal, AbortSignal.timeout(5_000)]),
  });
  assert.equal(identity.status, 200);
  assert.equal(identity.headers.get("x-qa-run-id"), process.env.QA_RUN_ID);
  assert.deepEqual(await identity.json(), {
    isolated: true, database: "in-memory-pglite", externalFetch: "blocked",
  });

  const toolPackagePath = await existingLhciPackage();
  const packagePath = createRequire(toolPackagePath).resolve("lighthouse/package.json");
  const packageRoot = dirname(packagePath);
  const lighthouseVersion = JSON.parse(await readFile(packagePath, "utf8")).version;
  const lighthousePath = createRequire(toolPackagePath).resolve("lighthouse");
  const { default: lighthouse, generateReport } = await import(pathToFileURL(lighthousePath));
  const { default: desktopConfig } = await import(pathToFileURL(resolve(packageRoot, "core/config/desktop-config.js")));
  const { default: defaultConfig } = await import(pathToFileURL(resolve(packageRoot, "core/config/default-config.js")));
  const { chromium } = await import("playwright");
  const launcherPath = createRequire(packagePath).resolve("chrome-launcher");
  const { launch, killAll } = await import(pathToFileURL(launcherPath));
  killOwnedBrowsers = killAll;
  // Use the exact Playwright installation provisioned by the existing CI job.
  process.env.CHROME_PATH = chromium.executablePath();
  await access(process.env.CHROME_PATH);
  summary.chromePath = process.env.CHROME_PATH;
  summary.lighthouseVersion = lighthouseVersion;
  summary.lhciVersion = "0.15.1";
  const categories = [...classical];
  if (defaultConfig.categories["agentic-browsing"]) categories.push("agentic-browsing");
  summary.categories = categories;

  for (const profile of ["mobile", "desktop"]) {
    for (let run = 1; run <= 3; run++) {
      abort.signal.throwIfAborted();
      const prefix = `${profile}-home-${run}`;
      const remainingRuns = 6 - summary.runs.length;
      const runBudget = Math.min(40_000, Math.floor((budgetMs - (Date.now() - started) - 3_000) / remainingRuns));
      assert.ok(runBudget > 5_000, "Insufficient remaining Lighthouse budget");
      const runStart = Date.now();
      const chrome = await launch({
        chromePath: process.env.CHROME_PATH,
        chromeFlags: ["--headless", "--no-sandbox", "--disable-dev-shm-usage"],
        handleSIGINT: false,
        connectionPollInterval: 100,
        maxConnectionRetries: 50,
        logLevel: "error",
      });
      activeChrome = chrome;
      try {
        const result = await withinDeadline(lighthouse(`${qaBase}/`, {
          port: chrome.port,
          logLevel: "error",
          output: "json",
          onlyCategories: categories,
          throttlingMethod: "simulate",
          // Mirror Caddy's customer host while connecting only to the owned CI build.
          // The existing host rule then omits preview-only Grok extensions.
          extraHeaders: { "x-forwarded-host": "white-gloss.de" },
          maxWaitForFcp: 15_000,
          maxWaitForLoad: 20_000,
        }, profile === "desktop" ? desktopConfig : undefined), runBudget);
        assert.ok(result?.lhr, "Lighthouse produced no report");
        const report = result.lhr;
        await writeFile(resolve(output, `${prefix}.report.json`), JSON.stringify(report, null, 2));
        await writeFile(resolve(output, `${prefix}.report.html`), generateReport(report, "html"));
        const networkRequests = report.audits["network-requests"]?.details?.items;
        assert.ok(Array.isArray(networkRequests), "Network diagnostics required to validate isolation");
        const externalRequests = networkRequests
          .filter((request) => {
            const url = new URL(request.url);
            return url.protocol !== "data:" && url.origin !== qaBase;
          });
        summary.externalRequests.push(...externalRequests.map((request) => ({ profile, run, ...request })));
        assert.equal(externalRequests.length, 0, "Initial external requests invalidate the isolated measurement");
        assert.equal(report.lighthouseVersion, lighthouseVersion);
        assert.ok(!report.runtimeError, JSON.stringify(report.runtimeError));
        assert.equal(report.configSettings.formFactor, profile);
        assert.equal(report.configSettings.throttlingMethod, "simulate");
        assert.equal(new URL(report.requestedUrl).origin, qaBase);
        assert.equal(new URL(report.finalDisplayedUrl).origin, qaBase);
        const scores = Object.fromEntries(categories.map((id) => [id, report.categories[id]?.score]));
        for (const id of classical) assert.ok(Number.isFinite(scores[id]), `Missing ${id} score`);
        const metrics = Object.fromEntries(metricIds.map((id) => [id, {
          value: report.audits[id]?.numericValue, unit: report.audits[id]?.numericUnit,
        }]));
        for (const id of metricIds) assert.ok(Number.isFinite(metrics[id].value), `Missing ${id} metric`);
        const failedAudits = Object.fromEntries(categories.map((id) => [id,
          report.categories[id].auditRefs.filter((ref) => ref.weight > 0)
            .map((ref) => report.audits[ref.id])
            .filter((audit) => Number.isFinite(audit?.score) && audit.score < 1)
            .map((audit) => ({ id: audit.id, title: audit.title, score: audit.score, displayValue: audit.displayValue })),
        ]));
        summary.runs.push({ profile, run, durationMs: Date.now() - runStart,
          json: `${prefix}.report.json`, html: `${prefix}.report.html`, scores, metrics,
          settings: report.configSettings, runWarnings: report.runWarnings, failedAudits,
          agenticBrowsing: report.categories["agentic-browsing"]?.auditRefs
            .map((ref) => report.audits[ref.id])
            .filter((audit) => Number.isFinite(audit?.score))
            .map((audit) => ({ id: audit.id, score: audit.score, scoreDisplayMode: audit.scoreDisplayMode })),
        });
        console.log(`Lighthouse ${profile} ${run}/3: ${classical.map((id) => `${id}=${Math.round(scores[id] * 100)}`).join(" ")}`);
      } finally {
        // chrome-launcher owns a separate Linux process group: always kill the browser itself.
        if (activeChrome === chrome) await chrome.kill();
        activeChrome = undefined;
      }
    }
  }

  const failures = [];
  const shortfalls = [];
  for (const profile of ["mobile", "desktop"]) {
    const runs = summary.runs.filter((run) => run.profile === profile);
    const scores = Object.fromEntries(categories.map((id) => {
      const values = runs.map((run) => run.scores[id]);
      return [id, { median: median(values), displayedMedian: Math.round(median(values) * 100), minimum: Math.min(...values), maximum: Math.max(...values) }];
    }));
    const metrics = Object.fromEntries(metricIds.map((id) => [id, {
      median: median(runs.map((run) => run.metrics[id].value)), unit: runs[0].metrics[id].unit,
    }]));
    for (const id of classical) {
      if (scores[id].median < minimumScores[id]) failures.push(`${profile} ${id} median ${scores[id].median} < ${minimumScores[id]}`);
      if (id === "performance" && scores[id].displayedMedian < 100) shortfalls.push({ profile, category: id, displayedMedian: scores[id].displayedMedian, target: 100 });
    }
    if (metrics["cumulative-layout-shift"].median > 0.1) failures.push(`${profile} CLS median > 0.1`);
    summary.profiles[profile] = { scores, metrics };
  }
  summary.targetAchieved = shortfalls.length === 0;
  summary.shortfalls = shortfalls;
  summary.gateFailures = failures;
  assert.equal(failures.length, 0, failures.join("; "));
  summary.status = "passed";
} catch (error) {
  summary.status = "failed";
  summary.error = error.stack || String(error);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  if (activeChrome) await activeChrome.kill();
  // Also covers a launch that failed before returning its owned browser handle.
  const cleanupErrors = killOwnedBrowsers?.() || [];
  if (cleanupErrors.length) {
    summary.status = "failed";
    summary.cleanupErrors = cleanupErrors.map((error) => error.message);
    process.exitCode = 1;
  }
  process.off("SIGINT", onInterrupt);
  process.off("SIGTERM", onTerminate);
  summary.finishedAt = new Date().toISOString();
  summary.durationMs = Date.now() - started;
  await writeFile(resolve(output, "summary.json"), JSON.stringify(summary, null, 2));
}
console.log(`Lighthouse: ${summary.status}; ${summary.runs.length}/6 reports; ${summary.durationMs} ms; performance-100 target=${summary.targetAchieved ?? "not measured"}`);
