import assert from "node:assert/strict";
import test from "node:test";
import { join, resolve, relative, sep } from "node:path";
import { tmpdir } from "node:os";
import { chmod, lstat, mkdir, mkdtemp, rm, readdir, symlink, writeFile } from "node:fs/promises";
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

test("storage rejects every deployed release and known public webroot, including parent directories", () => {
  const app = "/srv/white-gloss-releases/current-sha/.output/server";
  for (const directory of [
    "/srv/white-gloss-releases/previous-sha/private-media",
    "/srv/white-gloss-current/private-media",
    "/var/lib/white-gloss-deploy/incoming-media",
    "/var/www/white-gloss/private-media",
    "/srv/www/private-media",
    "/srv/http/private-media",
    "/usr/share/nginx/html/private-media",
    "/usr/share/caddy/private-media",
    "/srv",
  ])
    assert.throws(() => studioMediaDirectory(directory, app), /außerhalb/, directory);
  assert.equal(
    studioMediaDirectory("/var/lib/white-gloss/studio-media", app),
    "/var/lib/white-gloss/studio-media",
  );
});

test("existing non-private directories and files fail closed without repairing permissions", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "wg-studio-media-test-"));
  const directory = join(temporary, "media");
  const id = "b08a4663-f94c-4c6c-80f9-079b889518af";
  const path = join(directory, `${id}.webp`);
  const storage = createStudioMediaStore(directory, join(temporary, "app"));
  try {
    await mkdir(directory, { mode: 0o700 });
    await chmod(directory, 0o755);
    await assert.rejects(storage.put(id, Buffer.from("private")), /0700/);
    await assert.rejects(storage.read(id), /0700/);
    await assert.rejects(storage.remove(id), /0700/);
    assert.equal((await lstat(directory)).mode & 0o777, 0o755);
    assert.deepEqual(await readdir(directory), []);
    await chmod(directory, 0o700);
    await storage.put(id, Buffer.from("private"));
    assert.equal((await lstat(path)).mode & 0o777, 0o600);
    await chmod(path, 0o644);
    assert.equal(await storage.read(id), null);
    await assert.rejects(storage.remove(id), /0600/);
    assert.equal((await lstat(path)).mode & 0o777, 0o644);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("directory aliases and symlinked images cannot read, write, or remove their targets", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "wg-studio-media-test-"));
  const app = join(temporary, "app");
  const actual = join(temporary, "actual");
  const alias = join(temporary, "alias");
  const id = "b08a4663-f94c-4c6c-80f9-079b889518af";
  const bytes = Buffer.from("private target");
  try {
    await mkdir(actual, { mode: 0o700 });
    await symlink(actual, alias);
    const aliased = createStudioMediaStore(join(alias, "new-directory"), app);
    await assert.rejects(aliased.put(id, bytes), /Symlink/);
    assert.deepEqual(
      await readdir(actual),
      [],
      "a refused alias must not create directories in its target",
    );
    const directAlias = createStudioMediaStore(alias, app);
    await assert.rejects(directAlias.read(id), /Symlink/);
    await assert.rejects(directAlias.remove(id), /Symlink/);
    const target = join(temporary, "target.webp");
    await writeFile(target, bytes, { mode: 0o600 });
    await symlink(target, join(actual, `${id}.webp`));
    const direct = createStudioMediaStore(actual, app);
    assert.equal(await direct.read(id), null);
    await assert.rejects(direct.put(id, bytes));
    await assert.rejects(direct.remove(id), /0600/);
    assert.equal((await lstat(target)).isFile(), true);
    assert.equal((await lstat(join(actual, `${id}.webp`))).isSymbolicLink(), true);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
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
