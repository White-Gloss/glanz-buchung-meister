import assert from "node:assert/strict";
import test from "node:test";
import { decodedGalleryImage } from "./qa/gallery-image.mjs";

const source = "http://127.0.0.1:8082/media/customer-photos/customer-16-1400.webp";
function fixture(decode) {
  return { src: source, currentSrc: source, complete: true, naturalWidth: 1200, naturalHeight: 1600, decode };
}

test("gallery image completion waits for decoding before the next action can proceed", async () => {
  let release;
  let finished = false;
  const pending = new Promise((resolve) => { release = resolve; });
  const image = fixture(() => pending);
  image.complete = false;
  const operation = decodedGalleryImage(image, source).then((value) => { finished = true; return value; });
  await Promise.resolve();
  assert.equal(finished, false, "The next key/navigation must remain blocked during download/decode");
  image.complete = true;
  release();
  assert.deepEqual(await operation, { source, width: 1200, height: 1600, decoded: true });
});

test("gallery decode failures remain errors instead of being treated as expected aborts", async () => {
  const image = fixture(async () => { throw new Error("Image decoding failed"); });
  await assert.rejects(decodedGalleryImage(image, source), /decoding failed/);
});

test("gallery cannot pass with a broken image or the previously selected image", async () => {
  const broken = fixture(async () => {});
  broken.naturalWidth = 0;
  await assert.rejects(decodedGalleryImage(broken, source), /not loaded/);
  const previous = fixture(async () => {});
  await assert.rejects(decodedGalleryImage(previous, source.replace("customer-16", "customer-09")), /different image/);
});

test("changing the selected image while decoding fails its exact-image proof", async () => {
  const image = fixture(async () => { image.currentSrc = source.replace("customer-16", "customer-09"); });
  await assert.rejects(decodedGalleryImage(image, source), /different image/);
});
