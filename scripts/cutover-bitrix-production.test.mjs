import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blockersFor,
  describeKey,
  parseEnvironment,
  probeBitrix,
  probeCalendar,
  withBookingOperations,
} from "./cutover-bitrix-production.mjs";

test("environment parsing keeps quoted values and ignores comments", () => {
  const env = parseEnvironment("# c\nBOOKING_OPERATIONS=roapp\nNAME=\"White Gloss\"\nX='a=b'\n\n");
  assert.deepEqual(env, { BOOKING_OPERATIONS: "roapp", NAME: "White Gloss", X: "a=b" });
});

test("mode switch replaces only BOOKING_OPERATIONS and leaves other lines untouched", () => {
  const before = 'A=1\nBOOKING_OPERATIONS=roapp\nB="x y"\n# note\n';
  assert.equal(
    withBookingOperations(before, "bitrix"),
    'A=1\nB="x y"\n# note\nBOOKING_OPERATIONS=bitrix\n',
  );
  assert.equal(withBookingOperations("A=1", "bitrix"), "A=1\nBOOKING_OPERATIONS=bitrix\n");
});

test("key description never contains the key", () => {
  const key = "vibe_api_" + "s".repeat(30);
  assert.equal(JSON.stringify(describeKey(key)).includes("sss"), false);
  assert.deepEqual(describeKey(""), { present: false });
  assert.equal(describeKey("https://b24-x.bitrix24.de/rest/1/abc123/").kind, "rest_webhook");
});

test("probe reports inactive keys without echoing the response", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({ success: false, error: { code: "KEY_INACTIVE", message: "secret detail" } }),
      {
        status: 401,
      },
    );
  assert.deepEqual(
    await probeBitrix("https://example.bitrix24.de/rest/1/testcode123/", undefined, fetchImpl),
    {
      ok: false,
      httpStatus: 401,
      code: "access_failed",
    },
  );
  const ok = async () => new Response(JSON.stringify({ result: [] }), { status: 200 });
  assert.deepEqual(
    await probeBitrix("https://example.bitrix24.de/rest/1/testcode123/", undefined, ok),
    { ok: true, httpStatus: 200 },
  );
});

test("apply is blocked unless production is roapp with a working Bitrix key", () => {
  const ready = {
    root: true,
    mode: "roapp",
    databaseUrl: true,
    vibeKey: { present: true, kind: "rest_webhook" },
    bitrixProbe: { ok: true },
    calendarProbe: { ok: true },
    database: {
      bitrixCalendarEnabled: true,
      openBookingsWithoutBitrix: 0,
      bitrixQueueUnfinished: 0,
    },
  };
  assert.deepEqual(blockersFor(ready), []);
  assert.deepEqual(blockersFor({ ...ready, mode: "bitrix" }), ["already_bitrix"]);
  assert.deepEqual(blockersFor({ ...ready, vibeKey: { present: false } }), [
    "bitrix_webhook_missing_in_environment_file",
  ]);
  assert.deepEqual(blockersFor({ ...ready, bitrixProbe: { ok: false } }), ["bitrix_probe_failed"]);
  assert.deepEqual(blockersFor({ ...ready, vibeKey: { present: true, kind: "vibecode" } }), [
    "rest_webhook_required",
  ]);
  assert.deepEqual(
    blockersFor({ ...ready, database: { ...ready.database, roQueueUnfinished: 2 } }),
    ["roapp_queue_unfinished"],
  );
  assert.deepEqual(blockersFor({ ...ready, database: { error: "ECONNREFUSED" } }), [
    "database_unreachable",
  ]);
});

test("HTTP success without a valid CRM payload is never readiness", async () => {
  for (const body of ["<html>login</html>", "null", "{}", '{"success":true}']) {
    const result = await probeBitrix(
      "https://example.bitrix24.de/rest/1/testcode123/",
      undefined,
      async () => new Response(body),
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "invalid_response");
  }
});

test("calendar probe uses native REST and rejects incomplete responses", async () => {
  for (const [body, ok] of [
    [{ result: [] }, true],
    [{ result: [], next: 50 }, false],
    [{ result: true }, false],
    [null, false],
  ]) {
    const result = await probeCalendar(
      "https://example.bitrix24.de/rest/1/testcode123/",
      undefined,
      async (url, init) => {
        assert.match(url, /calendar.event.get.json$/);
        assert.deepEqual(JSON.parse(init.body).section, [2]);
        return Response.json(body);
      },
    );
    assert.equal(result.ok, ok);
  }
  let called = false;
  assert.equal(
    (
      await probeBitrix("vibe_api_retired", undefined, async () => {
        called = true;
      })
    ).ok,
    false,
  );
  assert.equal(called, false);
});

test("cutover requires verified calendar, migrated open orders and drained Bitrix queue", () => {
  const ready = {
    root: true,
    mode: "roapp",
    databaseUrl: true,
    vibeKey: { present: true, kind: "rest_webhook" },
    bitrixProbe: { ok: true },
    calendarProbe: { ok: true },
    database: {
      bitrixCalendarEnabled: true,
      openBookingsWithoutBitrix: 0,
      bitrixQueueUnfinished: 0,
    },
  };
  assert.deepEqual(blockersFor({ ...ready, calendarProbe: { ok: false } }), [
    "bitrix_calendar_probe_failed",
  ]);
  for (const [field, value, code] of [
    ["bitrixCalendarEnabled", false, "bitrix_calendar_disabled"],
    ["openBookingsWithoutBitrix", 1, "open_bookings_without_bitrix"],
    ["bitrixQueueUnfinished", 1, "bitrix_queue_unfinished"],
  ])
    assert.deepEqual(blockersFor({ ...ready, database: { ...ready.database, [field]: value } }), [
      code,
    ]);
  assert.deepEqual(blockersFor({ ...ready, database: null }), ["database_unreachable"]);
});
