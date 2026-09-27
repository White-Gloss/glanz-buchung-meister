import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, chmod, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bitrixEnvironment, stageBitrixEnvironment } from "./stage-bitrix-environment.mjs";

const webhook = "https://example.bitrix24.de/rest/1/TestOnly123/";
const source =
  "# existing settings\nDATABASE_URL=postgres://example\nBOOKING_OPERATIONS=roapp\nKEEP_ME='unchanged'\nBITRIX_WEBHOOK_URL=old\n BOOKING_OPERATIONS=old\n";

test("candidate replaces mode/key exactly once and preserves unrelated settings", () => {
  const result = bitrixEnvironment(source, webhook + "\n");
  assert.equal(
    result,
    "# existing settings\nDATABASE_URL=postgres://example\nKEEP_ME='unchanged'\nBOOKING_OPERATIONS=bitrix\nBITRIX_WEBHOOK_URL=" +
      webhook +
      "\n",
  );
});

test("candidate rejects proxy keys, unexpected destinations and multiline injection", () => {
  for (const key of [
    "vibe_api_example",
    "https://evil.example/rest/1/test/",
    webhook + "\nOTHER=value",
  ])
    assert.throws(() => bitrixEnvironment(source, key), /native_webhook_required/);
  assert.throws(
    () => bitrixEnvironment("BOOKING_OPERATIONS=roapp", webhook),
    /database_configuration_missing/,
  );
});

test(
  "stage is private, preserves source, reveals no credential and refuses overwrite",
  {
    skip: process.platform !== "win32" && process.getuid?.() !== 0,
  },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "wg-bitrix-stage-"));
    await chmod(dir, 0o700);
    const paths = {
      source: join(dir, "source"),
      webhookFile: join(dir, "key"),
      output: join(dir, "candidate"),
    };
    try {
      await writeFile(paths.source, source, { mode: 0o600 });
      await writeFile(paths.webhookFile, webhook, { mode: 0o600 });
      const result = await stageBitrixEnvironment(paths);
      assert.equal(result.activated, false);
      assert.equal(JSON.stringify(result).includes(webhook), false);
      assert.equal(await readFile(paths.source, "utf8"), source);
      assert.equal(await readFile(paths.output, "utf8"), bitrixEnvironment(source, webhook));
      await assert.rejects(() => stageBitrixEnvironment(paths), { code: "EEXIST" });
      await assert.rejects(
        () => stageBitrixEnvironment({ ...paths, output: paths.source }),
        /separate_output_required/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);
