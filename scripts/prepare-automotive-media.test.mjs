import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareAutomotiveMedia } from "./prepare-automotive-media.mjs";

const data = Buffer.from("trusted media bytes");
const asset = { path: "media/automotive-journey/classic-640.webp", url: "https://d2ol7oe51mr4n9.cloudfront.net/user_fixture/fixture.webp", bytes: data.length, sha256: createHash("sha256").update(data).digest("hex") };
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "wg-media-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
test("verified media is written once and reused without network", async (t) => {
  const root = await fixture(t);
  let calls = 0;
  const fetcher = async (_url, options) => { calls++; assert.equal(options.redirect, "error"); return new Response(data); };
  await prepareAutomotiveMedia({ root, assets: [asset], fetcher });
  assert.deepEqual(await readFile(join(root, "public", asset.path)), data);
  await prepareAutomotiveMedia({ root, assets: [asset], fetcher });
  assert.equal(calls, 1);
});
test("corrupt remote bytes cannot replace the existing asset", async (t) => {
  const root = await fixture(t);
  const target = join(root, "public", asset.path);
  await mkdir(join(root, "public/media/automotive-journey"), { recursive: true });
  await writeFile(target, "previous asset");
  await assert.rejects(prepareAutomotiveMedia({ root, assets: [asset], fetcher: async () => new Response("wrong bytes") }), /integrity mismatch/);
  assert.equal(await readFile(target, "utf8"), "previous asset");
});
test("unavailable media fails the build instead of publishing broken URLs", async (t) => {
  const root = await fixture(t);
  await assert.rejects(prepareAutomotiveMedia({ root, assets: [asset], fetcher: async () => new Response("", { status: 503 }) }), /download failed/);
});
test("manifest paths and sources are validated before any download", async (t) => {
  const root = await fixture(t);
  let calls = 0;
  const fetcher = async () => { calls++; throw new Error("Must not fetch"); };
  for (const invalid of [{ ...asset, path: "../../outside.mp4" }, { ...asset, url: "http://localhost/internal" }, { ...asset, sha256: "bad" }])
    await assert.rejects(prepareAutomotiveMedia({ root, assets: [asset, invalid], fetcher }), /Invalid automotive/);
  assert.equal(calls, 0);
});
