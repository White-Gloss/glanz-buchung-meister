import { describe, expect, it } from "vitest";
import { bookingProgress } from "./bookingProgress";

describe("bookingProgress", () => {
  it("creates an accessible one-based progress description", () => {
    const first = bookingProgress(0, 6);
    expect(first).toMatchObject({
      now: 1,
      min: 1,
      max: 6,
      label: "Schritt 1 von 6",
    });
    expect(first.percent).toBeCloseTo(100 / 6);
    expect(bookingProgress(5, 6).percent).toBe(100);
  });
});
