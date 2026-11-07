import assert from "node:assert/strict";
import test from "node:test";
import {
  isStudioMediaId,
  sanitizeStudioMediaName,
  STUDIO_IMAGE_MAX_BYTES,
  validateStudioImageBytes,
} from "./studio-media.model.ts";

const jpeg = Uint8Array.from([255, 216, 255, 224, 0, 1]);
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const webp = Uint8Array.from([82, 73, 70, 70, 30, 0, 0, 0, 87, 69, 66, 80]);

test("only matching JPEG, PNG or WebP signatures are admitted to the decoder", () => {
  assert.equal(validateStudioImageBytes(jpeg, "image/jpeg"), "image/jpeg");
  assert.equal(validateStudioImageBytes(png, "image/png"), "image/png");
  assert.equal(validateStudioImageBytes(webp, "image/webp"), "image/webp");
  assert.throws(() => validateStudioImageBytes(png, "image/jpeg"), /Format/);
  assert.throws(
    () => validateStudioImageBytes(new TextEncoder().encode("<svg/>"), "image/png"),
    /Format/,
  );
  assert.throws(() => validateStudioImageBytes(jpeg, "image/svg+xml"), /Format/);
  assert.throws(() => validateStudioImageBytes(jpeg, "application/octet-stream"), /Format/);
});

test("empty and oversized files are rejected before decoding or allocation", () => {
  assert.throws(() => validateStudioImageBytes(new Uint8Array(), "image/jpeg"), /leer/);
  const oversized = new Uint8Array(STUDIO_IMAGE_MAX_BYTES + 1);
  oversized.set(jpeg);
  assert.throws(() => validateStudioImageBytes(oversized, "image/jpeg"), /12/);
});

test("media IDs cannot address paths, private booking objects or arbitrary URLs", () => {
  assert.equal(isStudioMediaId("b08a4663-f94c-4c6c-80f9-079b889518af"), true);
  for (const value of [
    "../secret",
    "condition-photos/1.jpg",
    "https://host/image.jpg",
    "",
    "1",
    "static:customer-01",
  ]) {
    assert.equal(isStudioMediaId(value), false, value);
  }
});

test("original display names replace controls and separators while preserving Unicode", () => {
  assert.equal(
    sanitizeStudioMediaName("../kunden\\bild\n\t\u0000\u007f.jpg"),
    ".._kunden_bild____.jpg",
  );
  assert.equal(sanitizeStudioMediaName("Grüße 🚘.jpg"), "Grüße 🚘.jpg");
  assert.equal(sanitizeStudioMediaName(""), "Bild");
  assert.equal(sanitizeStudioMediaName("🚘".repeat(161)), "🚘".repeat(160));
});
