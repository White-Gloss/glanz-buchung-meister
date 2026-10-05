import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingBackend, roappAccountScope, roappCutoverAt } from "./booking-backend.ts";
import { runBitrixSync, queueBitrixBooking, queueBitrixPhotos } from "./bitrix-sync.ts";
import { readBitrixWebhook } from "./bitrix-credentials.server.ts";
import { createRoappClient, findPersonByPhoneOrEmail, normalizeRoappApiBase } from "./roapp.ts";
import type { Sql } from "./db.ts";

test("RO mode prevents Bitrix queueing, reads and writes even with injected credentials", async () => {
  process.env.BOOKING_OPERATIONS = "roapp";
  const sql = (() => assert.fail("Bitrix must not touch the database")) as unknown as Sql;
  try {
    await queueBitrixBooking(sql, { id: 1, version: 1 });
    await queueBitrixPhotos(sql, { id: 1, version: 1 });
    assert.equal(await readBitrixWebhook(sql), "");
    assert.equal(
      (await runBitrixSync(sql, { request: async () => assert.fail("parallel write") })).skipped,
      1,
    );
  } finally {
    delete process.env.BOOKING_OPERATIONS;
  }
});
test("backend and account configuration fail closed", () => {
  assert.equal(bookingBackend(), "panel");
  process.env.BOOKING_OPERATIONS = "typo";
  assert.throws(() => bookingBackend(), /invalid/);
  delete process.env.BOOKING_OPERATIONS;
  assert.throws(() => roappAccountScope(), /missing/);
  assert.throws(() => roappCutoverAt(), /missing/);
  for (const value of [
    "https://evil.invalid/v2",
    "https://api.roapp.io/v2?key=secret",
    "http://api.roapp.io/v2",
  ])
    assert.throws(() => normalizeRoappApiBase(value));
});
test("a different API account is rejected before any order or contact is read or written", async () => {
  const calls: string[] = [];
  const request = createRoappClient(
    {
      apiKey: "test",
      apiBase: "https://api.roapp.io/v2",
      branchId: 1,
      assigneeId: 2,
      orderTypeId: 3,
      entityMap: {},
      expectedCompanyCreatedAt: "2026-09-28T13:56:33Z",
    },
    {
      minIntervalMs: 0,
      fetchImpl: async (url) => {
        calls.push(String(url));
        return Response.json({ created_at: "2026-09-01T00:00:00Z" });
      },
    },
  );
  await assert.rejects(request("POST", "/orders", {}), /identity_mismatch/);
  await assert.rejects(request("GET", "/orders/1"), /identity_mismatch/);
  assert.ok(calls.every((url) => url.endsWith("/company")));
});
test("email matching refuses duplicates and never treats a shared phone as identity", async () => {
  const request = (async () => ({
    data: [{ id: 1, email: "other@example.invalid" }],
  })) as Parameters<typeof findPersonByPhoneOrEmail>[0];
  assert.equal(
    await findPersonByPhoneOrEmail(request, "+491234", "customer@example.invalid"),
    null,
  );
  assert.equal(
    await findPersonByPhoneOrEmail(
      async () => assert.fail("no phone-only lookup"),
      "+491234",
      null,
    ),
    null,
  );
  const duplicates = (async () => ({
    data: [
      { id: 1, email: "customer@example.invalid" },
      { id: 2, email: "customer@example.invalid" },
    ],
  })) as typeof request;
  await assert.rejects(
    findPersonByPhoneOrEmail(duplicates, "+491234", "customer@example.invalid"),
    /ambiguous/,
  );
});
