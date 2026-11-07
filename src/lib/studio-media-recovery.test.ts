import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import sharp from "sharp";
import type { Sql } from "./db.ts";
import { storeStudioImage } from "./studio-media.server.ts";

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "wg-studio-media-recovery-test-"));
  const png = await sharp({ create: { width: 8, height: 4, channels: 3, background: "#8899aa" } }).png().toBuffer();
  return {
    directory,
    file: new File([new Uint8Array(png)], "werkstatt.png", { type: "image/png" }),
    async close() {
      assert.ok(relative(resolve(tmpdir()), resolve(directory)).startsWith("wg-studio-media-recovery-test-"));
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test("a definite database rejection with no metadata row removes only its new private derivative", async () => {
  const context = await fixture();
  let queries = 0;
  const sql = Object.assign(async () => [], { query: async () => {
    if (++queries === 1) throw new Error("Insert rejected");
    return [];
  } }) as unknown as Sql;
  try {
    await assert.rejects(storeStudioImage(sql, context.file, "operator-test", context.directory), /Insert rejected/);
    assert.deepEqual(await readdir(context.directory), []);
  } finally { await context.close(); }
});

test("an unknown database outcome retains a private derivative instead of destroying possibly committed data", async () => {
  const context = await fixture();
  const sql = Object.assign(async () => [], { query: async () => { throw new Error("Connection lost"); } }) as unknown as Sql;
  try {
    await assert.rejects(storeStudioImage(sql, context.file, "operator-test", context.directory), /Connection lost/);
    const files = await readdir(context.directory);
    assert.equal(files.length, 1);
    assert.match(files[0], /^[a-f0-9-]{36}\.webp$/);
  } finally { await context.close(); }
});

test("a committed insert whose acknowledgement was lost is recovered by its exact media ID", async () => {
  const context = await fixture();
  let stored: Record<string, unknown> | undefined;
  const sql = Object.assign(async () => [], { query: async (_query: string, params: unknown[]) => {
    if (!stored) {
      stored = { id: params[0], original_name: params[2], width: params[3], height: params[4], bytes: params[5], alt: "", caption: "", version: 1, approved: false, archived_at: null };
      throw new Error("Acknowledgement lost");
    }
    assert.equal(params[1], stored.id);
    return [stored];
  } }) as unknown as Sql;
  try {
    const recovered = await storeStudioImage(sql, context.file, "operator-test", context.directory);
    assert.equal(recovered.id, stored?.id);
    assert.equal(recovered.approved, false);
    assert.deepEqual(await readdir(context.directory), [`${recovered.id}.webp`]);
  } finally { await context.close(); }
});
