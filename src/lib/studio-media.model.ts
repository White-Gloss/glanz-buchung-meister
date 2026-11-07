export const STUDIO_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
export const STUDIO_IMAGE_MAX_PIXELS = 40_000_000;
export const STUDIO_IMAGE_MAX_EDGE = 2400;
export const STUDIO_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type StudioAsset = {
  id: string;
  src: string;
  previewSrc: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
};

export type StudioMedia = {
  id: string;
  originalName: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  bytes: number;
  version: number;
  approved: boolean;
  archivedAt: string | null;
  previewUrl: string;
  publicUrl: string;
};

export type StudioMediaContent = {
  heroAssetId?: string | null;
  images: { assetId: string; alt: string; caption: string }[];
};

export function validateStudioImageBytes(bytes: Uint8Array, declaredType: string): string {
  if (!bytes.byteLength) throw new Error("Die Bilddatei ist leer.");
  if (bytes.byteLength > STUDIO_IMAGE_MAX_BYTES)
    throw new Error("Ein Bild darf höchstens 12 MiB groß sein.");
  const starts = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);
  const detected = starts([255, 216, 255])
    ? "image/jpeg"
    : starts([137, 80, 78, 71, 13, 10, 26, 10])
      ? "image/png"
      : starts([82, 73, 70, 70]) && starts([87, 69, 66, 80], 8)
        ? "image/webp"
        : null;
  if (!detected || declaredType !== detected) {
    throw new Error("Das Format passt nicht zum Dateiinhalt. Bitte JPEG, PNG oder WebP wählen.");
  }
  return detected;
}

export function isStudioMediaId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
}

export function sanitizeStudioMediaName(name: string): string {
  return (
    [...name]
      .slice(0, 160)
      .map((character) => {
        const code = character.charCodeAt(0);
        return character === "/" || character === "\\" || code < 32 || code === 127
          ? "_"
          : character;
      })
      .join("") || "Bild"
  );
}
