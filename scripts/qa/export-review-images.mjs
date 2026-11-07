import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { assertIsolatedGithubCi } from "../hosting-policy.mjs";

assertIsolatedGithubCi();
// Only screenshots of this run's synthetic fixtures/public website are exported.
// Original PNGs remain in the normal artifact; compact copies also travel in the
// decoded job log when an audit client cannot download binary ZIP artifacts.
const files = [
  "website-studio/desktop-preview.png",
  "website-studio/desktop-media.png",
  "website-studio/mobile-editor.png",
  "hero-stability/desktop-consent-rejected.png",
  "hero-stability/mobile-consent-rejected.png",
];
const output = resolve(".qa-output/review-images");
await mkdir(output, { recursive: true });
for (const file of files) {
  let source;
  try { source = await readFile(resolve(".qa-output", file)); }
  catch (error) {
    if (error.code === "ENOENT") { console.log(`REVIEW_IMAGE_MISSING:${file}`); continue; }
    throw error;
  }
  const { data, info } = await sharp(source).resize({ width: 1280, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
  const name = file.replaceAll("/", "-").replace(/\.png$/, ".jpg");
  await writeFile(resolve(output, name), data);
  console.log("WG_REVIEW_IMAGE:" + JSON.stringify({ name, width: info.width, height: info.height, sha256: createHash("sha256").update(data).digest("hex"), data: data.toString("base64") }));
}
