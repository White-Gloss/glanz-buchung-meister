import { describe, expect, it } from "vitest";
import { stepAfterPackageSelection } from "./bookingWizardFlow";

describe("stepAfterPackageSelection", () => {
  it("führt nach der Paketauswahl direkt zur Fahrzeugauswahl", () => {
    expect(stepAfterPackageSelection(0)).toBe(1);
  });

  it("verändert spätere Schritte nicht", () => {
    expect(stepAfterPackageSelection(3)).toBe(3);
  });
});
