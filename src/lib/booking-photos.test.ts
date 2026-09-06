import assert from "node:assert/strict";
import { describe, it, type TestContext } from "node:test";
import {
  assertAllowedUpload,
  decodeUploadBase64,
  deleteConditionPhotos,
  MAX_BASE64_UPLOAD_CHARS,
  MAX_UPLOAD_BYTES,
  sniffMagicMime,
  validateUploadBatch,
} from "./booking-photos.ts";

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

function mockStorageRemoval(t: TestContext, status = 200) {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://storage.example.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-placeholder";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  });
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response("provider-response", { status });
  });
  return calls;
}

describe("failed upload batch removal", () => {
  const first = `bookings/42/${"a".repeat(32)}.jpg`;
  const second = `bookings/42/${"b".repeat(32)}.webp`;

  it("removes only the supplied exact object paths through the bucket object endpoint", async (t) => {
    const calls = mockStorageRemoval(t);
    await deleteConditionPhotos([first, second, first]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://storage.example.invalid/storage/v1/object/condition-photos");
    assert.equal(calls[0].init?.method, "DELETE");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { prefixes: [first, second] });
  });

  it("does not issue a request for an empty batch", async (t) => {
    const calls = mockStorageRemoval(t);
    await deleteConditionPhotos([]);
    assert.equal(calls.length, 0);
  });

  it("rejects directory prefixes, wildcards, traversal and excess paths before any removal", async (t) => {
    const calls = mockStorageRemoval(t);
    for (const path of ["", "/", "bookings", "bookings/42/", "bookings/42/*", `${first}/../`, "../condition-photos", first.replace("/42/", "/0/")]) {
      await assert.rejects(() => deleteConditionPhotos([first, path]), /Ungültige Bereinigungspfade/);
    }
    await assert.rejects(() => deleteConditionPhotos(Array.from({ length: 9 }, () => first)), /Ungültige Bereinigungspfade/);
    assert.equal(calls.length, 0);
  });

  it("reports removal failures without returning provider details as an apparent success", async (t) => {
    const calls = mockStorageRemoval(t, 503);
    await assert.rejects(
      () => deleteConditionPhotos([first]),
      { message: "Die fehlgeschlagenen Uploads konnten nicht vollständig bereinigt werden." },
    );
    assert.equal(calls.length, 1);
  });
});

describe("complete booking upload validation", () => {
  const jpeg = { mime: "image/jpeg", base64: Buffer.from(jpegBytes()).toString("base64") };
  const png = { mime: "image/png", base64: Buffer.from(pngBytes()).toString("base64") };

  it("prepares every valid file with normalized MIME, extension and actual size", () => {
    assert.deepEqual(validateUploadBatch([{ ...jpeg, mime: "image/jpg" }, png]), [
      { mime: "image/jpeg", ext: "jpg", sizeBytes: jpegBytes().length },
      { mime: "image/png", ext: "png", sizeBytes: pngBytes().length },
    ]);
  });

  it("rejects the entire selection when a later file has invalid contents or a MIME mismatch", () => {
    assert.throws(
      () => validateUploadBatch([jpeg, { mime: "image/png", base64: "AQIDBA==" }]),
      /nicht.*erkannt/i,
    );
    assert.throws(
      () => validateUploadBatch([jpeg, { ...png, mime: "image/jpeg" }]),
      /Format.*überein/i,
    );
  });

  it("accepts the existing plain-base64 and data-URL forms", () => {
    assert.deepEqual([...decodeUploadBase64(jpeg.base64)], [...jpegBytes()]);
    assert.deepEqual(
      validateUploadBatch([{ ...jpeg, base64: `  data:image/jpeg;base64,${jpeg.base64}  ` }]),
      [{ mime: "image/jpeg", ext: "jpg", sizeBytes: jpegBytes().length }],
    );
  });

  it("rejects empty selections, excess files and empty encoded content", () => {
    assert.throws(() => validateUploadBatch([]), /eine bis acht/);
    assert.throws(() => validateUploadBatch(Array.from({ length: 9 }, () => jpeg)), /eine bis acht/);
    for (const base64 of ["", "   ", "data:image/jpeg;base64,", "%%%"]) {
      assert.throws(() => validateUploadBatch([{ ...jpeg, base64 }]), /leer/i);
    }
  });

  it("accepts the exact 12-MB file limit with an optional data-URL prefix", () => {
    const bytes = Buffer.alloc(MAX_UPLOAD_BYTES);
    bytes.set(jpegBytes());
    const base64 = bytes.toString("base64");
    assert.equal(validateUploadBatch([{ ...jpeg, base64 }])[0].sizeBytes, MAX_UPLOAD_BYTES);
    assert.equal(
      validateUploadBatch([{ ...jpeg, base64: `data:image/jpeg;base64,${base64}` }])[0].sizeBytes,
      MAX_UPLOAD_BYTES,
    );
  });

  it("bounds encoded content before decoding or preparing a later oversized file", () => {
    const oversized = "A".repeat(MAX_BASE64_UPLOAD_CHARS + 1);
    assert.throws(() => decodeUploadBase64(oversized), /höchstens 12 MB/);
    assert.throws(() => validateUploadBatch([jpeg, { ...jpeg, base64: oversized }]), /höchstens 12 MB/);
    assert.throws(
      () => decodeUploadBase64("A".repeat(Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 4)),
      /höchstens 12 MB/,
    );
  });
});
