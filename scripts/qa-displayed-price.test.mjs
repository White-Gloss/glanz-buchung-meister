import assert from "node:assert/strict";
import test from "node:test";
import { displayedPriceEquals } from "./qa/displayed-price.mjs";

test("the exact booking price accepts display whitespace but never a different amount or currency", () => {
  const original = globalThis.document;
  try {
    for (const [actual, matches] of [["468\u00a0€", true], ["  468\u202f€\n", true], ["468 €", true], ["1468 €", false], ["468 $", false], ["468,01 €", false], ["468 € zzgl.", false], [undefined, false]]) {
      globalThis.document = { querySelector: (selector) => {
        assert.equal(selector, ".booking-price strong");
        return actual === undefined ? null : { textContent: actual };
      } };
      assert.equal(displayedPriceEquals({ selector: ".booking-price strong", expected: "468 €" }), matches, JSON.stringify(actual));
    }
  } finally {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  }
});
