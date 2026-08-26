import { describe, expect, it } from "vitest";

import {
  evaluateCustomerWriteGate,
  getCustomerWriteGateStatus,
  issueCustomerWriteConfirmation,
  verifyCustomerWriteConfirmation,
} from "../../supabase/functions/_shared/erpnextCustomerWriteGate";

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_BOOKING_ID = "22222222-2222-4222-8222-222222222222";
const APPROVAL_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_APPROVAL_ID = "44444444-4444-4444-8444-444444444444";
const BOOKING_REVISION = "2026-08-24T10:00:00.000Z";
const OTHER_REVISION = "2026-08-24T10:01:00.000Z";
const SECRET = "server-only-test-secret";
const NOW_MS = Date.parse("2026-08-24T10:02:00.000Z");
const NONCE = "test-nonce-1234567890";

const issueConfirmation = () =>
  issueCustomerWriteConfirmation({
    secret: SECRET,
    bookingId: BOOKING_ID,
    bookingRevision: BOOKING_REVISION,
    approvalId: APPROVAL_ID,
    nowMs: NOW_MS,
    nonce: NONCE,
  });

describe("ERPNext customer production write gate", () => {
  it("is default-deny when the server switch is missing", () => {
    expect(
      getCustomerWriteGateStatus({
        approvalActive: true,
      }),
    ).toEqual({ enabled: false, bookingApproved: true, ready: false });
  });

  it("requires an active one-time approval", () => {
    const result = evaluateCustomerWriteGate({
      enabledValue: "true",
      approvalActive: false,
      confirmationValid: true,
    });

    expect(result.ready).toBe(false);
    expect(result.error).toBe("customer_write_approval_required");
  });

  it("issues a server-signed confirmation for one booking revision", async () => {
    const confirmation = await issueConfirmation();

    expect(confirmation.split(".")).toHaveLength(3);
    expect(confirmation).toMatch(/^WGCU2\./);
    await expect(
      verifyCustomerWriteConfirmation({
        secret: SECRET,
        bookingId: BOOKING_ID,
        bookingRevision: BOOKING_REVISION,
        approvalId: APPROVAL_ID,
        confirmation,
        nowMs: NOW_MS + 60_000,
      }),
    ).resolves.toBe(true);
  });

  it("rejects a confirmation for a different booking or revision", async () => {
    const confirmation = await issueConfirmation();

    await expect(
      verifyCustomerWriteConfirmation({
        secret: SECRET,
        bookingId: OTHER_BOOKING_ID,
        bookingRevision: BOOKING_REVISION,
        approvalId: APPROVAL_ID,
        confirmation,
        nowMs: NOW_MS + 60_000,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyCustomerWriteConfirmation({
        secret: SECRET,
        bookingId: BOOKING_ID,
        bookingRevision: OTHER_REVISION,
        approvalId: APPROVAL_ID,
        confirmation,
        nowMs: NOW_MS + 60_000,
      }),
    ).resolves.toBe(false);
  });

  it("rejects a missing, wrong or replaced approval id", async () => {
    const confirmation = await issueConfirmation();
    const unboundConfirmation = await issueCustomerWriteConfirmation({
      secret: SECRET,
      bookingId: BOOKING_ID,
      bookingRevision: BOOKING_REVISION,
      approvalId: null,
      nowMs: NOW_MS,
      nonce: "approval-nonce-1234567890",
    });

    await expect(
      verifyCustomerWriteConfirmation({
        secret: SECRET,
        bookingId: BOOKING_ID,
        bookingRevision: BOOKING_REVISION,
        confirmation,
        nowMs: NOW_MS + 60_000,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyCustomerWriteConfirmation({
        secret: SECRET,
        bookingId: BOOKING_ID,
        bookingRevision: BOOKING_REVISION,
        approvalId: OTHER_APPROVAL_ID,
        confirmation,
        nowMs: NOW_MS + 60_000,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyCustomerWriteConfirmation({
        secret: SECRET,
        bookingId: BOOKING_ID,
        bookingRevision: BOOKING_REVISION,
        approvalId: APPROVAL_ID,
        confirmation: unboundConfirmation,
        nowMs: NOW_MS + 60_000,
      }),
    ).resolves.toBe(false);
  });

  it("rejects a forged, expired, malformed or missing confirmation", async () => {
    const confirmation = await issueConfirmation();

    await expect(
      verifyCustomerWriteConfirmation({
        secret: "different-server-secret",
        bookingId: BOOKING_ID,
        bookingRevision: BOOKING_REVISION,
        approvalId: APPROVAL_ID,
        confirmation,
        nowMs: NOW_MS + 60_000,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyCustomerWriteConfirmation({
        secret: SECRET,
        bookingId: BOOKING_ID,
        bookingRevision: BOOKING_REVISION,
        approvalId: APPROVAL_ID,
        confirmation,
        nowMs: NOW_MS + 5 * 60_000,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyCustomerWriteConfirmation({
        secret: SECRET,
        bookingId: BOOKING_ID,
        bookingRevision: BOOKING_REVISION,
        approvalId: APPROVAL_ID,
        confirmation: "WGCU2.invalid.invalid",
        nowMs: NOW_MS,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyCustomerWriteConfirmation({
        secret: SECRET,
        bookingId: BOOKING_ID,
        bookingRevision: BOOKING_REVISION,
        approvalId: APPROVAL_ID,
        nowMs: NOW_MS,
      }),
    ).resolves.toBe(false);
  });

  it("passes only with the switch, an active approval and a verified confirmation", () => {
    const result = evaluateCustomerWriteGate({
      enabledValue: " TRUE ",
      approvalActive: true,
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
