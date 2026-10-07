import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { filterIndexableSitemap } from "./seo-policy.ts";
import { cmsSeoIntents, resolveSeoIntent, seoIntents } from "./seo-intents.ts";
import { cities } from "../data/site.ts";
import { cityJourneyText, citySeoCopy } from "./city-copy.ts";
import { parseBookingSelection, serviceBookingSelection } from "./booking-selection.ts";
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

test("published CMS articles require a nonempty provisional or reviewed intent", () => {
  assert.equal(
    resolveSeoIntent("/unknown", { title: "Example", description: "Example" }),
    undefined,
  );
  assert.equal(resolveSeoIntent("/ratgeber/new-guide"), undefined);
  assert.equal(
    resolveSeoIntent("/ratgeber/new-guide", { title: " | White Gloss", description: "Test" }),
    undefined,
  );
  assert.equal(
    resolveSeoIntent("/ratgeber/new-guide", {
      title: "Winterpflege | White Gloss",
      description: "Tipps zur Pflege im Winter",
    })?.cluster,
    "winterpflege",
  );
  cmsSeoIntents["/ratgeber/test-override"] = {
    cluster: "test reviewed cluster",
    intent: "informational",
    purpose: "Synthetic test",
  };
  try {
    assert.equal(resolveSeoIntent("/ratgeber/test-override")?.cluster, "test reviewed cluster");
  } finally {
    delete cmsSeoIntents["/ratgeber/test-override"];
  }
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

test("six new pickup hubs are discoverable and preserve city and package in booking links", () => {
  const xml = filterIndexableSitemap(readFileSync(new URL("../data/sitemap-static.xml", import.meta.url), "utf8"));
  for (const slug of ["sulz-am-neckar", "empfingen", "voehringen", "dornhan", "dornstetten", "schopfloch"]) {
    const city = cities.find((item) => item.slug === slug);
    assert.ok(city, slug);
    assert.ok(xml.includes(`/abholservice/${slug}</loc>`));
    assert.ok(!xml.includes(`/leistungen/keramikversiegelung/${slug}</loc>`));
    assert.equal(cityJourneyText(city), "Entfernung und Fahrzeit nach Abholadresse");
    assert.ok(city.pickupNote?.trim());
    assert.deepEqual(parseBookingSelection(serviceBookingSelection("keramikversiegelung", slug)), { paket: "keramik", ort: slug });
    assert.deepEqual(parseBookingSelection(serviceBookingSelection("lederreparatur", slug)), { leistung: "lederreparatur", ort: slug });
  }
});
