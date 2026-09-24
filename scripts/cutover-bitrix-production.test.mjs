import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blockersFor,
  describeKey,
  parseEnvironment,
  probeBitrix,
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
  assert.deepEqual(await probeBitrix("vibe_api_x", undefined, fetchImpl), {
    ok: false,
    httpStatus: 401,
    code: "KEY_INACTIVE",
  });
  const ok = async () => new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  assert.deepEqual(await probeBitrix("vibe_api_x", undefined, ok), { ok: true, httpStatus: 200 });
});

test("apply is blocked unless production is roapp with a working Bitrix key", () => {
  const ready = {
    root: true,
    mode: "roapp",
    databaseUrl: true,
    vibeKey: { present: true },
    bitrixProbe: { ok: true },
    database: {},
  };
  assert.deepEqual(blockersFor(ready), []);
  assert.deepEqual(blockersFor({ ...ready, mode: "bitrix" }), ["already_bitrix"]);
  assert.deepEqual(blockersFor({ ...ready, vibeKey: { present: false } }), [
    "vibe_api_key_missing_in_environment_file",
  ]);
  assert.deepEqual(blockersFor({ ...ready, bitrixProbe: { ok: false } }), ["bitrix_probe_failed"]);
  assert.deepEqual(blockersFor({ ...ready, vibeKey: { present: true, kind: "rest_webhook" } }), [
    "vibecode_key_required",
  ]);
  assert.deepEqual(blockersFor({ ...ready, database: { roQueueUnfinished: 2 } }), [
    "roapp_queue_unfinished",
  ]);
  assert.deepEqual(blockersFor({ ...ready, database: { error: "ECONNREFUSED" } }), [
    "database_unreachable",
  ]);
});
