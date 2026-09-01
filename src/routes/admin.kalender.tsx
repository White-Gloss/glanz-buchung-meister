import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { calendarIcs } from "@/lib/admin.functions";
import { listBookings, type BookingRow } from "@/lib/bookings.functions";
import { timeSlots } from "@/data/site";
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

function AdminCalendar() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));

  useEffect(() => {
    void listBookings()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(anchor.getTime() + i * 86400000)),
    [anchor],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const row of rows) {
      if (!row.preferred_date) continue;
      if (row.status === "abgelehnt") continue;
      const list = map.get(row.preferred_date) ?? [];
      list.push(row);
      map.set(row.preferred_date, list);
    }
    return map;
  }, [rows]);

  const open = rows.filter((r) => r.status === "neu" || r.status === "bestaetigt");

  async function downloadIcs() {
    const file = await calendarIcs();
    const blob = new Blob([file.ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Planung</p>
          <h1 className="mt-2 font-display text-4xl">Kalender</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => void downloadIcs()}>
            ICS für Google/Outlook
          </Button>
          <button
            type="button"
            className="min-h-11 rounded-sm border border-line px-3 text-sm"
            onClick={() => setAnchor(new Date(anchor.getTime() - 7 * 86400000))}
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
            onClick={() => setAnchor(new Date(anchor.getTime() + 7 * 86400000))}
          >
            Nächste Woche
          </button>
        </div>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Privater Kalender-Feed der offenen und bestätigten Termine. Geheimnisse bleiben serverseitig –
        der Download gilt nur für angemeldete Betriebsnutzer.
      </p>
      <div className="mt-8 grid gap-3 md:grid-cols-7">
        {days.map((day) => {
          const key = iso(day);
          const items = byDate.get(key) ?? [];
          return (
            <section key={key} className="rounded-md border border-line bg-surface p-3">
              <h2 className="text-sm font-medium">
                {day.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}
              </h2>
              <ul className="mt-3 space-y-2">
                {timeSlots.map((slot) => {
                  const hit = items.find((i) => i.preferred_slot === slot);
                  return (
                    <li key={slot} className="text-xs">
                      <span className="text-subtle">{slot}</span>
                      {hit ? (
                        <span className="mt-1 block text-fg">
                          {hit.customer_name}
                          <span className="block text-muted">{eur(hit.total_cents / 100)}</span>
                        </span>
                      ) : (
                        <span className="mt-1 block text-subtle">frei</span>
                      )}
                    </li>
                  );
                })}
                {items
                  .filter((i) => !i.preferred_slot)
                  .map((i) => (
                    <li key={i.id} className="text-xs text-fg">
                      ohne Slot · {i.customer_name}
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
                  WG-{r.id} {r.customer_name} · {r.package_id}
                </li>
              ))
          )}
        </ul>
      </section>
    </main>
  );
}
