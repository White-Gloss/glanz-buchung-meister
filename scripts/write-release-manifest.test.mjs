import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { test } from "node:test";
import {
  RUNTIME_ENSURED_MIGRATIONS,
  requiredReleaseMigrations,
} from "./write-release-manifest.mjs";

test("release gate keeps 0013/0014 and does not require runtime-ensured Zoho/Bitrix SQL", async () => {
  const onDisk = (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const required = requiredReleaseMigrations(onDisk);
  assert.ok(onDisk.includes("0015_zoho_ops.sql"));
  assert.ok(onDisk.includes("0016_bitrix_sync.sql"));
  assert.ok(required.includes("0013_roapp_sync.sql"));
  assert.ok(required.includes("0014_booking_photo_recovery.sql"));
  assert.deepEqual(
    required.filter((name) => RUNTIME_ENSURED_MIGRATIONS.includes(name)),
    [],
  );
  assert.deepEqual(
    required,
    onDisk.filter((name) => !RUNTIME_ENSURED_MIGRATIONS.includes(name)),
  );
});
