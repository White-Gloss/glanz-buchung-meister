import assert from "node:assert/strict";
import { test } from "node:test";
import type { Sql } from "./db.ts";
import {
  bookingBackend,
  assertBitrixActive,
  assertWebsiteApprovalEnabled,
} from "./booking-backend.ts";
import { queueCrmBooking, queueCrmPhotos, runCrmSync, crmBusyWindows } from "./booking-crm.ts";
import { queueBitrixBooking, queueBitrixPhotos, runBitrixSync } from "./bitrix-sync.ts";
import { queueRoappBooking, runRoappSync } from "./roapp-sync.ts";
import { readBitrixWebhook } from "./bitrix-credentials.server.ts";
import { bitrixBusyWindows } from "./bitrix-calendar.ts";
import { roappBusyWindows } from "./roapp-calendar.ts";
import { roappDiagnostics } from "./roapp-diagnostics.ts";
import { validateRoLifecycle } from "./roapp-lifecycle.ts";
import {
  validateRoInvoiceMessage,
  retryRoInvoice,
  recordRoInvoicePayment,
} from "./roapp-invoice.ts";
import { rejectOrCancelBooking, completeServiceWithPayment } from "./booking-operations.ts";
import { saveManualBookingRequest, changeBookingStatus, editBooking } from "./booking-workflow.ts";

test("panel mode blocks both provider queues, credentials, forced calendars and probes before any access", async () => {
  process.env.BOOKING_OPERATIONS = "panel";
  const sql = (() => assert.fail("Disabled providers must not touch SQL")) as unknown as Sql;
  const request = async <T>() => {
    assert.fail("Disabled providers must not contact an API");
    return {} as T;
  };
  for (const queue of [
    queueCrmBooking,
    queueCrmPhotos,
    queueBitrixBooking,
    queueBitrixPhotos,
    queueRoappBooking,
  ])
    await queue(sql, { id: 1, version: 1 });
  assert.deepEqual(await runCrmSync(sql), { backend: "panel", skipped: 1 });
  assert.equal((await runBitrixSync(sql, { request })).skipped, 1);
  assert.deepEqual(await runRoappSync(sql, { request }), { synced: 0, failed: 0, review: 0 });
  assert.equal(await readBitrixWebhook(sql), "");
  assert.deepEqual(await crmBusyWindows(sql, "2026-10-06", "2026-10-07", true), []);
  assert.deepEqual(
    await bitrixBusyWindows(sql, "2026-10-06", "2026-10-07", {
      force: true,
      fetchImpl: async () => assert.fail("Bitrix calendar"),
    }),
    [],
  );
  assert.deepEqual(await roappBusyWindows("2026-10-06", "2026-10-07"), []);
  assert.deepEqual(await roappDiagnostics(sql, { probe: true, request }), {
    ok: true,
    backend: "panel",
    disabled: true,
  });
  assert.throws(assertBitrixActive, /White-Gloss-Panel/);
  assert.throws(assertWebsiteApprovalEnabled, /White-Gloss-Panel/);
  const message = {
    booking_id: 1,
    event_key: "synthetic",
    event_type: "wg.ro.invoice",
    to_addr: "test@example.invalid",
  };
  assert.equal(await validateRoLifecycle(sql, message, request), false);
  assert.equal(await validateRoInvoiceMessage(sql, message), false);
  assert.equal(await retryRoInvoice(sql, 1), false);
  await assert.rejects(recordRoInvoicePayment(sql, {} as never), /ausgeschaltet/);
  await assert.rejects(rejectOrCancelBooking(sql, 1, 1, "owner", "storniert"), /White-Gloss-Panel/);
  await assert.rejects(
    completeServiceWithPayment(sql, 1, 1, "owner", {} as never),
    /White-Gloss-Panel/,
  );
  await assert.rejects(saveManualBookingRequest(sql, {} as never, "owner"), /White-Gloss-Panel/);
  await assert.rejects(changeBookingStatus(sql, 1, 1, "storniert", "owner"), /White-Gloss-Panel/);
  await assert.rejects(editBooking(sql, 1, 1, {} as never, "owner"), /White-Gloss-Panel/);
  delete process.env.BOOKING_OPERATIONS;
  assert.equal(bookingBackend(), "panel");
});
