import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_UPLOAD_BYTES, uploadSelectionError } from "./upload-policy.ts";

const image = { name: "auto.jpg", size: 100, type: "image/jpeg" };
test("rejects an invalid selection before reading or submitting any files", () => {
  assert.match(uploadSelectionError([]), /mindestens/);
  assert.match(uploadSelectionError(Array(9).fill(image)), /acht/);
  assert.match(uploadSelectionError([image, { ...image, size: 0 }]), /leer/);
  assert.match(uploadSelectionError([image, { ...image, size: MAX_UPLOAD_BYTES + 1 }]), /12 MB/);
  assert.match(uploadSelectionError([{ ...image, type: "image/heic" }]), /Unterstützt/);
});
test("accepts the full allowed selection including the size boundary", () => {
  assert.equal(uploadSelectionError(Array(8).fill({ ...image, size: MAX_UPLOAD_BYTES })), "");
  assert.equal(uploadSelectionError([{ ...image, type: "video/quicktime" }]), "");
});
