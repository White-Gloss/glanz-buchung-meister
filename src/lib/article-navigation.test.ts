import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { articleBookingSelection, articleNavigation } from "./article-navigation.ts";
import { services, quoteTotal } from "../data/site.ts";

test("every published guide has a valid, distinct intent and a real service destination", () => {
  const source = readFileSync(new URL("../data/ratgeber.ts", import.meta.url), "utf8");
  const slugs = [...source.matchAll(/slug: "([^"]+)"/g)].map((m) => m[1]);
  assert.equal(slugs.length, 13);
  assert.deepEqual(Object.keys(articleNavigation).sort(), slugs.sort());
  assert.equal(new Set(Object.values(articleNavigation).map((a) => a.question)).size, 13);
  for (const [slug, guide] of Object.entries(articleNavigation)) {
    assert.ok(services.some((s) => s.slug === guide.service), slug);
    assert.ok(guide.title.length <= 65, guide.title);
    for (const related of guide.related) assert.ok(slugs.includes(related) && related !== slug);
  }
});

test("ceramic guides preserve package and pickup/class arithmetic", () => {
  for (const slug of Object.keys(articleNavigation).filter((s) => s.startsWith("keramik"))) {
    assert.deepEqual(articleBookingSelection(slug), { paket: "keramik" });
  }
  assert.equal(quoteTotal({ packageId: "keramik", classId: "suv", citySlug: "nagold", extraIds: [] }).total, 1123.75);
  assert.equal(quoteTotal({ packageId: "basis", classId: "kompakt", citySlug: "nagold", extraIds: [] }).total, 199);
  assert.equal(quoteTotal({ packageId: "basis", classId: "kompakt", citySlug: "sindelfingen", extraIds: [] }).pickupOnRequest, true);
});

test("individual and general articles do not pretend an unrelated package was selected", () => {
  assert.deepEqual(articleBookingSelection("innenraumreinigung-gerueche"), { leistung: "geruchsneutralisation" });
  assert.deepEqual(articleBookingSelection("leasingrueckgabe-checkliste"), { leistung: "leasingrueckgabe" });
  assert.deepEqual(articleBookingSelection("hol-und-bringservice"), {});
  assert.deepEqual(articleBookingSelection("unknown-cms-article"), {});
});
