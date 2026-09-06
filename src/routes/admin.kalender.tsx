import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { calendarIcs } from "@/lib/admin.functions";
import { listBookings, type BookingRow } from "@/lib/bookings.functions";
import { bookingStatuses, timeSlots } from "@/data/site";
import { eur } from "@/lib/utils";
import { Button } from "@/components/ui";

export const Route = createFileRoute("/admin/kalender")({
  component: AdminCalendar,
});

function startOfWeek(d: Date) {
  const day = d.getDay() || 7;
  const copy = new Date(d);
  copy.setDate(copy.getDate() - day + 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function AdminCalendar() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    void listBookings()
      .then(setRows)
      .catch(() => setError("Termine konnten nicht geladen werden. Bitte erneut versuchen."))
      .finally(() => setLoading(false));
  }, []);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDays(anchor, i)), [anchor]);

  const byDate = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const row of rows) {
      if (!row.preferred_date) continue;
      const date = row.preferred_date.slice(0, 10);
      const list = map.get(date) ?? [];
      list.push(row);
      map.set(date, list);
    }
    return map;
  }, [rows]);

  const open = rows.filter((r) => r.status === "neu" || r.status === "bestaetigt");

  async function downloadIcs() {
    if (downloading) return;
    setDownloading(true);
    setError("");
    try {
      const file = await calendarIcs();
      const blob = new Blob([file.ics], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = file.filename;
        a.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      setError("Der Kalender konnte nicht heruntergeladen werden. Bitte erneut versuchen.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Planung</p>
          <h1 className="mt-2 font-display text-4xl">Kalender</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={downloading}
            onClick={() => void downloadIcs()}
          >
            {downloading ? "Kalender wird erstellt …" : "ICS für Google/Outlook"}
          </Button>
          <button
            type="button"
            className="min-h-11 rounded-sm border border-line px-3 text-sm"
            onClick={() => setAnchor(shiftDays(anchor, -7))}
          >
            Vorherige Woche
          </button>
          <button
            type="button"
            className="min-h-11 rounded-sm border border-line px-3 text-sm"
            onClick={() => setAnchor(startOfWeek(new Date()))}
          >
            Heute
          </button>
          <button
            type="button"
            className="min-h-11 rounded-sm border border-line px-3 text-sm"
            onClick={() => setAnchor(shiftDays(anchor, 7))}
          >
            Nächste Woche
          </button>
        </div>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Die Uhrzeit bezeichnet die Fahrzeugabgabe; die Bearbeitungsdauer planst du selbst. Anfragen
        sind erst nach persönlicher Bestätigung fest eingeplant. Alle Vorgänge zur selben Abgabezeit
        bleiben sichtbar. Über den jeweiligen Eintrag kannst du prüfen oder umbuchen. Der
        ICS-Download ist eine Momentaufnahme für angemeldete Betriebsnutzer.
      </p>
      {error ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className="mt-4"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError("");
          try {
            setRows(await listBookings());
          } catch {
            setError("Termine konnten nicht geladen werden. Bitte erneut versuchen.");
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "Termine werden geladen …" : "Aktualisieren"}
      </Button>
      <div className="mt-8 grid gap-3 md:grid-cols-7">
        {days.map((day) => {
          const key = iso(day);
          const items = byDate.get(key) ?? [];
          return (
            <section
              key={key}
              className="min-w-0 break-words rounded-md border border-line bg-surface p-3"
            >
              <h2 className="text-sm font-medium">
                {day.toLocaleDateString("de-DE", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </h2>
              <ul className="mt-3 space-y-2">
                {timeSlots.map((slot) => {
                  const matches = items.filter((i) => i.preferred_slot === slot);
                  const requests = matches.filter(
                    (i) => i.status === "neu" || i.status === "bestaetigt",
                  );
                  return (
                    <li key={slot} className="text-xs">
                      <span className="text-subtle">{slot}</span>
                      {matches.length ? (
                        <>
                          {requests.length > 1 ? (
                            <span className="mt-1 block font-medium text-danger">
                              Mehrere Anfragen – Verfügbarkeit prüfen
                            </span>
                          ) : null}
                          {matches.map((hit) => (
                            <Link
                              key={hit.id}
                              to="/admin"
                              hash={`booking-${hit.id}`}
                              className="mt-1 block min-h-11 rounded-sm border border-line p-2 text-fg hover:border-fg"
                            >
                              WG-{hit.id} · {hit.customer_name}
                              <span className="block font-medium">
                                {bookingStatuses.find((status) => status.id === hit.status)
                                  ?.label ?? hit.status}
                              </span>
                              <span className="block text-muted">{eur(hit.total_cents / 100)}</span>
                            </Link>
                          ))}
                        </>
                      ) : (
                        <span className="mt-1 block text-subtle">
                          {loading ? "Lädt …" : "Kein Eintrag"}
                        </span>
                      )}
                    </li>
                  );
                })}
                {items
                  .filter(
                    (i) =>
                      !i.preferred_slot || !timeSlots.some((slot) => slot === i.preferred_slot),
                  )
                  .map((i) => (
                    <li key={i.id} className="text-xs text-fg">
                      <Link
                        to="/admin"
                        hash={`booking-${i.id}`}
                        className="block min-h-11 py-2 hover:underline"
                      >
                        WG-{i.id} · {i.customer_name} · {i.preferred_slot || "ohne Abgabezeit"}
                        <span className="block">
                          {bookingStatuses.find((status) => status.id === i.status)?.label ??
                            i.status}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          );
        })}
      </div>
      <section className="mt-10">
        <h2 className="font-display text-2xl">Ohne Wunschdatum</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          {open.filter((r) => !r.preferred_date).length === 0 ? (
            <li>Alle offenen Anfragen haben ein Datum oder es gibt keine.</li>
          ) : (
            open
              .filter((r) => !r.preferred_date)
              .map((r) => (
                <li key={r.id}>
                  <Link
                    to="/admin"
                    hash={`booking-${r.id}`}
                    className="inline-block min-h-11 py-2 hover:underline"
                  >
                    WG-{r.id} {r.customer_name} · {r.package_id} ·{" "}
                    {bookingStatuses.find((status) => status.id === r.status)?.label ?? r.status}
                  </Link>
                </li>
              ))
          )}
        </ul>
      </section>
    </main>
  );
}
