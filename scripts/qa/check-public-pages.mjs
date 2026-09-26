// Read-only audit of every public sitemap route on a locally running build.
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.FRONTEND_BASE_URL || "http://127.0.0.1:8082";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) {
  throw new Error("Use an isolated local build for this audit.");
}
const sitemap = await fetch(`${base}/sitemap.xml`).then((r) => r.text());
const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
if (!paths.length) throw new Error("No public routes found");
const issues = [], pages = [], links = new Set(), idsByPath = new Map();
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
for (const path of paths) {
  const response = await fetch(new URL(path, base));
  const html = await response.text();
  const h1Count = [...html.matchAll(/<h1\b/g)].length;
  const head = html.slice(0, html.indexOf("</head>"));
  const metas = [...head.matchAll(/<meta\b[^>]*>/g)].map((m) => m[0]);
  const canonicals = [...head.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/g)].map((m) => attr(m[0], "href"));
  const canonical = `https://white-gloss.de${path}`;
  const found = [];
  let previousHeading = 0;
  for (const [, level] of html.matchAll(/<h([1-6])\b/g)) {
    if (Number(level) > previousHeading + 1) found.push(`Heading level jumps from ${previousHeading} to ${level}`);
    previousHeading = Number(level);
  }
  if (response.status !== 200) found.push(`HTTP ${response.status}`);
  if (h1Count !== 1) found.push(`${h1Count} H1 elements`);
  if (canonicals.length !== 1 || canonicals[0] !== canonical) found.push("Canonical mismatch");
  if (!metas.some((m) => attr(m, "name") === "description" && attr(m, "content"))) found.push("Missing description");
  for (const property of ["og:title", "og:description", "og:image", "og:url"]) {
    if (!metas.some((m) => attr(m, "property") === property && attr(m, "content"))) found.push(`Missing ${property}`);
  }
  for (const [, json] of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(json); } catch { found.push("Invalid JSON-LD"); }
  }
  for (const [image] of html.matchAll(/<img\b[^>]*>/g)) {
    if (attr(image, "alt") === undefined) found.push(`Image without alt: ${attr(image, "src")}`);
  }
  for (const [link] of html.matchAll(/<a\b[^>]*>/g)) {
    const href = attr(link, "href");
    if (attr(link, "target") === "_blank" && !["noopener", "noreferrer"].every((v) => (attr(link, "rel") || "").split(/\s+/).includes(v))) found.push(`Unsafe external tab: ${href}`);
    if (href?.startsWith("/") || href?.startsWith("#")) links.add(new URL(href.replaceAll("&amp;", "&"), new URL(path, base)).href);
  }
  idsByPath.set(path, new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])));
  if (found.length) issues.push({ path, findings: [...new Set(found)] });
  pages.push({ path, status: response.status, h1Count, canonical: canonicals[0] });
}
const anchorIssues = [];
for (const href of links) {
  const url = new URL(href), ids = idsByPath.get(url.pathname.replace(/\/$/, "") || "/");
  if (url.hash && ids && !ids.has(decodeURIComponent(url.hash.slice(1)))) anchorIssues.push(url.pathname + url.hash);
}
const report = { base, checkedAt: new Date().toISOString(), pageCount: pages.length, internalLinks: links.size, issues, anchorIssues: [...new Set(anchorIssues)], pages };
await mkdir(".qa-output", { recursive: true });
await writeFile(".qa-output/public-pages-audit.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pageCount: pages.length, internalLinks: links.size, issues, anchorIssues: report.anchorIssues }, null, 2));
if (issues.length || anchorIssues.length) process.exitCode = 1;
