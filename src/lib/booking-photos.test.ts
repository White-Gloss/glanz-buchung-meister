import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertAllowedUpload, sniffMagicMime } from "./booking-photos.ts";

function jpegBytes(): Uint8Array {
  // Minimal JPEG SOI + APP0-ish marker start
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
}

function pngBytes(): Uint8Array {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
}

function webpBytes(): Uint8Array {
  const out = new Uint8Array(12);
  out.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  out.set([0x00, 0x00, 0x00, 0x00], 4);
  out.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  return out;
}

describe("sniffMagicMime", () => {
  it("detects jpeg, png and webp", () => {
    assert.equal(sniffMagicMime(jpegBytes()), "image/jpeg");
    assert.equal(sniffMagicMime(pngBytes()), "image/png");
    assert.equal(sniffMagicMime(webpBytes()), "image/webp");
  });

  it("rejects random bytes", () => {
    assert.equal(sniffMagicMime(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])), null);
    assert.equal(sniffMagicMime(new Uint8Array(0)), null);
  });
});

describe("assertAllowedUpload", () => {
  it("accepts matching jpeg magic and mime", () => {
    const result = assertAllowedUpload(jpegBytes(), "image/jpeg");
    assert.equal(result.mime, "image/jpeg");
    assert.equal(result.ext, "jpg");
  });

  it("rejects random bytes even with a claimed jpeg mime", () => {
    assert.throws(
      () => assertAllowedUpload(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]), "image/jpeg"),
      /nicht.*erkannt|stimmt nicht/i,
    );
  });
});
