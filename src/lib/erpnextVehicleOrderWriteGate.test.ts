import { describe, expect, it } from "vitest";

import {
  evaluateVehicleOrderWriteGate,
  getVehicleOrderWriteGateStatus,
  issueVehicleOrderWriteConfirmation,
  verifyVehicleOrderWriteConfirmation,
} from "../../supabase/functions/_shared/erpnextVehicleOrderWriteGate";

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_BOOKING_ID = "22222222-2222-4222-8222-222222222222";
const BOOKING_REVISION = "2026-08-24T10:00:00.000Z";
const OTHER_REVISION = "2026-08-24T10:01:00.000Z";
const SECRET = "server-only-test-secret";
const NOW_MS = Date.parse("2026-08-24T10:02:00.000Z");
const NONCE = "test-nonce-1234567890";

const issueConfirmation = () =>
  issueVehicleOrderWriteConfirmation({
    secret: SECRET,
    bookingId: BOOKING_ID,
    bookingRevision: BOOKING_REVISION,
    nowMs: NOW_MS,
    nonce: NONCE,
  });

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
      confirmationValid: true,
    });

    expect(result.ready).toBe(false);
    expect(result.error).toBe("production_write_booking_not_approved");
  });

  it("issues an opaque server-signed confirmation for one booking revision", async () => {
    const confirmation = await issueConfirmation();

    expect(confirmation).not.toContain(BOOKING_ID);
    await expect(
      verifyVehicleOrderWriteConfirmation({
        secret: SECRET,
        bookingId: BOOKING_ID,
        bookingRevision: BOOKING_REVISION,
        confirmation,
        nowMs: NOW_MS + 60_000,
      }),
    ).resolves.toBe(true);
  });

  it("rejects a confirmation for a different booking or revision", async () => {
    const confirmation = await issueConfirmation();

    await expect(
      verifyVehicleOrderWriteConfirmation({
        secret: SECRET,
        bookingId: OTHER_BOOKING_ID,
        bookingRevision: BOOKING_REVISION,
        confirmation,
        nowMs: NOW_MS + 60_000,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyVehicleOrderWriteConfirmation({
        secret: SECRET,
        bookingId: BOOKING_ID,
        bookingRevision: OTHER_REVISION,
        confirmation,
        nowMs: NOW_MS + 60_000,
      }),
    ).resolves.toBe(false);
  });

  it("rejects a forged, expired or missing confirmation", async () => {
    const confirmation = await issueConfirmation();

    await expect(
      verifyVehicleOrderWriteConfirmation({
        secret: "different-server-secret",
        bookingId: BOOKING_ID,
        bookingRevision: BOOKING_REVISION,
        confirmation,
        nowMs: NOW_MS + 60_000,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyVehicleOrderWriteConfirmation({
        secret: SECRET,
        bookingId: BOOKING_ID,
        bookingRevision: BOOKING_REVISION,
        confirmation,
        nowMs: NOW_MS + 5 * 60_000,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyVehicleOrderWriteConfirmation({
        secret: SECRET,
        bookingId: BOOKING_ID,
        bookingRevision: BOOKING_REVISION,
        nowMs: NOW_MS,
      }),
    ).resolves.toBe(false);
  });

  it("passes only with switch, booking allowlist and a verified confirmation", () => {
    const result = evaluateVehicleOrderWriteGate({
      enabledValue: " TRUE ",
      approvedBookingId: ` ${BOOKING_ID} `,
      bookingId: BOOKING_ID,
      confirmationValid: true,
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
