import { describe, expect, it } from "vitest";

import {
  buildVehicleOrderWriteConfirmation,
  evaluateVehicleOrderWriteGate,
  getVehicleOrderWriteGateStatus,
} from "../../supabase/functions/_shared/erpnextVehicleOrderWriteGate";

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_BOOKING_ID = "22222222-2222-4222-8222-222222222222";
const BOOKING_REVISION = "2026-08-24T10:00:00.000Z";
const OTHER_REVISION = "2026-08-24T10:01:00.000Z";

describe("ERPNext vehicle/order production write gate", () => {
  it("is default-deny when the server switch is missing", () => {
    expect(
      getVehicleOrderWriteGateStatus({
        bookingId: BOOKING_ID,
        approvedBookingId: BOOKING_ID,
      }),
    ).toEqual({ enabled: false, bookingApproved: true, ready: false });
  });

  it("does not approve a different booking", () => {
    const result = evaluateVehicleOrderWriteGate({
      enabledValue: "true",
      approvedBookingId: OTHER_BOOKING_ID,
      bookingId: BOOKING_ID,
      bookingRevision: BOOKING_REVISION,
      confirmation: buildVehicleOrderWriteConfirmation(BOOKING_ID, BOOKING_REVISION),
    });

    expect(result.ready).toBe(false);
    expect(result.error).toBe("production_write_booking_not_approved");
  });

  it("binds the confirmation to the exact booking", () => {
    const result = evaluateVehicleOrderWriteGate({
      enabledValue: "true",
      approvedBookingId: BOOKING_ID,
      bookingId: BOOKING_ID,
      bookingRevision: BOOKING_REVISION,
      confirmation: buildVehicleOrderWriteConfirmation(OTHER_BOOKING_ID, BOOKING_REVISION),
    });

    expect(result.ready).toBe(false);
    expect(result.confirmationValid).toBe(false);
    expect(result.error).toBe("explicit_write_confirmation_required");
  });

  it("invalidates the confirmation when the booking revision changes", () => {
    const result = evaluateVehicleOrderWriteGate({
      enabledValue: "true",
      approvedBookingId: BOOKING_ID,
      bookingId: BOOKING_ID,
      bookingRevision: OTHER_REVISION,
      confirmation: buildVehicleOrderWriteConfirmation(BOOKING_ID, BOOKING_REVISION),
    });

    expect(result.ready).toBe(false);
    expect(result.confirmationValid).toBe(false);
    expect(result.error).toBe("explicit_write_confirmation_required");
  });

  it("rejects an empty booking revision", () => {
    const result = evaluateVehicleOrderWriteGate({
      enabledValue: "true",
      approvedBookingId: BOOKING_ID,
      bookingId: BOOKING_ID,
      bookingRevision: "",
      confirmation: buildVehicleOrderWriteConfirmation(BOOKING_ID, ""),
    });

    expect(result.ready).toBe(false);
    expect(result.error).toBe("explicit_write_confirmation_required");
  });

  it("passes only with switch, booking allowlist and matching confirmation", () => {
    const result = evaluateVehicleOrderWriteGate({
      enabledValue: " TRUE ",
      approvedBookingId: ` ${BOOKING_ID} `,
      bookingId: BOOKING_ID,
      bookingRevision: BOOKING_REVISION,
      confirmation: buildVehicleOrderWriteConfirmation(BOOKING_ID, BOOKING_REVISION),
    });

    expect(result).toEqual({
      enabled: true,
      bookingApproved: true,
      ready: true,
      confirmationValid: true,
      error: null,
    });
  });
});
