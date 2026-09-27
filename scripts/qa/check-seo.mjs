// Read-only HTTP crawl. Does not launch a browser/server or submit a form.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { assertIsolatedGithubCi } from "../hosting-policy.mjs";
import { publicSeo, filterIndexableSitemap } from "../../src/lib/seo-policy.ts";
import { seoIntents } from "../../src/lib/seo-intents.ts";
import { site } from "../../src/data/site.ts";
import { qaBase } from "./ports.mjs";

const live = process.argv.includes("--live");
if (!live) assertIsolatedGithubCi();
const base = live ? site.origin : qaBase;
const output = resolve(process.env.SEO_OUTPUT_DIR || ".qa-output");
const inventory = await readFile(
  new URL("../../src/data/sitemap-static.xml", import.meta.url),
  "utf8",
);
const locations = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const paths = locations(inventory).map((url) => new URL(url).pathname);
const expectedSitemap = new Set(locations(filterIndexableSitemap(inventory)));
const failures = [];
const pages = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};
const decode = (text) =>
  text.replace(
    /&(?:amp|quot|#x27|#39|apos|nbsp|lt|gt);/g,
    (m) =>
      ({
        "&amp;": "&",
        "&quot;": '"',
        "&#x27;": "'",
        "&#39;": "'",
        "&apos;": "'",
        "&nbsp;": " ",
        "&lt;": "<",
        "&gt;": ">",
      })[m],
  );
const attr = (tag, name) => decode(new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag)?.[1] || "");
const plain = (html) =>
  decode(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
const get = (path) =>
  fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(15000) });

const sitemapResponse = await get("/sitemap.xml");
check(sitemapResponse.status === 200, "sitemap status");
const sitemapUrls = locations(await sitemapResponse.text());
check(new Set(sitemapUrls).size === sitemapUrls.length, "duplicate sitemap URLs");
for (const url of expectedSitemap) check(sitemapUrls.includes(url), `missing sitemap URL: ${url}`);
for (const url of sitemapUrls) {
  const parsed = new URL(url);
  check(
    parsed.origin === site.origin &&
      !parsed.search &&
      !parsed.hash &&
      publicSeo(parsed.pathname).status === "index",
    `invalid sitemap URL: ${url}`,
  );
  if (!paths.includes(parsed.pathname)) paths.push(parsed.pathname); // Published CMS articles too.
}

