import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  STUDIO_IMAGE_MAX_EDGE,
  STUDIO_IMAGE_MAX_PIXELS,
  validateStudioImageBytes,
} from "./studio-media.model.ts";

export async function optimizeStudioImage(bytes: Uint8Array, mime: string) {
  validateStudioImageBytes(bytes, mime);
  try {
    const decoder = sharp(bytes, {
      limitInputPixels: STUDIO_IMAGE_MAX_PIXELS,
      limitInputChannels: 4,
      failOn: "warning",
      animated: false,
    });
    const metadata = await decoder.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > STUDIO_IMAGE_MAX_PIXELS
    ) {
      throw new Error("Image dimensions exceed the studio limit");
    }
    if ((metadata.pages ?? 1) > 1) throw new Error("Animated images are not supported");
    // No keepMetadata/withMetadata: EXIF, GPS, XMP and the original filename are discarded.
    const { data, info } = await decoder
      .rotate()
      .resize({
        width: STUDIO_IMAGE_MAX_EDGE,
        height: STUDIO_IMAGE_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toColourspace("srgb")
      .webp({ quality: 82, effort: 4 })
      .timeout({ seconds: 10 })
      .toBuffer({ resolveWithObject: true });
    return {
      data,
      width: info.width,
      height: info.height,
      sha256: createHash("sha256").update(data).digest("hex"),
    };
  } catch {
    throw new Error(
      "Das Bild konnte nicht verarbeitet werden. Bitte ein intaktes, nicht animiertes JPEG, PNG oder WebP mit höchstens 40 Megapixeln wählen.",
    );
  }
}
