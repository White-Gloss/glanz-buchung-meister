// Targeted checks for the audited shared templates, against an isolated build.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { cities, services, site } from "../../src/data/site.ts";
import { articleNavigation } from "../../src/lib/article-navigation.ts";

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:8082";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error("Local server required");
const out = resolve(process.env.AUDIT_OUTPUT || "../audit-content");
await mkdir(out, { recursive: true });
const checks = [];
const get = async (path) => {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  return { html: await response.text(), headers: Object.fromEntries(response.headers) };
};
const text = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const jsonLd = (html) => [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => { const j = JSON.parse(m[1]); return j["@graph"] || [j]; });
const ok = (name, detail = {}) => checks.push({ name, result: "pass", ...detail });

try {
  for (const service of services) {
    const { html } = await get(`/leistungen/${service.slug}`);
    const data = jsonLd(html);
    assert.ok(data.some((s) => s["@type"] === (service.pendingApproval ? "WebPage" : "Service")), service.slug);
    assert.ok(data.some((s) => s["@type"] === "BreadcrumbList" && s.itemListElement.length === 3));
    const content = text(html);
    assert.ok(!content.includes("Std.."));
    if (service.fromPrice) assert.match(content, /Kompaktklasse/);
    if (service.slug === "innenraumreinigung") assert.match(content, /textile Tiefenreinigung.*Reinigung &amp; Politur.*349/);
    if (service.pendingApproval) {
      assert.match(content, /nicht buchbar/);
      assert.ok(!content.includes("ab 99"));
      assert.ok(!data.some((d) => d["@type"] === "Service"));
    }
    ok(`Main service ${service.slug}: schema, scope and price basis`);
  }
  // The known 10 x 13 templates are checked for the audited invariants, not crawled anew.
  for (const service of services) {
    await Promise.all(cities.map(async (city) => {
      const { html } = await get(`/leistungen/${service.slug}/${city.slug}`);
      const content = text(html);
      assert.ok(!content.includes("MwSt., Im Paket"));
      assert.ok(content.includes(city.name));
      assert.ok(content.includes(`Abholbedingungen für ${city.name}`));
      assert.ok(content.includes(site.street));
      assert.ok(jsonLd(html).some((d) => d["@type"] === "BreadcrumbList"));
      if (service.pendingApproval) {
        assert.match(content, /nicht buchbar/);
        assert.ok(!/ab 99|UV-Schutz gegen/.test(content));
      }
    }));
    ok(`All 13 city outputs for ${service.slug}: punctuation, pickup, preserved URLs`);
  }
  const articleSource = await readFile("src/data/ratgeber.ts", "utf8");
  for (const [slug, guide] of Object.entries(articleNavigation)) {
    const { html } = await get(`/ratgeber/${slug}`);
    const data = jsonLd(html).find((d) => d["@type"] === "Article");
    assert.ok(data, slug);
    assert.ok(html.includes(`<meta property="og:image" content="${data.image}"`), slug);
    assert.ok(html.includes(guide.title.replaceAll("&", "&amp;")), slug);
    assert.ok(html.includes(`/leistungen/${guide.service}`), slug);
    for (const related of guide.related) assert.ok(html.includes(`/ratgeber/${related}`));
    assert.ok(articleSource.includes(slug));
    const imagePath = new URL(data.image).pathname;
    assert.equal((await fetch(base + imagePath, { method: "HEAD" })).status, 200, imagePath);
    ok(`Guide ${slug}: title, relevant links, same approved OG/Article image`);
  }
  const sitemap = (await get("/sitemap.xml")).html;
  assert.equal([...sitemap.matchAll(/<loc>/g)].length, 185);
  assert.ok(!sitemap.includes("<lastmod>"));
  for (const path of ["barrierefreiheit", "datenloeschung"]) assert.ok(sitemap.includes(`${site.origin}/${path}</loc>`));
  ok("Sitemap: 185 unique static URLs, no unreliable lastmod");
  const privacy = text((await get("/datenschutz")).html);
  assert.match(privacy, /Cookie-Einstellungen/);
  assert.ok(!privacy.includes("localStorage-Eintrag"));
  const accessibility = text((await get("/barrierefreiheit")).html);
  assert.match(accessibility, /MLBF/);
  assert.ok(!/LZ-BARR|Schlichtung nach BGG/.test(accessibility));
  ok("Legal UI corrections: withdrawal control and relevant authority");
  const home = await get("/");
  const trial = home.headers["content-security-policy-report-only"];
  assert.ok(trial);
  assert.ok(!/unsafe-eval|wasm-unsafe-eval|https:\/\/grok.com|connect-src[^;]*\bws:/.test(trial));
  assert.match(home.headers["content-security-policy"], /unsafe-eval/);
  assert.ok(!jsonLd(home.html).some((j) => JSON.stringify(j).includes('Scheinwerfer')));
  assert.match(home.headers["content-security-policy"], /media-src 'self' blob:/);
  ok("CSP tightening is Report-Only; existing script policy preserved; local video blobs permitted", { policy: trial });
  await writeFile(resolve(out, "results.json"), JSON.stringify({ checks, status: "passed" }, null, 2));
  console.log(`${checks.length} content/template checks passed`);
} catch (error) {
  await writeFile(resolve(out, "results.json"), JSON.stringify({ checks, status: "failed", error: error.stack }, null, 2));
  throw error;
}
