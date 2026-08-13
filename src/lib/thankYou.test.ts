import { describe, expect, it } from "vitest";

import { buildThankYouSearch } from "./thankYou";

describe("buildThankYouSearch", () => {
  it("creates a privacy-conscious thank-you URL from a booking reference and name", () => {
    expect(
      buildThankYouSearch({ invoiceNumber: "WGD-2026-1001", customerName: "Max Mustermann" }),
    ).toBe("?nr=WGD-2026-1001&name=Max");
  });

  it("omits an unusable first name", () => {
    expect(buildThankYouSearch({ invoiceNumber: "WGD-2026-1001", customerName: "   " })).toBe(
      "?nr=WGD-2026-1001",
    );
  });
});
