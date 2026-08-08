/**
 * Bild-Optimierungs-Script
 * ========================
 * Konvertiert Bilder aus `public/assets/` in drei Formate und responsive Größen.
 *
 * Verwendung:
 *   node scripts/optimize-images.mjs
 *
 * Legt ein Originalbild (z. B. hero-car.jpg) in `public/assets/` ab.
 * Das Script erzeugt daraus:
 *   - hero-car.avif    (modern, kleinste Dateigröße)
 *   - hero-car.webp    (breite Browser-Unterstützung)
 *   - hero-car.jpg     (Fallback, optimiert)
 *   - hero-car-800.avif/webp/jpg (für Mobile)
 */

import { readdir, stat, mkdir } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import sharp from "sharp";

const ASSETS_DIR = join(import.meta.dirname, "..", "public", "assets");
const SIZES = [
  { suffix: "", width: 1920 },
  { suffix: "-800", width: 800 },
];

const FORMATS = [
  { ext: "avif", options: { quality: 55, effort: 4 } },
  { ext: "webp", options: { quality: 80, effort: 4 } },
  { ext: "jpg", options: { quality: 85, mozjpeg: true } },
];

async function optimizeImage(filePath) {
  const name = basename(filePath, extname(filePath));
  const image = sharp(filePath);

  for (const size of SIZES) {
    const resized = image.clone().resize({ width: size.width, withoutEnlargement: true });

    for (const fmt of FORMATS) {
      const outName = `${name}${size.suffix}.${fmt.ext}`;
      const outPath = join(ASSETS_DIR, outName);
      try {
        await resized.toFormat(fmt.ext, fmt.options).toFile(outPath);
        const { size: bytes } = await stat(outPath);
        console.log(`  ✅ ${outName} (${(bytes / 1024).toFixed(1)} KB)`);
      } catch (err) {
        console.error(`  ❌ ${outName}: ${err.message}`);
      }
    }
  }
}

async function main() {
  await mkdir(ASSETS_DIR, { recursive: true });

  const files = await readdir(ASSETS_DIR);
  const sourceImages = files.filter(
    (f) =>
      /\.(jpg|jpeg|png)$/i.test(f) &&
      !f.includes("-800.") &&
      !f.endsWith(".avif") &&
      !f.endsWith(".webp"),
  );

  if (sourceImages.length === 0) {
    console.log("ℹ️  Keine Quellbilder in public/assets/ gefunden.");
    console.log("   Lege JPG/PNG-Dateien dort ab und führe das Script erneut aus.");
    return;
  }

  console.log(`🖼️  Optimiere ${sourceImages.length} Bild(er)...\n`);

  for (const file of sourceImages) {
    console.log(`📸 ${file}:`);
    await optimizeImage(join(ASSETS_DIR, file));
    console.log();
  }

  console.log("✨ Fertig!");
}

main().catch((err) => {
  console.error("Fehler:", err);
  process.exit(1);
});
