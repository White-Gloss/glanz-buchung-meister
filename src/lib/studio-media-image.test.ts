import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { optimizeStudioImage } from "./studio-media-image.server.ts";

test("uploaded JPEG is actually decoded, resized and stripped of EXIF before storage", async () => {
  const source = await sharp({
    create: { width: 3000, height: 1500, channels: 3, background: "#aabbcc" },
  })
    .withExif({ IFD0: { Copyright: "private metadata must disappear" } })
    .jpeg()
    .toBuffer();
  assert.ok((await sharp(source).metadata()).exif);
  const optimized = await optimizeStudioImage(source, "image/jpeg");
  const decoded = await sharp(optimized.data).metadata();
  assert.equal(decoded.format, "webp");
  assert.equal(decoded.exif, undefined);
  assert.equal(decoded.width, 2400);
  assert.equal(decoded.height, 1200);
  assert.equal(optimized.width, 2400);
  assert.equal(optimized.height, 1200);
  assert.match(optimized.sha256, /^[0-9a-f]{64}$/);
});

test("an image with a plausible header but broken decoder data is rejected", async () => {
  await assert.rejects(
    optimizeStudioImage(Uint8Array.from([255, 216, 255, 224, 0, 1]), "image/jpeg"),
    /verarbeitet/,
  );
});

test("PNG transparency survives optimization and small images are not enlarged", async () => {
  const source = await sharp({
    create: { width: 4, height: 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();
  const optimized = await optimizeStudioImage(source, "image/png");
  const decoded = await sharp(optimized.data).metadata();
  assert.equal(decoded.format, "webp");
  assert.equal(decoded.hasAlpha, true);
  assert.equal(decoded.width, 4);
  assert.equal(decoded.height, 2);
});

test("highly compressed images above 40 megapixels are rejected regardless of file size", async () => {
  const source = await sharp(Buffer.alloc(6400 * 6400), {
    raw: { width: 6400, height: 6400, channels: 1 },
  })
    .png()
    .toBuffer();
  assert.ok(source.byteLength < 12 * 1024 * 1024);
  assert.equal((await sharp(source).metadata()).width, 6400);
  await assert.rejects(optimizeStudioImage(source, "image/png"), /40 Megapixeln/);
});

test("animated WebP is rejected instead of silently publishing only its first frame", async () => {
  const pixels = Buffer.alloc(4 * 8 * 3, 80);
  pixels.fill(200, 4 * 4 * 3);
  const source = await sharp(pixels, { raw: { width: 4, height: 8, channels: 3, pageHeight: 4 } })
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
  assert.equal((await sharp(source).metadata()).pages, 2);
  await assert.rejects(optimizeStudioImage(source, "image/webp"), /nicht animiertes/);
});
