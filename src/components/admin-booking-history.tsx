import { useEffect, useRef, useState } from "react";
import { bookingStatuses } from "@/data/site";
import { getBookingHistory } from "@/lib/bookings.functions";
import { eur } from "@/lib/utils";
import { Button } from "./ui";

type Entries = Awaited<ReturnType<typeof getBookingHistory>>;
type CachedHistory = { bookingId: number; version: number; entries: Entries };
const eventLabels: Record<string, string> = {
  "booking.created": "Anfrage eingegangen",
  "booking.confirmed": "Persönlich bestätigt",
  "booking.rejected": "Abgelehnt",
  "booking.cancelled": "Storniert",
  "booking.rescheduled": "Abgabe geändert – erneute Bestätigung erforderlich",
  "booking.updated": "Buchungsdaten bearbeitet",
  "booking.completed": "Als erledigt markiert",
  "booking.no_show": "Als nicht erschienen markiert",
  "booking.imported": "Bestehende Buchung übernommen",
};
const fieldLabels: Record<string, string> = {
  status: "Status",
  name: "Name",
  phone: "Telefon",
  email: "E-Mail",
  date: "Abgabedatum",
  slot: "Abgabezeit",
  packageId: "Leistung",
  classId: "Fahrzeugklasse",
  extraIds: "Extras",
  citySlug: "Abholort",
  note: "Notiz",
  totalCents: "Gesamtpreis",
};

function displayValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "Keine Angabe";
  if (field === "totalCents" && typeof value === "number") return eur(value / 100);
  if (field === "status")
    return bookingStatuses.find((status) => status.id === value)?.label ?? String(value);
  return String(value);
}

function actorLabel(actor: string, event: string) {
  if (actor === "public" || actor === "customer") return "Kundenanfrage";
  if (actor === "migration") return "Datenübernahme";
  return `${event === "booking.confirmed" ? "Inhaberkonto" : "Betriebskonto"}: ${actor}`;
}

export function AdminBookingHistory({
  bookingId,
  version,
}: {
  bookingId: number;
  version: number;
}) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<CachedHistory | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const cache = useRef<CachedHistory | null>(null);

  useEffect(() => {
    if (!open || (cache.current?.bookingId === bookingId && cache.current.version === version))
      return;
    let disposed = false;
    setPending(true);
    setError("");
    getBookingHistory({ data: { id: bookingId } })
      .then((entries) => {
        if (disposed) return;
        const result = { bookingId, version, entries };
        cache.current = result;
        setHistory(result);
      })
      .catch(() => {
        if (!disposed) setError("Der Änderungsverlauf konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!disposed) setPending(false);
      });
    return () => {
      disposed = true;
    };
  }, [open, bookingId, version, retry]);

  const entries =
    history?.bookingId === bookingId && history.version === version ? history.entries : null;
  return (
    <details
      className="mt-4 min-w-0 border-t border-line pt-2"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
        Änderungsverlauf
      </summary>
      {open ? (
        <div className="min-w-0 pb-3 text-sm" aria-busy={pending}>
          {pending ? (
            <p role="status" className="text-muted">
              Verlauf wird geladen …
            </p>
          ) : null}
          {error ? (
            <div className="space-y-2">
              <p role="alert" className="text-danger">
                {error}
              </p>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  cache.current = null;
                  setRetry((value) => value + 1);
                }}
              >
                Erneut laden
              </Button>
            </div>
          ) : null}
          {!pending && !error && entries?.length === 0 ? (
            <p className="text-muted">Keine Änderungen gespeichert.</p>
          ) : null}
          {entries ? (
            <ol className="min-w-0 space-y-4">
              {entries.map((entry) => {
                const changed = entry.before_data
                  ? Object.keys(fieldLabels).filter(
                      (field) => entry.before_data?.[field] !== entry.after_data[field],
                    )
                  : [];
                return (
                  <li key={entry.id} className="min-w-0 break-words border-l border-line pl-3">
                    <p className="font-medium">{eventLabels[entry.event] ?? entry.event}</p>
                    <p className="text-xs text-muted">
                      <time dateTime={new Date(entry.created_at).toISOString()}>
                        {new Date(entry.created_at).toLocaleString("de-DE", {
                          timeZone: "Europe/Berlin",
                        })}
                      </time>
                      {" · "}Version {entry.version}
                    </p>
                    <p className="mt-1 break-words text-xs text-muted">
                      {actorLabel(entry.actor, entry.event)}
                    </p>
                    {changed.length ? (
                      <dl className="mt-2 min-w-0 space-y-2">
                        {changed.map((field) => (
                          <div key={field} className="min-w-0">
                            <dt className="text-xs font-medium">{fieldLabels[field]}</dt>
                            <dd className="min-w-0 whitespace-pre-wrap break-words text-xs text-muted">
                              Vorher: {displayValue(field, entry.before_data?.[field])}
                              {"\n"}Danach: {displayValue(field, entry.after_data[field])}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
