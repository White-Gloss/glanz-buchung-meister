import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { filterIndexableSitemap } from "./seo-policy.ts";
import { seoIntents } from "./seo-intents.ts";
import { cities } from "../data/site.ts";
import { citySeoCopy } from "./city-copy.ts";
import { publicSeo } from "./seo-policy.ts";

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

test("each pickup city has an indexable vehicle-detailing keyword destination", () => {
  for (const city of cities) {
    const copy = citySeoCopy(city);
    const path = `/abholservice/${city.slug}`;
    assert.equal(publicSeo(path).status, "index");
    assert.match(copy.heading, /Fahrzeugaufbereitung/);
    assert.ok(copy.heading.includes(city.name));
    assert.ok(copy.description.includes(city.name));
    assert.match(copy.description, /Werkstatt in Horb/);
    assert.equal(seoIntents[path].cluster, copy.cluster);
    if (city.slug !== "horb-am-neckar") {
      assert.ok(copy.title.startsWith(`Fahrzeugaufbereitung ${city.name}`));
      assert.equal(copy.linkLabel, `Fahrzeugaufbereitung ${city.name}`);
      assert.equal(copy.cluster, `fahrzeugaufbereitung ${city.name.toLowerCase()}`);
    }
  }
});
