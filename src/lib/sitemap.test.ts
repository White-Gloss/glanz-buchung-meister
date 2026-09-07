import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { appendBlogSitemap, blogSitemapUrl, type SitemapBlogRow } from "./sitemap.ts";
import { createSitemapResponder, loadPublishedSitemapBlogs } from "./sitemap.server.ts";
import { responseCacheControl } from "../../server/cache-policy.ts";
import type { Sql } from "./db.ts";

const origin = "https://white-gloss.de";
const staticXml = readFileSync(new URL("../data/sitemap-static.xml", import.meta.url), "utf8");
const row = (slug: string | null): SitemapBlogRow => ({
  slug,
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-06T10:00:00.000Z",
});
const locations = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

describe("CMS sitemap XML", () => {
  it("retains all 183 static URLs and their original metadata", () => {
    assert.equal(locations(staticXml).length, 183);
    assert.equal(new Set(locations(staticXml)).size, 183);
    assert.equal(appendBlogSitemap(staticXml, [], origin), staticXml);
    const output = appendBlogSitemap(staticXml, [row("neuer-beitrag")], origin);
    for (const entry of staticXml.matchAll(/<url>.*?<\/url>/g)) {
      assert.ok(output.includes(entry[0]), entry[0]);
    }
    assert.equal(locations(output).length, 184);
    assert.ok(output.includes(`<loc>${origin}/ratgeber/neuer-beitrag</loc>`));
  });

  it("keeps static collisions and the first duplicate selected by the article loader", () => {
    const first = { ...row("neuer-beitrag"), updated_at: "2026-09-02T10:00:00Z" };
    const second = { ...row("neuer-beitrag"), updated_at: "2026-09-03T10:00:00Z" };
    const collision = row("keramikversiegelung-kosten");
    assert.equal(appendBlogSitemap(staticXml, [collision], origin), staticXml);
    const output = appendBlogSitemap(staticXml, [first, second, collision], origin);
    assert.equal(locations(output).length, 184);
    assert.match(output, /neuer-beitrag<\/loc><lastmod>2026-09-02T10:00:00.000Z/);
    assert.doesNotMatch(output, /2026-09-03T10:00:00.000Z/);
  });

  it("rejects non-routable or noncanonical slugs without changing stored values", () => {
    const invalid = [null, "", " ", " leading", "trailing ", ".", "..", "a/b", "a\\b", "a?b", "a#b", "a%2Fb", "a\nb", "a\u0000b", "\ud800", "x".repeat(81)];
    for (const slug of invalid) assert.equal(blogSitemapUrl(slug, origin), null, String(slug));
    assert.equal(appendBlogSitemap(staticXml, invalid.map(row), origin), staticXml);
  });

  it("round-trips Unicode and reserved XML characters without new elements or origins", () => {
    const slug = `Pflegé & O'Brien <Glanz>"`;
    const url = blogSitemapUrl(slug, origin);
    assert.ok(url);
    assert.equal(new URL(url).origin, origin);
    assert.equal(decodeURIComponent(new URL(url).pathname.slice("/ratgeber/".length)), slug);
    const output = appendBlogSitemap(staticXml, [row(slug)], origin);
    assert.equal(locations(output).length, 184);
    assert.ok(output.includes("&amp;"));
    assert.ok(output.includes("O&apos;Brien"));
    assert.doesNotMatch(output, /<Glanz>/);
    assert.ok(output.endsWith("</urlset>\n"));
  });

  it("handles pg Date objects, creation fallback and invalid dates without inventing dates", () => {
    const output = appendBlogSitemap(staticXml, [
      { ...row("date-object"), updated_at: new Date("2026-09-04T11:12:13Z") },
      { ...row("created-fallback"), updated_at: "not a date" },
      { slug: "no-date", created_at: null, updated_at: new Date(NaN) },
    ], origin);
    assert.match(output, /date-object<\/loc><lastmod>2026-09-04T11:12:13.000Z/);
    assert.match(output, /created-fallback<\/loc><lastmod>2026-09-01T10:00:00.000Z/);
    assert.match(output, /no-date<\/loc><\/url>/);
  });
});

describe("CMS sitemap publication query", () => {
  it("uses the public article tenant, blog filter, publication state and selection order", async () => {
    let statement = "";
    let parameters: unknown[] = [];
    const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
      statement = strings.join("?").replace(/\s+/g, " ").trim();
      parameters = values;
      return Promise.resolve([row("published")]);
    }) as Sql;
    assert.deepEqual(await loadPublishedSitemapBlogs(sql), [row("published")]);
    assert.deepEqual(parameters, ["white-gloss", "blog"]);
    assert.match(statement, /where shop_id = \? and kind = \? and published = true/);
    assert.match(statement, /order by sort asc, id desc$/);
    assert.match(statement, /^select slug, created_at, updated_at from cms_items/);
  });
});

describe("CMS sitemap responses", () => {
  it("observes publication and removal on subsequent requests without serving stale CMS entries", async () => {
    let published = [row("published")];
    let calls = 0;
    const respond = createSitemapResponder({
      staticXml, origin,
      loadPublished: async () => { calls += 1; return published; },
    });
    const first = await respond();
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("content-type"), "application/xml; charset=utf-8");
    assert.equal(first.headers.get("cache-control"), "public, no-cache");
    assert.match(await first.text(), /\/ratgeber\/published<\/loc>/);
    published = [];
    const second = await respond();
    assert.equal(await second.text(), staticXml);
    assert.equal(calls, 2);
  });

  it("serves the complete static sitemap without exposing database errors", async () => {
    let warnings = 0;
    const respond = createSitemapResponder({
      staticXml, origin,
      loadPublished: async () => { throw new Error("Internal database error detail"); },
      onFallback: () => { warnings += 1; },
    });
    const response = await respond();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await response.text(), staticXml);
    assert.equal(warnings, 1);
  });

  it("bounds waiting, shares a hung query across requests and recovers when it settles", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let finish!: (rows: SitemapBlogRow[]) => void;
    let calls = 0;
    let warnings = 0;
    const hung = new Promise<SitemapBlogRow[]>((resolve) => { finish = resolve; });
    const respond = createSitemapResponder({
      staticXml, origin, timeoutMs: 2_000,
      loadPublished: () => { calls += 1; return calls === 1 ? hung : Promise.resolve([row("recovered")]); },
      onFallback: () => { warnings += 1; },
    });
    const first = respond();
    const concurrent = respond();
    await Promise.resolve();
    assert.equal(calls, 1);
    t.mock.timers.tick(2_000);
    for (const response of await Promise.all([first, concurrent])) {
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(await response.text(), staticXml);
    }
    const retryWhileHung = respond();
    t.mock.timers.tick(2_000);
    assert.equal(await (await retryWhileHung).text(), staticXml);
    assert.equal(calls, 1);
    assert.equal(warnings, 1);
    finish([]);
    await new Promise<void>((resolve) => setImmediate(resolve));
    const recovered = await respond();
    assert.ok(locations(await recovered.text()).includes(`${origin}/ratgeber/recovered`));
    assert.equal(calls, 2);
  });

  it("keeps both sitemap cache directives through production middleware", () => {
    for (const existing of ["public, no-cache", "no-store"]) {
      assert.equal(responseCacheControl({ pathname: "/sitemap.xml", contentType: "application/xml", existing }), undefined);
    }
  });
});
