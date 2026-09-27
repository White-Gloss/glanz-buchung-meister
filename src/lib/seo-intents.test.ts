import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { filterIndexableSitemap } from "./seo-policy.ts";
import { seoIntents } from "./seo-intents.ts";

test("each static indexable URL has one distinct primary intent", () => {
  const xml = filterIndexableSitemap(
    readFileSync(new URL("../data/sitemap-static.xml", import.meta.url), "utf8"),
  );
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  assert.deepEqual(Object.keys(seoIntents).sort(), paths.sort());
  const clusters = paths.map((path) => seoIntents[path].cluster);
  assert.equal(
    new Set(clusters).size,
    paths.length,
    "Two URLs must not own the same primary cluster",
  );
  for (const path of paths) assert.ok(seoIntents[path].purpose.trim(), path);
});
