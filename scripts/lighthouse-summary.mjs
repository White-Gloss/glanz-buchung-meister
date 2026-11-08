// Summarizes saved Lighthouse reports; never starts a browser or server.
import assert from "node:assert/strict";
import { appendFile, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const profiles = ["mobile", "desktop"];
const urls = ["/", "/preise", "/leistungen", "/abholservice"].map((path) => `https://white-gloss.de${path}`);
const categories = ["performance", "accessibility", "best-practices", "seo"];
const metricIds = { lcp: "largest-contentful-paint", cls: "cumulative-layout-shift", tbt: "total-blocking-time" };
const stats = (values) => {
  const sorted = values.toSorted((a, b) => a - b);
  return { median: sorted.length === 3 ? sorted[1] : null, min: sorted[0] ?? null, max: sorted.at(-1) ?? null };
};

function validateReport(report, entry, profile) {
  assert.ok(!report.runtimeError, `runtime error ${report.runtimeError?.code}`);
  assert.equal(new URL(report.requestedUrl).href, entry.url, "requested URL mismatch");
  assert.equal(new URL(report.finalDisplayedUrl ?? report.finalUrl).href, entry.url, "final URL mismatch");
  assert.equal(report.configSettings?.formFactor, profile, "device profile mismatch");
  assert.equal(report.configSettings?.throttlingMethod, "simulate", "unexpected throttling method");
  assert.ok(Number.isFinite(Date.parse(report.fetchTime)), "missing fetch time");
  assert.ok(typeof report.lighthouseVersion === "string" && report.lighthouseVersion, "missing Lighthouse version");
  for (const id of categories) {
    const score = report.categories?.[id]?.score;
    assert.ok(Number.isFinite(score) && score >= 0 && score <= 1, `invalid ${id} score`);
  }
  for (const id of Object.values(metricIds)) {
    const value = report.audits?.[id]?.numericValue;
    assert.ok(Number.isFinite(value) && value >= 0, `invalid ${id} metric`);
  }
}

export async function summarizeLighthouse(root) {
  const summary = {
    status: "complete",
    scope: "Synthetic lab measurements of the published website, not this PR preview or field Core Web Vitals. TBT is not INP.",
    groups: [],
    errors: [],
  };
  for (const profile of profiles) {
    const reports = [];
    const seen = new Set();
    try {
      const directory = await realpath(resolve(root, profile));
      const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"));
      assert.ok(Array.isArray(manifest), "manifest must be an array");
      for (const [index, entry] of manifest.entries()) {
        try {
          assert.ok(urls.includes(entry.url), "unexpected URL in manifest");
          const path = await realpath(entry.jsonPath);
          const local = relative(directory, path);
          assert.ok(local && !local.startsWith("..") && !isAbsolute(local), "report path outside profile directory");
          assert.ok(!seen.has(path), "duplicate report path");
          seen.add(path);
          const report = JSON.parse(await readFile(path, "utf8"));
          validateReport(report, entry, profile);
          reports.push({ url: entry.url, report });
        } catch (error) {
          summary.errors.push(`${profile} report ${index + 1}: ${error.message.split("\n")[0]}`);
        }
      }
    } catch (error) {
      summary.errors.push(`${profile} manifest: ${error.message.split("\n")[0]}`);
    }
    for (const url of urls) {
      const samples = reports.filter((entry) => entry.url === url).map((entry) => entry.report);
      if (samples.length !== 3) summary.errors.push(`${profile} ${url}: expected 3 valid samples, received ${samples.length}`);
      summary.groups.push({
        profile, url, count: samples.length,
        lighthouseVersions: [...new Set(samples.map((report) => report.lighthouseVersion))],
        fetchTimes: samples.map((report) => report.fetchTime),
        throttlingMethod: "simulate",
        scores: Object.fromEntries(categories.map((id) => [id, stats(samples.map((report) => report.categories[id].score))])),
        metrics: Object.fromEntries(Object.entries(metricIds).map(([key, id]) => [key, stats(samples.map((report) => report.audits[id].numericValue))])),
      });
    }
  }
  if (summary.errors.length) summary.status = "incomplete";
  return summary;
}

function formatSummary(summary) {
  const show = (value, multiplier = 1) => value === null ? "n/a" : Math.round(value * multiplier * 1000) / 1000;
  const lines = [
    `Lighthouse production summary: ${summary.status}`,
    "",
    summary.scope,
    "",
    "Scores and metrics are medians of exactly three valid samples. Ranges show measured variation.",
    "",
    "| Profile | URL | Samples | Performance (range) | Accessibility | Best practices | SEO | LCP ms (range) | CLS | TBT ms |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const group of summary.groups) {
    const performance = group.scores.performance;
    const lcp = group.metrics.lcp;
    lines.push(`| ${group.profile} | ${new URL(group.url).pathname} | ${group.count}/3 | ${show(performance.median, 100)} (${show(performance.min, 100)}–${show(performance.max, 100)}) | ${show(group.scores.accessibility.median, 100)} | ${show(group.scores["best-practices"].median, 100)} | ${show(group.scores.seo.median, 100)} | ${show(lcp.median)} (${show(lcp.min)}–${show(lcp.max)}) | ${show(group.metrics.cls.median)} | ${show(group.metrics.tbt.median)} |`);
  }
  if (summary.errors.length) lines.push("", "Missing or invalid evidence:", "", ...summary.errors.map((error) => `- ${error}`));
  return lines.join("\n") + "\n";
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(process.argv[2] || ".lighthouseci");
  const summary = await summarizeLighthouse(root);
  const markdown = formatSummary(summary);
  await mkdir(root, { recursive: true });
  await writeFile(resolve(root, "summary.json"), JSON.stringify(summary, null, 2));
  await writeFile(resolve(root, "summary.md"), markdown);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
  if (summary.status !== "complete") process.exitCode = 1;
}
