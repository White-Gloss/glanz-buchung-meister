import { STUDIO_IMAGE_MAX_BYTES } from "./studio-media.model.ts";

export class StudioUploadError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "StudioUploadError";
    this.status = status;
  }
}

export async function readStudioUpload(
  request: Request,
  options = { maxBytes: STUDIO_IMAGE_MAX_BYTES + 65536, timeoutMs: 15000 },
): Promise<File> {
  const contentType = request.headers.get("content-type") || "";
  if (
    !/^multipart\/form-data\s*;/i.test(contentType) ||
    contentType.length > 300 ||
    request.headers.has("content-encoding")
  ) {
    throw new StudioUploadError("Bitte das Bild über das Upload-Formular auswählen.");
  }
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > options.maxBytes)) {
    throw new StudioUploadError("Bitte ein Bild mit höchstens 12 MiB übertragen.", 413);
  }
  if (!request.body) throw new StudioUploadError("Die Bilddatei fehlt.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new StudioUploadError(
            "Die Übertragung hat zu lange gedauert. Bitte erneut versuchen.",
            408,
          ),
        ),
      options.timeoutMs,
    );
  });
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), expired]);
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > options.maxBytes)
        throw new StudioUploadError("Bitte ein Bild mit höchstens 12 MiB übertragen.", 413);
      chunks.push(chunk.value);
    }
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let form: FormData;
  try {
    form = await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    }).formData();
  } catch {
    throw new StudioUploadError(
      "Das Upload-Formular konnte nicht gelesen werden. Bitte erneut versuchen.",
    );
  }
  if (form.getAll("file").length !== 1 || [...form.keys()].some((key) => key !== "file")) {
    throw new StudioUploadError("Bitte genau eine Bilddatei übertragen.");
  }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > STUDIO_IMAGE_MAX_BYTES) {
    throw new StudioUploadError("Bitte ein Bild zwischen 1 Byte und 12 MiB auswählen.", 413);
  }
  return file;
}
