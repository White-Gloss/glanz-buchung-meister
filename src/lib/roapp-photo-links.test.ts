import assert from "node:assert/strict";
import { test } from "node:test";
import { photoToken, verifyPhotoToken } from "./roapp-photo-links.ts";

test("photo access is bound to the exact file, secret and expiry", () => {
  const photo = { id: 12, storage_path: "bookings/1/abcdef.jpg" };
  const secret = "x".repeat(32);
  const expires = 1800000000;
  const token = photoToken(photo, expires, secret);
  assert.equal(verifyPhotoToken(token, photo, secret, (expires - 1) * 1000), true);
  assert.equal(verifyPhotoToken(token, photo, secret, expires * 1000), false);
  assert.equal(verifyPhotoToken(token, { ...photo, id: 13 }, secret, 0), false);
  assert.equal(verifyPhotoToken(token, { ...photo, storage_path: "other.jpg" }, secret, 0), false);
  assert.equal(verifyPhotoToken(token, photo, "y".repeat(32), 0), false);
  assert.equal(
    verifyPhotoToken(token.replace(String(expires), String(expires + 1)), photo, secret, 0),
    false,
  );
});
