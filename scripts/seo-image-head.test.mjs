import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import * as media from "../src/data/media-src.ts";
import * as site from "../src/data/site.ts";
import * as policy from "../src/lib/seo-policy.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/lib/seo.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
const dependencies = {
  "@/data/media-src": media,
  "@/data/site": site,
  "@/lib/seo-policy": policy,
};
const exports = {};
new Function("require", "exports", compiled.outputText)((specifier) => {
  assert.ok(specifier in dependencies, `Unexpected production dependency: ${specifier}`);
  return dependencies[specifier];
}, exports);

function imageMetadata(image) {
  const head = exports.pageHead({
    title: "Geprüfte Bildmetadaten",
    description: "Serverlose Regression",
    path: "/ueber-uns",
    ...(image ? { image } : {}),
  });
  return {
    image: head.meta.find((tag) => tag.property === "og:image")?.content,
    type: head.meta.find((tag) => tag.property === "og:image:type")?.content,
  };
}

test("pageHead describes extensionless public Studio images as the WebP returned by the media route", () => {
  const image = "/api/studio-media/12345678-1234-4123-8123-123456789abc";
  assert.deepEqual(imageMetadata(image), {
    image: `${site.site.origin}${image}`,
    type: "image/webp",
  });
});

test("pageHead preserves ordinary JPEG, WebP and default image metadata", () => {
  for (const [image, expectedImage, type] of [
    ["/media/atelier.jpg", "/media/atelier.jpg", "image/jpeg"],
    ["/media/atelier-800.webp", "/media/atelier-800.webp", "image/webp"],
    [undefined, "/media/hero.jpg", "image/jpeg"],
    ["/api/studio-media-upload", "/api/studio-media-upload", "image/jpeg"],
    ["/media/other-extensionless-image", "/media/other-extensionless-image", "image/jpeg"],
  ]) {
    assert.deepEqual(imageMetadata(image), {
      image: `${site.site.origin}${expectedImage}`,
      type,
    });
  }
});
