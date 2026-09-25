import assert from "node:assert/strict";
import { test } from "node:test";
import type { BitrixCall } from "./bitrix-error.ts";
import { nativeCustomerStatus } from "./bitrix-customer-status.ts";

const deal = {
  ID: "42",
  UF_CRM_WG_BOOKING_REF: "WG-17",
  STAGE_ID: "EXECUTING",
  CURRENCY_ID: "EUR",
  OPPORTUNITY: "777.12",
  UF_CRM_WG_APPOINTMENT: "2026-11-02T09:00:00+01:00",
};
const request =
  (value: unknown): BitrixCall =>
  async <T>() =>
    value as T;
test("customer status reads the native deal price and confirmed appointment", async () => {
  assert.deepEqual(await nativeCustomerStatus(request(deal), 17, 42), {
    status: "Termin bestätigt",
    amount: 77712,
    fixed: true,
    scheduledFor: "2026-11-02T08:00:00.000Z",
  });
  const cancelled = await nativeCustomerStatus(request({ ...deal, STAGE_ID: "APOLOGY" }), 17, 42);
  assert.equal(cancelled.fixed, false);
  assert.equal(cancelled.scheduledFor, null);
  const withoutDate = await nativeCustomerStatus(
    request({ ...deal, UF_CRM_WG_APPOINTMENT: null }),
    17,
    42,
  );
  assert.equal(withoutDate.fixed, false);
  assert.equal(withoutDate.status, "In Bearbeitung – Termin noch offen");
});
test("customer status never leaks an unrelated deal or infers a price", async () => {
  for (const patch of [
    { ID: 43 },
    { UF_CRM_WG_BOOKING_REF: "WG-18" },
    { OPPORTUNITY: "not a price" },
    { OPPORTUNITY: null },
    { OPPORTUNITY: "" },
    { OPPORTUNITY: false },
    { CURRENCY_ID: "USD" },
  ])
    await assert.rejects(nativeCustomerStatus(request({ ...deal, ...patch }), 17, 42));
});
