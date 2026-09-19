import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { customerPhotos } from "../src/data/customer-photos.ts";

test("all approved customer photographs have complete public responsive assets", () => {
  assert.equal(customerPhotos.length, 19);
  assert.equal(new Set(customerPhotos.map((photo) => photo.id)).size, 19);
  for (const photo of customerPhotos) {
    assert.ok(photo.title.length > 5);
    assert.ok(photo.alt.length > 20);
    assert.ok(photo.width > 0 && photo.height > 0);
    assert.ok(photo.src.startsWith("/media/customer-photos/"));
    for (const candidate of photo.srcSet.split(", ")) {
      const [src, descriptor] = candidate.split(" ");
      assert.ok(Number.parseInt(descriptor, 10) <= photo.width, "never upscale customer pictures");
      assert.ok(existsSync(`public${src}`), `missing ${src}`);
      const data = readFileSync(`public${src}`);
      assert.equal(data.toString("ascii", 0, 4), "RIFF");
      assert.equal(data.toString("ascii", 8, 12), "WEBP");
      assert.ok(!data.includes(Buffer.from("EXIF")), "strip original photo metadata");
    }
    assert.ok(existsSync(`public${photo.src}`));
  }
});

test("results route exposes real customer photos and keeps videos available", () => {
  const route = readFileSync("src/routes/galerie.tsx", "utf8");
  assert.ok(route.includes("<CustomerPhotoGallery"));
  assert.ok(route.includes("<CustomerVideoGallery"));
  assert.ok(!route.includes('name: "dellen"'), "no illustrative stock images among customer results");
  const source = readFileSync("src/components/customer-photo-gallery.tsx", "utf8");
  for (const feature of ["aria-pressed", "aria-labelledby", "showModal", "onCancel", "preventScroll", "ArrowLeft", "ArrowRight"]) {
    assert.ok(source.includes(feature), `${feature} accessibility behavior must remain`);
  }
});