import { useState, type FormEvent } from "react";
import { attachBookingPhotos } from "@/lib/bookings.functions";
import { Button, Field, inputLine } from "./ui";
import { SubmissionResult } from "./submission-result";

const MAX_FILES = 8;
const ACCEPT =
  "image/jpeg,image/png,image/webp,image/*,video/mp4,video/webm,video/quicktime,video/*";

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error("Die Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

export function BookingPhotoUpload({ vorgang }: { vorgang: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [count, setCount] = useState(0);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (files.length === 0) {
      setError("Bitte mindestens eine Aufnahme wählen.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const payload = await Promise.all(
        files.slice(0, MAX_FILES).map(async (file) => ({
          name: file.name.slice(0, 180),
          mime: file.type || "application/octet-stream",
          base64: await readFileAsBase64(file),
        })),
      );
      const result = await attachBookingPhotos({
        data: { vorgang, files: payload },
      });
      setCount(result.count);
      setSent(true);
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message
          : "Upload fehlgeschlagen. Bitte später erneut versuchen oder uns telefonisch erreichen.";
      setError(message);
      setPending(false);
    }
  }

  if (sent) {
    return (
      <SubmissionResult className="mt-12 rounded-card border border-line bg-elevated p-5 text-sm text-muted">
        {count === 1
          ? "Eine Aufnahme ist eingegangen. Wir schauen sie uns zum Vorgang an."
          : `${count} Aufnahmen sind eingegangen. Wir schauen sie uns zum Vorgang an.`}
      </SubmissionResult>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      data-hide-whatsapp
      aria-label="Fahrzeugfotos zum Vorgang hochladen"
      className="mt-12 space-y-5 rounded-card border border-line bg-surface p-5"
    >
      <h2 className="font-display text-2xl">Fahrzeugfotos nachreichen</h2>
      <p className="text-sm text-muted">
        Optional bis zu acht Aufnahmen zu {vorgang}. JPEG, PNG oder WebP bevorzugt — kurze Videos
        (MP4, WebM, MOV) sind möglich. Die Dateien landen nur im Betriebsarchiv und sind nicht
        öffentlich.
      </p>
      <Field tone="public" id="booking-photos" label="Fotos oder kurzes Video (max. 8)">
        <input
          id="booking-photos"
          type="file"
          accept={ACCEPT}
          multiple
          className={`${inputLine} text-sm`}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, MAX_FILES))}
        />
        {files.length ? (
          <ul className="space-y-1 text-xs text-subtle">
            <li>{files.length} Datei(en) gewählt</li>
            {files.map((file) => (
              <li key={`${file.name}-${file.size}-${file.lastModified}`}>{file.name}</li>
            ))}
          </ul>
        ) : null}
      </Field>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        tone="public"
        type="submit"
        disabled={pending || files.length === 0}
        aria-busy={pending}
      >
        {pending ? "Wird hochgeladen …" : "Fotos senden"}
      </Button>
    </form>
  );
}
