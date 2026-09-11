import { useState } from "react";
import { listBookingPhotos } from "@/lib/bookings.functions";

export function AdminBookingPhotos({ bookingId }: { bookingId: number }) {
  const [photos, setPhotos] = useState<Awaited<ReturnType<typeof listBookingPhotos>> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      setPhotos(await listBookingPhotos({ data: { bookingId } }));
    } catch {
      setError("Aufnahmen konnten nicht geladen werden.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className="mt-4 rounded-md border border-line p-3"
      onToggle={(e) => {
        if (e.currentTarget.open && photos === null && !busy) void load();
      }}
    >
      <summary className="cursor-pointer text-sm">Fahrzeugfotos anzeigen</summary>
      {busy ? <p role="status">Laden …</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {photos?.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Keine Aufnahmen vorhanden.</p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {photos?.map((photo) => (
          <div key={photo.id} className="min-w-0">
            {photo.url ? (
              photo.mime.startsWith("video/") ? (
                <video src={photo.url} controls className="max-h-64 w-full" />
              ) : (
                <a href={photo.url} target="_blank" rel="noreferrer">
                  <img
                    src={photo.url}
                    alt={photo.name}
                    loading="lazy"
                    className="max-h-64 w-full object-contain"
                  />
                </a>
              )
            ) : (
              <p className="text-sm">
                {photo.state === "ready"
                  ? "Vorschau nicht verfügbar. Links bitte aktualisieren."
                  : "Upload unvollständig."}
              </p>
            )}
            <p className="break-words text-xs text-muted">{photo.name}</p>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={busy}
        className="mt-3 min-h-11 text-sm underline"
        onClick={() => void load()}
      >
        Vorschaulinks aktualisieren
      </button>
    </details>
  );
}
