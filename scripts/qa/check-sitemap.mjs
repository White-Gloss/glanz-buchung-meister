import { qaBase, controlBase } from "./ports.mjs";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = qaBase;
assert.deepEqual(await fetch(controlBase + "/identity").then((r) => r.json()), {
  isolated: true,
  database: "in-memory-pglite",
  externalFetch: "blocked",
});
const fixture = (published) =>
  fetch(controlBase + "/cms-fixture", {
    method: "POST",
    body: JSON.stringify({ published }),
  });
const control = (flags) =>
  fetch(controlBase + "/control", { method: "POST", body: JSON.stringify(flags) });
const get = async () => {
  const res = await fetch(base + "/sitemap.xml");
  return {
    status: res.status,
    cache: res.headers.get("cache-control"),
    type: res.headers.get("content-type"),
    xml: await res.text(),
  };
};
await fixture(true);
let page = await get();
assert.equal(page.status, 200);
assert.match(page.type, /application\/xml/);
assert.match(page.cache, /no-cache/);
assert.equal([...page.xml.matchAll(/<loc>/g)].length, 186);
assert.ok(page.xml.includes("qa-sitemap-round2"));
assert.ok(!page.xml.includes("qa-draft-round2"));
const article = await fetch(base + "/ratgeber/qa-sitemap-round2");
const html = await article.text();
assert.equal(article.status, 200);
assert.match(html, /<h1[^>]*>QA Sitemap Test/);
assert.match(html, /https:\/\/white-gloss.de\/ratgeber\/qa-sitemap-round2/);
await fixture(false);
page = await get();
assert.equal([...page.xml.matchAll(/<loc>/g)].length, 185);
assert.ok(!page.xml.includes("qa-sitemap-round2"));
await control({ failCms: true });
page = await get();
assert.equal(page.status, 200);
assert.equal(page.cache, "no-store");
assert.equal([...page.xml.matchAll(/<loc>/g)].length, 185);
await control({ failCms: false });
const result = {
  passed: 4,
  checks: [
    "186 URLs after publish; draft excluded",
    "Published article renders heading and canonical",
    "185 URLs immediately after unpublish",
    "CMS failure returns 185 static URLs with no-store",
  ],
};
await writeFile(".qa-output/sitemap-results.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
