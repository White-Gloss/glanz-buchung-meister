import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  cities,
  extras,
  packages,
  pickupFee,
  pickupKeramikNote,
  pickupPricing,
  pickupPriceText,
  pickupTierSummary,
  quoteTotal,
} from "./site.ts";

const srcRoot = fileURLToPath(new URL("..", import.meta.url));

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(extname(name))) acc.push(full);
  }
  return acc;
}

describe("pickup pricing source of truth", () => {
  it("derives fees only from pickupPricing.tiers", () => {
    assert.equal(pickupFee(0), 0);
    assert.equal(pickupFee(10), 0);
    assert.equal(pickupFee(11), 50);
    assert.equal(pickupFee(20), 50);
    assert.equal(pickupFee(21), 70);
    assert.equal(pickupFee(50), 70);
    assert.equal(pickupFee(51), null);
    assert.equal(pickupFee(52, "keramik"), 0);
    assert.equal(pickupFee(61, "keramik"), null);
    for (const tier of pickupPricing.tiers) {
      assert.equal(pickupFee(tier.maxKm), tier.amount);
    }
  });

  it("builds the public staffel text from the same table", () => {
    const summary = pickupTierSummary();
    for (const tier of pickupPricing.tiers) {
      assert.match(summary, new RegExp(`bis ${tier.maxKm} km`, "i"));
      if (tier.amount === 0) assert.match(summary, /kostenlos/);
      else assert.ok(summary.includes(String(tier.amount)));
    }
    assert.match(summary, /darüber auf Anfrage/);
    assert.match(summary, /^Bis /);
    assert.ok(pickupKeramikNote().includes(String(pickupPricing.freeUpToKm)));
  });

  it("keeps city blurbs free of hardcoded euro amounts", () => {
    for (const city of cities) {
      assert.equal(
        /\d+\s*€|\d+\s*Euro/.test(city.blurb),
        false,
        `${city.name}: Preis gehört in pickupPricing, nicht in den Blurb`,
      );
    }
  });

  it("treats unknown city slugs as on request, not free", () => {
    const quote = quoteTotal({
      packageId: "basis",
      classId: "kompakt",
      extraIds: [],
      citySlug: "not-a-city",
    });
    assert.equal(quote.pickup, null);
    assert.equal(quote.pickupOnRequest, true);
  });

  it("prices the six areas added on 07.10.2026 from their measured town-centre distance", () => {
    // Rounded-up Google Maps route distances from Arnistal 27 to the town centre (03.11.2026).
    const measured: Record<string, { km: number; minutes: number; basis: number; keramik: number }> = {
      empfingen: { km: 10, minutes: 12, basis: 0, keramik: 0 },
      schopfloch: { km: 11, minutes: 11, basis: 50, keramik: 0 },
      "sulz-am-neckar": { km: 12, minutes: 13, basis: 50, keramik: 0 },
      voehringen: { km: 17, minutes: 19, basis: 50, keramik: 0 },
      dornstetten: { km: 19, minutes: 19, basis: 50, keramik: 0 },
      dornhan: { km: 20, minutes: 23, basis: 50, keramik: 0 },
    };
    for (const [slug, expected] of Object.entries(measured)) {
      const city = cities.find((item) => item.slug === slug);
      assert.ok(city, slug);
      assert.equal(city.km, expected.km, slug);
      assert.equal(city.minutes, expected.minutes, slug);
      assert.equal(pickupFee(city.km, "basis"), expected.basis, slug);
      assert.equal(pickupFee(city.km, "keramik"), expected.keramik, slug);
      for (const { id: packageId } of packages) {
        const quote = quoteTotal({ packageId, classId: "kompakt", extraIds: [], citySlug: slug });
        assert.equal(quote.pickupOnRequest, false, `${slug} ${packageId}`);
        assert.equal(quote.pickup, packageId === "keramik" ? expected.keramik : expected.basis, `${slug} ${packageId}`);
        assert.equal(quote.total, quote.subtotal + (quote.pickup ?? 0));
      }
      assert.ok(city.pickupNote?.includes("Ortsmitte"), `${slug} names the town centre`);
    }
  });

  it("never prices an unknown or invalid distance", () => {
    for (const invalid of [null, NaN, Infinity, -1]) {
      assert.equal(pickupFee(invalid, "keramik"), null);
      assert.equal(pickupPriceText(invalid, "keramik"), "auf Anfrage");
    }
  });

  it("does not leave a second hardcoded pickup staffel in source", () => {
    const files = walk(srcRoot).filter((file) => !file.endsWith(".test.ts"));
    const banned = [
      /bis 20 km 50 Euro/i,
      /bis 50 km 70 Euro/i,
      /bis 20 km 50 €/,
      /bis 50 km 70 €/,
      /bis 10 km 20/,
      /10 km.{0,24}20,?0{0,2}\s*€/,
      /20,00\s*€.{0,24}10 km/,
    ];
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of banned) {
        if (pattern.test(text)) hits.push(`${file}: ${pattern}`);
      }
    }
    assert.deepEqual(hits, []);
  });

  it("marks pickup beyond 50 km as on request, except Keramik up to 60 km", () => {
    const sindelfingen = cities.find((city) => city.slug === "sindelfingen");
    assert.ok(sindelfingen);
    const basis = quoteTotal({
      packageId: "basis",
      classId: "kompakt",
      extraIds: [],
      citySlug: sindelfingen.slug,
    });
    assert.equal(basis.pickup, null);
    assert.equal(basis.pickupOnRequest, true);
    const keramik = quoteTotal({
      packageId: "keramik",
      classId: "kompakt",
      extraIds: [],
      citySlug: sindelfingen.slug,
    });
    assert.equal(keramik.pickup, 0);
    assert.equal(keramik.pickupOnRequest, false);
  });

  it("does not advertise obsolete extra prices", () => {
    const ozon = extras.find((item) => item.id === "ozon");
    const leder = extras.find((item) => item.id === "leder");
    assert.equal(ozon?.price, 99);
    assert.equal(leder?.price, 149);
    const files = walk(srcRoot).filter((file) => !file.endsWith(".test.ts"));
    const stale = [
      /59 Euro/i,
      /Ozonbehandlung für 59/,
      /Lederpflege Deluxe kostet zusätzlich 119/,
      /Keramik 5 Jahre/,
      /5-Jahres-Beschichtung extra/,
    ];
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of stale) {
        if (pattern.test(text)) hits.push(`${file}: ${pattern}`);
      }
    }
    assert.deepEqual(hits, []);
  });
});
