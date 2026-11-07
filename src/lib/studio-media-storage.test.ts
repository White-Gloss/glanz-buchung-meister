import assert from "node:assert/strict";
import test from "node:test";
import { join, resolve, relative, sep } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { createStudioMediaStore, studioMediaDirectory } from "./studio-media-storage.server.ts";

test("studio storage requires an explicit absolute location outside the application", () => {
  const app = resolve(tmpdir(), "studio-test-app");
  assert.throws(() => studioMediaDirectory(undefined, app), /CMS_MEDIA_DIR/);
  assert.throws(() => studioMediaDirectory("relative/uploads", app), /absolut/);
  assert.throws(() => studioMediaDirectory(app, app), /außerhalb/);
  assert.throws(() => studioMediaDirectory(join(app, "public", "studio"), app), /außerhalb/);
  assert.equal(
    studioMediaDirectory(resolve(tmpdir(), "studio-private"), app),
    resolve(tmpdir(), "studio-private"),
  );
});

test("private files roundtrip by UUID only and cannot overwrite an existing upload", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "wg-studio-media-test-"));
  const directory = join(temporary, "media");
  const app = join(temporary, "app");
  const id = "b08a4663-f94c-4c6c-80f9-079b889518af";
  const bytes = Buffer.from("optimized webp test data");
  try {
    const storage = createStudioMediaStore(directory, app);
    assert.equal(await storage.read(id), null);
    await storage.put(id, bytes);
    assert.deepEqual(await storage.read(id), bytes);
    assert.deepEqual(await readdir(directory), [`${id}.webp`]);
    await assert.rejects(storage.put(id, Buffer.from("replacement")));
    assert.deepEqual(await storage.read(id), bytes);
    await assert.rejects(storage.read("../../private"), /Bildkennung/);
    await storage.remove(id);
    assert.equal(await storage.read(id), null);
  } finally {
    const contained = relative(resolve(tmpdir()), resolve(temporary));
    assert.ok(contained && !contained.startsWith(`..${sep}`));
    await rm(temporary, { recursive: true, force: true });
  }
});