// Four bounded workers: avoid a burst of 185 concurrent production requests.
let next = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (next < paths.length) {
      const path = paths[next++];
      try {
        const response = await get(path);
        const decision = publicSeo(path);
        if (decision.status === "redirect") {
          const target = new URL(response.headers.get("location") || "/", base).pathname;
          check(
            response.status === 301 && target === decision.target,
            `${path}: wrong 301 target/status`,
          );
          check(publicSeo(target).status !== "redirect", `${path}: redirect chain`);
          pages.push({ path, status: response.status, seo: decision.status, target });
          await response.body?.cancel();
          continue;
        }
        const html = await response.text();
        const tags = [...html.matchAll(/<meta\b[^>]*>/g)].map((m) => m[0]);
        const meta = (key) =>
          tags
            .filter((tag) => attr(tag, "name") === key || attr(tag, "property") === key)
            .map((tag) => attr(tag, "content"));
        const titles = [...html.matchAll(/<title>([\s\S]*?)<\/title>/g)].map((m) => decode(m[1]));
        const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => plain(m[1]));
        const canonical = [...html.matchAll(/<link\b[^>]*>/g)]
          .filter((m) => attr(m[0], "rel") === "canonical")
          .map((m) => attr(m[0], "href"));
        const schemas = [
          ...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
        ].map((m) => JSON.parse(m[1]));
        const outgoing = [
          ...new Set(
            [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].flatMap((m) => {
              try {
                const u = new URL(decode(m[1]), site.origin + path);
                return u.origin === site.origin ? [u.pathname] : [];
              } catch {
                return [];
              }
            }),
          ),
        ];
        check(response.status === 200, `${path}: status ${response.status}`);
        check(titles.length === 1 && !!titles[0], `${path}: one nonempty title required`);
        check(
          meta("description").length === 1 && !!meta("description")[0],
          `${path}: one description required`,
        );
        check(h1.length === 1 && !!h1[0], `${path}: one H1 required`);
        check(
          canonical.length === 1 && canonical[0] === site.origin + path,
          `${path}: self canonical required`,
        );
        check(
          meta("robots").length === 1 &&
            (decision.status === "index" ? /^index(?:,|$)/ : /^noindex(?:,|$)/).test(
              meta("robots")[0],
            ),
          `${path}: robots conflicts with policy`,
        );
        check(
          !response.headers.get("x-robots-tag")?.includes("noindex") ||
            decision.status === "noindex",
          `${path}: conflicting X-Robots-Tag`,
        );
        check(
          meta("og:url")[0] === site.origin + path && !!meta("og:image")[0],
          `${path}: OG URL/image missing`,
        );
        if (path === "/" || /^\/(leistungen|abholservice|ratgeber)\//.test(path))
          check(schemas.length > 0, `${path}: missing JSON-LD`);
        const walk = (node) => {
          if (!node || typeof node !== "object") return;
          if (node.address?.addressLocality)
            check(node.address.addressLocality === site.city, `${path}: non-Horb business address`);
          check(!node.aggregateRating, `${path}: unverified aggregate rating`);
          for (const child of Object.values(node))
            if (child && typeof child === "object") walk(child);
        };
        schemas.forEach(walk);
        const text = plain(/<main\b[^>]*>([\s\S]*?)<\/main>/.exec(html)?.[1] || "");
        pages.push({
          path,
          status: response.status,
          seo: decision.status,
          title: titles[0],
          description: meta("description")[0],
          h1: h1[0],
          canonical: canonical[0],
          robots: meta("robots")[0],
          schemas: schemas.length,
          outgoing,
          text,
          intent: seoIntents[path],
        });
      } catch (error) {
        failures.push(`${path}: ${error.message}`);
      }
    }
  }),
);
const indexable = pages.filter((p) => p.seo === "index");
for (const key of ["title", "description"]) {
  const seen = new Map();
  for (const page of indexable) {
    check(!seen.has(page[key]), `duplicate ${key}: ${page.path} / ${seen.get(page[key])}`);
    seen.set(page[key], page.path);
  }
}
for (const page of indexable) {
  page.incoming = pages
    .filter(
      (source) =>
        source.path !== page.path && source.seo === "index" && source.outgoing?.includes(page.path),
    )
    .map((source) => source.path);
  check(page.incoming.length > 0, `${page.path}: no incoming link from an indexable page`);
}
// Similarity is a diagnostic, not a ranking factor or a word-count threshold.
const shingles = (text) => {
  const words = text.toLowerCase().split(/\s+/);
  return new Set(words.slice(0, -4).map((_, i) => words.slice(i, i + 5).join(" ")));
};
const local = pages.filter(
  (p) => /\/(abholservice|leistungen)\/[^/]+(?:\/[^/]+)?$/.test(p.path) && p.text,
);
const similarity = [];
for (let i = 0; i < local.length; i++)
  for (let j = i + 1; j < local.length; j++) {
    const a = local[i],
      b = local[j];
    if (a.path.split("/").slice(0, -1).join("/") !== b.path.split("/").slice(0, -1).join("/"))
      continue;
    const sa = shingles(a.text),
      sb = shingles(b.text);
    const intersection = [...sa].filter((s) => sb.has(s)).length;
    const score = intersection / (sa.size + sb.size - intersection || 1);
    if (score >= 0.7)
      similarity.push({
        a: a.path,
        b: b.path,
        similarity: Math.round(score * 1000) / 1000,
        bothIndexable: a.seo === "index" && b.seo === "index",
      });
  }
const report = {
  checkedAt: new Date().toISOString(),
  base,
  requests: paths.length,
  sitemapUrls: sitemapUrls.length,
  indexable: indexable.length,
  failures,
  similarity,
  pages: pages
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(({ text, ...p }) => ({ ...p, words: text?.split(/\s+/).length })),
};
await mkdir(output, { recursive: true });
await writeFile(resolve(output, "seo-results.json"), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    requests: paths.length,
    sitemapUrls: sitemapUrls.length,
    failures,
    similarityPairs: similarity.length,
  }),
);
assert.equal(failures.length, 0, "SEO crawl failed; see seo-results.json");
