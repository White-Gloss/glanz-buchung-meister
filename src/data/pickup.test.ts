import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  cities,
  extras,
  pickupFee,
  pickupKeramikNote,
  pickupPricing,
  pickupTierSummary,
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
      assert.match(summary, new RegExp(`bis ${tier.maxKm} km`));
      if (tier.amount === 0) assert.match(summary, /kostenlos/);
      else assert.ok(summary.includes(String(tier.amount)));
    }
    assert.match(summary, /darüber auf Anfrage/);
    assert.ok(pickupKeramikNote().includes(String(pickupPricing.freeUpToKm)));
  });

  it("keeps city blurbs aligned with pickupFee", () => {
    for (const city of cities) {
      const fee = pickupFee(city.km);
      const euros = [...city.blurb.matchAll(/(\d+)\s*€/g)].map((m) => Number(m[1]));
      for (const amount of euros) {
        if (amount === pickupPricing.freeUpToKm) continue;
        assert.equal(
          amount,
          fee,
          `${city.name}: Blurb-Preis ${amount} € weicht von pickupFee(${city.km})=${fee} ab`,
        );
      }
    }
  });

  it("does not leave a second hardcoded pickup staffel in source", () => {
    const files = walk(srcRoot).filter((file) => !file.endsWith(".test.ts"));
    const banned = [
      /bis 20 km 50 Euro/i,
      /bis 50 km 70 Euro/i,
      /bis 20 km 50 €/,
      /bis 50 km 70 €/,
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

  it("does not advertise obsolete extra prices", () => {
    const ozon = extras.find((item) => item.id === "ozon");
    const leder = extras.find((item) => item.id === "leder");
    assert.equal(ozon?.price, 99);
    assert.equal(leder?.price, 149);
    const files = walk(srcRoot).filter((file) => !file.endsWith(".test.ts"));
    const stale = [/59 Euro/i, /Ozonbehandlung für 59/, /Lederpflege Deluxe kostet zusätzlich 119/];
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
