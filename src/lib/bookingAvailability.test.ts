import { describe, expect, it } from "vitest";

import { isOnlineBookingDay } from "./bookingAvailability";

describe("isOnlineBookingDay", () => {
  it("allows weekdays for online booking", () => {
    expect(isOnlineBookingDay(new Date(2026, 7, 14))).toBe(true); // Friday
  });

  it("blocks Saturdays and Sundays for online booking", () => {
    expect(isOnlineBookingDay(new Date(2026, 7, 15))).toBe(false); // Saturday
    expect(isOnlineBookingDay(new Date(2026, 7, 16))).toBe(false); // Sunday
  });
});
