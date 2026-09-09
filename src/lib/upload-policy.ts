export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 8;
export const UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

/** Check metadata before reading files into memory; the server also checks bytes. */
export function uploadSelectionError(
  files: readonly { name: string; size: number; type: string }[],
): string {
  if (files.length === 0) return "Bitte wählen Sie mindestens eine Aufnahme aus.";
  if (files.length > MAX_UPLOAD_FILES) return "Bitte wählen Sie höchstens 8 Aufnahmen aus.";
  for (const file of files) {
    if (!file.size) return `${file.name}: Die Datei ist leer.`;
    if (file.size > MAX_UPLOAD_BYTES) return `${file.name}: Höchstens 12 MB pro Aufnahme.`;
    if (!(UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)) {
      return `${file.name}: Unterstützt werden JPEG, PNG, WebP, MP4, MOV und WebM.`;
    }
  }
  return "";
}
