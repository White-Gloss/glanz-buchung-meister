// Condense the isolated Lighthouse reports into the CI job log. The full
// reports stay in the uploaded artifact; this digest keeps the facts needed to
// diagnose a performance shortfall readable straight from the run output.
// Reads files only: no browser, server or network access.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const PERFORMANCE_DIAGNOSTICS = [
  "largest-contentful-paint-element",
  "lcp-phases-insight",
  "lcp-discovery-insight",
  "render-blocking-insight",
  "render-blocking-resources",
  "document-latency-insight",
  "network-dependency-tree-insight",
  "image-delivery-insight",
  "font-display-insight",
  "cls-culprits-insight",
  "layout-shifts",
  "unused-javascript",
  "unused-css-rules",
  "uses-responsive-images",
  "server-response-time",
  "bootup-time",
  "mainthread-work-breakdown",
  "total-byte-weight",
  "long-tasks",
];

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return undefined;
  }
}

function shortUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "data:" ? "data:" : url.pathname + url.search;
  } catch {
    return String(value).slice(0, 120);
  }
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value) : value;
}

function compact(value, depth = 0) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "string") return value.length > 160 ? `${value.slice(0, 157)}...` : value;
    return typeof value === "number" ? Math.round(value * 1000) / 1000 : value;
  }
  if (depth > 5) return "…";
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => compact(item, depth + 1));
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (["boundingRect", "lhId", "path", "debugData"].includes(key)) continue;
    result[key] = compact(item, depth + 1);
  }
  return result;
}

function describeAudit(audit) {
  if (!audit) return undefined;
  const details = audit.details;
  let items;
  if (details?.type === "list") {
    items = details.items?.map((item) => compact(item.items ?? item));
  } else if (Array.isArray(details?.items)) {
    items = details.items.map((item) =>
      compact(Object.fromEntries(
        Object.entries(item).map(([key, value]) => [key, key === "url" ? shortUrl(value) : value]),
      )),
    );
  } else if (details) {
    items = compact(details);
  }
  return {
    id: audit.id,
    score: audit.score,
    displayValue: audit.displayValue,
    numericValue: round(audit.numericValue),
    ...(items === undefined ? {} : { items }),
  };
}

function digestReport(report) {
  const lines = [];
  const observed = report.audits.metrics?.details?.items?.[0] ?? {};
  lines.push({
    observed: Object.fromEntries(
      [
        "observedFirstContentfulPaint",
        "observedLargestContentfulPaint",
        "observedDomContentLoaded",
        "observedLoad",
        "observedSpeedIndex",
      ].map((key) => [key, round(observed[key])]),
    ),
  });
  for (const id of PERFORMANCE_DIAGNOSTICS) {
    const audit = describeAudit(report.audits[id]);
    if (audit && (audit.score === null || audit.score < 1 || id === "largest-contentful-paint-element"))
      lines.push({ audit });
  }
  const requests = report.audits["network-requests"]?.details?.items ?? [];
  lines.push({
    networkRequests: requests.map((request) => ({
      url: shortUrl(request.url),
      type: request.resourceType,
      priority: request.priority,
      transfer: request.transferSize,
      resource: request.resourceSize,
      start: round(request.networkRequestTime),
      end: round(request.networkEndTime),
      status: request.statusCode,
    })),
  });
  return lines;
}

function digestBlocking(report) {
  const items = (id) => report.audits[id]?.details?.items ?? [];
  return {
    tbt: round(report.audits["total-blocking-time"]?.numericValue),
    longTasks: items("long-tasks").map((task) => ({
      url: shortUrl(task.url),
      start: round(task.startTime),
      duration: round(task.duration),
    })),
    bootup: items("bootup-time")
      .slice(0, 6)
      .map((item) => ({
        url: shortUrl(item.url),
        total: round(item.total),
        scripting: round(item.scripting),
        parse: round(item.scriptParseCompile),
      })),
    mainThread: items("mainthread-work-breakdown").map((item) => ({
      group: item.group,
      duration: round(item.duration),
    })),
  };
}

function digestLantern(lantern) {
  const estimate = (value) => ({
    timeInMs: round(value.timeInMs),
    nodes: value.nodeTimings.slice(0, 30).map((node) => ({
      type: node.type,
      ...(node.type === "network"
        ? {
            url: shortUrl(node.url),
            resourceType: node.resourceType,
            priority: node.priority,
            transferSize: node.transferSize,
          }
        : {
            event: node.eventName,
            observedDurationMs: round(node.observedDurationUs / 1000),
            scripts: node.evaluatedScriptURLs?.map(shortUrl),
          }),
      start: round(node.startTime),
      end: round(node.endTime),
    })),
  });
  return {
    reportedFCP: round(lantern.reportedFCP),
    reportedLCP: round(lantern.reportedLCP),
    simulator: lantern.simulator,
    observedTimings: lantern.processedNavigation?.timings,
    fcp: {
      timing: round(lantern.fcp.timing),
      optimistic: estimate(lantern.fcp.optimistic),
      pessimistic: estimate(lantern.fcp.pessimistic),
    },
    lcp: {
      timing: round(lantern.lcp.timing),
      optimistic: estimate(lantern.lcp.optimistic),
      pessimistic: estimate(lantern.lcp.pessimistic),
    },
  };
}

export async function lighthouseDigest(outputRoot) {
  const directory = resolve(outputRoot, "lighthouse");
  const lines = [];
  const summary = await readJson(resolve(directory, "summary.json"));
  if (!summary) return ["Lighthouse digest: no summary.json"];
  lines.push(
    `Lighthouse digest: status=${summary.status} target100=${summary.targetAchieved ?? "n/a"}`,
  );
  if (summary.error) lines.push(`Lighthouse digest error: ${String(summary.error).split("\n")[0]}`);
  for (const run of summary.runs ?? []) {
    lines.push(
      `LH ${run.profile} ${run.run}: ` +
        Object.entries(run.scores)
          .map(([id, score]) => `${id}=${Number.isFinite(score) ? Math.round(score * 100) : score}`)
          .join(" ") +
        " | " +
        Object.entries(run.metrics)
          .map(([id, metric]) => `${id}=${Math.round(metric.value * 1000) / 1000}`)
          .join(" "),
    );
  }
  let detailed = false;
  for (const run of (summary.runs ?? []).filter((item) => item.profile === "mobile")) {
    const report = await readJson(resolve(directory, run.json));
    if (!report) continue;
    // The first mobile report is enough for the full request table; blocking
    // time varies between runs, so its sources are listed for every run.
    if (!detailed) {
      for (const line of digestReport(report))
        lines.push(`LH-DIAG mobile-${run.run} ${JSON.stringify(line)}`);
      detailed = true;
    }
    lines.push(`LH-TBT mobile-${run.run} ${JSON.stringify(digestBlocking(report))}`);
  }
  const lantern = await readJson(resolve(directory, "mobile-home-1.lantern.json"));
  if (lantern) lines.push(`LH-LANTERN ${JSON.stringify(digestLantern(lantern))}`);
  return lines;
}
