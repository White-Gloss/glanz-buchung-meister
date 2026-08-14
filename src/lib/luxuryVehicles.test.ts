import { describe, expect, it } from "vitest";
import { luxuryVehicleService } from "./luxuryVehicles";

describe("luxuryVehicleService", () => {
  it("positions the service for vehicles from 80,000 euros", () => {
    expect(luxuryVehicleService.minimumVehicleValue).toBe(80_000);
    expect(luxuryVehicleService.minimumVehicleValueLabel).toBe("ab ca. 80.000 € Fahrzeugwert");
  });

  it("requires a phone consultation and an in-person vehicle inspection", () => {
    expect(luxuryVehicleService.bookingMode).toBe("phone-only");
    expect(luxuryVehicleService.requiresInspection).toBe(true);
  });
});
