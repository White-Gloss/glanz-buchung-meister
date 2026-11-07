import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { summarizeLighthouse } from "./lighthouse-summary.mjs";

const paths = ["/", "/preise", "/leistungen", "/abholservice"];
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "wg-lighthouse-summary-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const profile of ["mobile", "desktop"]) {
    const directory = join(root, profile);
    await mkdir(directory);
    const manifest = [];
    for (const [page, path] of paths.entries()) {
      const url = `https://white-gloss.de${path}`;
      for (let run = 0; run < 3; run++) {
        const jsonPath = join(directory, `${page}-${run}.report.json`);
        const report = {
          requestedUrl: url,
          finalDisplayedUrl: url,
          fetchTime: `2026-11-07T00:0${run}:00.000Z`,
          lighthouseVersion: "13.0.1",
          configSettings: { formFactor: profile, throttlingMethod: "simulate" },
          categories: {
            performance: { score: [0.91, 0.97, 0.99][run] },
            accessibility: { score: 1 },
            "best-practices": { score: 1 },
            seo: { score: 1 },
          },
          audits: {
            "largest-contentful-paint": { numericValue: [2800, 2100, 1900][run] },
            "cumulative-layout-shift": { numericValue: [0.04, 0.02, 0.03][run] },
            "total-blocking-time": { numericValue: [100, 50, 75][run] },
          },
        };
        await writeFile(jsonPath, JSON.stringify(report));
        manifest.push({ url, jsonPath, isRepresentativeRun: run === 1 });
      }
    }
    await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest));
  }
  return root;
}

// Prior CI logs hid actual values behind a green assertion and binary artifacts.
test("summarizes all 24 actual samples by profile and URL, with median and range", async (t) => {
  const summary = await summarizeLighthouse(await fixture(t));
  assert.equal(summary.status, "complete");
  assert.equal(summary.groups.length, 8);
  const home = summary.groups.find((group) => group.profile === "mobile" && group.url === "https://white-gloss.de/");
  assert.equal(home.count, 3);
  assert.deepEqual(home.scores.performance, { median: 0.97, min: 0.91, max: 0.99 });
  assert.deepEqual(home.metrics.lcp, { median: 2100, min: 1900, max: 2800 });
  assert.deepEqual(home.metrics.cls, { median: 0.03, min: 0.02, max: 0.04 });
  assert.deepEqual(home.metrics.tbt, { median: 75, min: 50, max: 100 });
  assert.deepEqual(summary.errors, []);
});

// An incomplete run must not become an apparently successful three-sample median.
test("missing profiles remain an explicit incomplete measurement, not a zero score", async (t) => {
  const root = await fixture(t);
  await rm(join(root, "desktop", "manifest.json"));
  let summary;
  await assert.doesNotReject(async () => { summary = await summarizeLighthouse(root); }, "A failed profile still needs a readable report");
  assert.equal(summary.status, "incomplete");
  const desktop = summary.groups.find((group) => group.profile === "desktop");
  assert.equal(desktop.count, 0);
  assert.equal(desktop.scores.performance.median, null);
  assert.match(summary.errors.join("\n"), /desktop.*manifest/);
});

test("invalid report metrics and runtime errors are excluded and named", async (t) => {
  const root = await fixture(t);
  for (const [file, change] of [
    ["0-0.report.json", (report) => { report.categories.performance.score = null; }],
    ["0-1.report.json", (report) => { report.runtimeError = { code: "NO_FCP" }; }],
  ]) {
    const path = join(root, "mobile", file);
    const report = JSON.parse(await readFile(path, "utf8"));
    change(report);
    await writeFile(path, JSON.stringify(report));
  }
  const summary = await summarizeLighthouse(root);
  assert.equal(summary.status, "incomplete");
  const mobile = summary.groups.find((group) => group.profile === "mobile");
  assert.equal(mobile.count, 1);
  assert.equal(mobile.metrics.lcp.median, null);
  assert.match(summary.errors.join("\n"), /score/);
  assert.match(summary.errors.join("\n"), /NO_FCP/);
});

// A duplicate entry cannot manufacture three independent measurements.
test("duplicate reports cannot fill a missing run", async (t) => {
  const root = await fixture(t);
  const path = join(root, "mobile", "manifest.json");
  const manifest = JSON.parse(await readFile(path, "utf8"));
  manifest[2] = manifest[1];
  await writeFile(path, JSON.stringify(manifest));
  const summary = await summarizeLighthouse(root);
  assert.equal(summary.status, "incomplete");
  assert.equal(summary.groups[0].count, 2);
  assert.match(summary.errors.join("\n"), /duplicate/);
});

// An artifact is input, not permission to read arbitrary runner files.
test("manifest paths outside their profile directory are refused", async (t) => {
  const root = await fixture(t);
  const path = join(root, "mobile", "manifest.json");
  const manifest = JSON.parse(await readFile(path, "utf8"));
  manifest[0].jsonPath = join(root, "desktop", "0-0.report.json");
  await writeFile(path, JSON.stringify(manifest));
  const summary = await summarizeLighthouse(root);
  assert.equal(summary.status, "incomplete");
  assert.match(summary.errors.join("\n"), /outside/);
});

test("wrong URL or device profile cannot be presented as a production measurement", async (t) => {
  const root = await fixture(t);
  const path = join(root, "mobile", "0-0.report.json");
  const report = JSON.parse(await readFile(path, "utf8"));
  report.finalDisplayedUrl = "https://unrelated.example/";
  report.configSettings.formFactor = "desktop";
  await writeFile(path, JSON.stringify(report));
  const summary = await summarizeLighthouse(root);
  assert.equal(summary.status, "incomplete");
  assert.equal(summary.groups[0].count, 2);
});

// The workflow needs readable logs and durable JSON even when collection failed.
test("CLI writes JSON, Markdown and the job summary with real measurements", async (t) => {
  const root = await fixture(t);
  const step = join(root, "job-summary.md");
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./lighthouse-summary.mjs", import.meta.url)), root], {
    encoding: "utf8", windowsHide: true, env: { ...process.env, GITHUB_STEP_SUMMARY: step },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /97.*2100/);
  const summary = JSON.parse(await readFile(join(root, "summary.json"), "utf8"));
  assert.equal(summary.status, "complete");
  assert.match(await readFile(step, "utf8"), /TBT.*INP/);
});

test("CLI preserves an incomplete report and exits nonzero instead of claiming success", async (t) => {
  const root = await fixture(t);
  await rm(join(root, "mobile", "manifest.json"));
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./lighthouse-summary.mjs", import.meta.url)), root], {
    encoding: "utf8", windowsHide: true, env: { ...process.env, GITHUB_STEP_SUMMARY: "" },
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /incomplete/);
  assert.equal(JSON.parse(await readFile(join(root, "summary.json"), "utf8")).status, "incomplete");
});
