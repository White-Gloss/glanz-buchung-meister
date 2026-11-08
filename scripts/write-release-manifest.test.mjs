import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { test } from "node:test";
import {
  RUNTIME_ENSURED_MIGRATIONS,
  OPTIONAL_FEATURE_MIGRATIONS,
  requiredReleaseMigrations,
} from "./write-release-manifest.mjs";

test("release gate does not require SQL applied by runtime-ensured integrations", async () => {
  const onDisk = (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const required = requiredReleaseMigrations(onDisk);
  assert.ok(onDisk.includes("0015_zoho_ops.sql"));
  assert.ok(onDisk.includes("0016_bitrix_sync.sql"));
  assert.ok(onDisk.includes("0023_roapp_invoices.sql"));
  assert.ok(onDisk.includes("0024_qonto_webhook.sql"));
  assert.ok(RUNTIME_ENSURED_MIGRATIONS.includes("0024_qonto_webhook.sql"));
  assert.ok(required.includes("0013_roapp_sync.sql"));
  assert.ok(required.includes("0014_booking_photo_recovery.sql"));
  assert.deepEqual(
    required.filter((name) => RUNTIME_ENSURED_MIGRATIONS.includes(name)),
    [],
  );
  assert.deepEqual(
    required,
    onDisk.filter((name) => !RUNTIME_ENSURED_MIGRATIONS.includes(name) && !OPTIONAL_FEATURE_MIGRATIONS.includes(name)),
  );
});

test("unconfigured Website Studio cannot block the existing public website", () => {
  const required = requiredReleaseMigrations([
    "0013_roapp_sync.sql",
    "0014_booking_photo_recovery.sql",
    "0025_website_studio.sql",
    "0026_future_required_feature.sql",
  ]);
  assert.deepEqual(required, [
    "0013_roapp_sync.sql",
    "0014_booking_photo_recovery.sql",
    "0026_future_required_feature.sql",
  ]);
  assert.deepEqual(OPTIONAL_FEATURE_MIGRATIONS, ["0025_website_studio.sql"]);
});

