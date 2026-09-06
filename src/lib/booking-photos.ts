/**
 * Server-only helpers for private vehicle photo uploads into the
 * `condition-photos` Supabase bucket. Never import the service role key
 * into client bundles — call these only from createServerFn handlers.
 */

export const CONDITION_PHOTOS_BUCKET = "condition-photos";

/** Matches the hardened bucket limit (12 MB after client-side optimisation). */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const PNG_SIG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function asciiAt(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** Detect MIME from magic bytes; returns null when the signature is unknown. */
export function sniffMagicMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 8 && PNG_SIG.every((b, i) => bytes[i] === b)) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    asciiAt(bytes, 0, 4) === "RIFF" &&
    asciiAt(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return "video/webm";
  }
  // ISO BMFF (MP4 / QuickTime): size(4) + "ftyp"
  if (bytes.length >= 12 && asciiAt(bytes, 4, 4) === "ftyp") {
    const brand = asciiAt(bytes, 8, 4);
    if (brand === "qt  ") return "video/quicktime";
    return "video/mp4";
  }
  return null;
}

export function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    case "video/quicktime":
      return "mov";
    default:
      return "jpg";
  }
}

function normalizeDeclaredMime(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized === "image/jpg" ? "image/jpeg" : normalized;
}

function mimeMatches(sniffed: string, declared: string): boolean {
  if (sniffed === declared) return true;
  // Both share the ISO BMFF ftyp box; browsers disagree on the label.
  return (
    (sniffed === "video/mp4" || sniffed === "video/quicktime") &&
    (declared === "video/mp4" || declared === "video/quicktime")
  );
}

/**
 * Validate size, allow-list, and that the declared MIME matches magic bytes.
 * Throws German error messages suitable for the public form.
 */
export function assertAllowedUpload(
  bytes: Uint8Array,
  declaredMime: string,
): { mime: string; ext: string } {
  if (!bytes.length) {
    throw new Error("Die Datei ist leer.");
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("Die Datei ist zu groß (höchstens 12 MB).");
  }
  const declared = normalizeDeclaredMime(declaredMime);
  if (!ALLOWED.has(declared)) {
    throw new Error(
      "Unterstützt werden JPEG, PNG, WebP sowie MP4, MOV und WebM.",
    );
  }
  const sniffed = sniffMagicMime(bytes);
  if (!sniffed) {
    throw new Error("Die Datei konnte nicht als Bild oder Video erkannt werden.");
  }
  if (!mimeMatches(sniffed, declared)) {
    throw new Error(
      "Die Datei stimmt nicht mit dem angegebenen Format überein.",
    );
  }
  // Prefer the client's declared label when it is an allowed ftyp alias.
  const mime = declared;
  return { mime, ext: extensionForMime(mime) };
}

function serviceRoleConfig(): { url: string; key: string } {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const url = (
    process.env.SUPABASE_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
  if (!key || !url) {
    throw new Error("Der Upload ist derzeit nicht verfügbar.");
  }
  return { url, key };
}

/** Upload bytes into the private condition-photos bucket via Storage REST. */
export async function uploadToConditionPhotos(
  path: string,
  bytes: Uint8Array,
  mime: string,
): Promise<void> {
  const { url, key } = serviceRoleConfig();
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const endpoint = `${url}/storage/v1/object/${CONDITION_PHOTOS_BUCKET}/${encodedPath}`;
  const body = Buffer.from(bytes);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": mime,
      "x-upsert": "true",
    },
    body,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(
      "[booking-photos] storage upload failed",
      response.status,
      detail.slice(0, 300),
    );
    throw new Error("Die Aufnahme konnte nicht hochgeladen werden.");
  }
}
