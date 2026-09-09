import { useRef, useState, type FormEvent } from "react";
import { attachBookingPhotos } from "@/lib/bookings.functions";
import { Button, Field, inputLine } from "./ui";
import { SubmissionResult } from "./submission-result";
import { UPLOAD_MIME_TYPES, uploadSelectionError } from "@/lib/upload-policy";

const ACCEPT = UPLOAD_MIME_TYPES.join(",");

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
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const selectionError = uploadSelectionError(files);
    if (selectionError) {
      setError(selectionError);
      inputRef.current?.focus();
      return;
    }
    setPending(true);
    setError("");
    try {
      const payload = await Promise.all(
        files.map(async (file) => ({
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
          : "Die Dateien konnten nicht hochgeladen werden. Bitte versuchen Sie es später erneut oder kontaktieren Sie uns telefonisch.";
      setError(message);
      setPending(false);
    }
  }

  if (sent) {
    return (
      <SubmissionResult className="mt-12 rounded-card border border-line bg-elevated p-5 text-sm text-muted">
        {count === 1
          ? "Eine Aufnahme ist eingegangen. Wir prüfen sie im Zusammenhang mit Ihrer Anfrage."
          : `${count} Aufnahmen sind eingegangen. Wir prüfen sie im Zusammenhang mit Ihrer Anfrage.`}
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
        Optional bis zu 8 Aufnahmen zu {vorgang}. JPEG, PNG oder WebP bevorzugt — kurze Videos
        (MP4, WebM, MOV) sind möglich. Die Dateien werden ausschließlich im internen Archiv gespeichert und sind nicht
        öffentlich. Höchstens 12 MB pro Aufnahme. Bitte innerhalb von 7 Tagen im Browser
        Ihrer Anfrage nachreichen.
      </p>
      <Field tone="public" id="booking-photos" label="Fotos oder kurzes Video (max. 8)">
        <input
          ref={inputRef}
          id="booking-photos"
          type="file"
          accept={ACCEPT}
          multiple
          disabled={pending}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "booking-photos-error" : undefined}
          className={`${inputLine} text-sm`}
          onChange={(e) => {
            setFiles(Array.from(e.target.files ?? []));
            setError("");
          }}
        />
        {files.length ? (
          <ul className="space-y-1 text-xs text-subtle">
            <li>{files.length} {files.length === 1 ? "Datei ausgewählt" : "Dateien ausgewählt"}</li>
            {files.map((file) => (
              <li className="break-all" key={`${file.name}-${file.size}-${file.lastModified}`}>{file.name}</li>
            ))}
          </ul>
        ) : null}
      </Field>
      {error ? (
        <p id="booking-photos-error" className="break-words text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        tone="public"
        type="submit"
        disabled={pending || files.length === 0}
        aria-busy={pending}
      >
        {pending ? "Wird hochgeladen …" : "Aufnahmen senden"}
      </Button>
    </form>
  );
}
