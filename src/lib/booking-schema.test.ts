import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicBookingSchema } from "./booking-schema.ts";
import { berlinCalendarDate } from "./ops.ts";

function bookingInput(date?: string) {
  return {
    name: "Testkunde",
    phone: "+491701112233",
    email: "",
    date,
    slot: "09:00",
    note: "",
    packageId: "premium",
    classId: "kompakt",
    extraIds: [],
    citySlug: "horb-am-neckar",
    kind: "booking",
    privacy: true,
    website: "",
  } as const;
}

describe("createPublicBooking past-date validation", () => {
  it("rejects a preferred date before today (Europe/Berlin)", () => {
    const result = publicBookingSchema.safeParse(bookingInput("2000-01-01"));
    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.issues[0]?.message ?? "", /Vergangenheit/);
    }
  });

  it("accepts today and a future date (Europe/Berlin)", () => {
    const today = berlinCalendarDate();
    assert.equal(publicBookingSchema.safeParse(bookingInput(today)).success, true);
    assert.equal(publicBookingSchema.safeParse(bookingInput("2999-12-31")).success, true);
  });

  it("accepts a missing or empty preferred date", () => {
    assert.equal(publicBookingSchema.safeParse(bookingInput(undefined)).success, true);
    assert.equal(publicBookingSchema.safeParse(bookingInput("")).success, true);
  });
});
