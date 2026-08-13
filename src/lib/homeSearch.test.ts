import { describe, expect, it } from "vitest";

import { parseHomeSearch } from "./homeSearch";

describe("parseHomeSearch", () => {
  it("accepts a valid package for SSR-safe preselection", () => {
    expect(parseHomeSearch({ paket: "premium" })).toEqual({ paket: "premium" });
  });

  it("drops unknown or non-string package values", () => {
    expect(parseHomeSearch({ paket: "unbekannt" })).toEqual({});
    expect(parseHomeSearch({ paket: ["premium"] })).toEqual({});
  });
});
