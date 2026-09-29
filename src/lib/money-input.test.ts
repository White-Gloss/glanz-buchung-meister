import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEuroInput } from "./money-input.ts";

test("payment amounts keep decimal points and German separators", () => {
  assert.equal(parseEuroInput("1.50"), 150);
  assert.equal(parseEuroInput("1,50"), 150);
  assert.equal(parseEuroInput("178,00"), 17_800);
  assert.equal(parseEuroInput("178"), 17_800);
  assert.equal(parseEuroInput("1.234,56"), 123_456);
  assert.equal(parseEuroInput("1.234"), 123_400);
  assert.equal(parseEuroInput(" 329,00 € "), 32_900);
  for (const bad of ["", "0", "0,00", "1,5,0", "1.2.3", "12.345.6", "1,234.56", "-5", "abc"])
    assert.equal(parseEuroInput(bad), null, bad);
});
