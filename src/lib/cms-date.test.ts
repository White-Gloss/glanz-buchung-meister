import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cmsPublishedDate } from "./cms-date.ts";

describe("CMS publication dates", () => {
  it("formats pg Date objects as ISO calendar dates", () => {
    assert.equal(cmsPublishedDate(new Date("2026-09-06T10:00:00Z")), "2026-09-06");
  });

  it("normalizes serialized timestamps to the same UTC date", () => {
    assert.equal(cmsPublishedDate("2026-09-06T10:00:00.000Z"), "2026-09-06");
    assert.equal(cmsPublishedDate("2026-09-06T00:30:00+02:00"), "2026-09-05");
    assert.equal(cmsPublishedDate("2026-09-06"), "2026-09-06");
  });

  it("omits absent or invalid dates from JSON-LD without inventing a date", () => {
    for (const value of [null, undefined, "", "   ", "invalid", new Date(NaN)]) {
      assert.equal(cmsPublishedDate(value), undefined);
      assert.equal(JSON.stringify({ datePublished: cmsPublishedDate(value) }), "{}");
    }
  });
});
