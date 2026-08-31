import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { dashboardStats } from "@/lib/admin.functions";
import { listBookings, updateBookingStatus, type BookingRow } from "@/lib/bookings.functions";
import { bookingStatuses, cities, extras, packages, type BookingStatus } from "@/data/site";
import { eur } from "@/lib/utils";
import { Button, inputClass } from "@/components/ui";

export const Route = createFileRoute("/admin/")({
  component: AdminBookings,
});

function extraLabel(raw: string) {
  try {
    const ids = JSON.parse(raw) as string[];
    return extras
      .filter((e) => ids.includes(e.id))
      .map((e) => e.name)
      .join(", ");
  } catch {
    return "";
  }
}

function AdminBookings() {
  const [rows, setRows] = useState<BookingRow[] | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof dashboardStats>> | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"alle" | BookingStatus>("alle");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<number | null>(null);

  async function reload() {
    const [bookings, dash] = await Promise.all([listBookings(), dashboardStats()]);
    setRows(bookings);
    setStats(dash);
  }

  useEffect(() => {
    void reload().catch(() => setError("Buchungen konnten nicht geladen werden."));
  }, []);

  const visible = useMemo(() => {
    const list = rows?.filter((r) => (filter === "alle" ? true : r.status === filter)) ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.customer_name, r.phone, r.email ?? "", String(r.id), r.package_id]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, filter, query]);

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Tagesgeschäft</p>
          <h1 className="mt-2 font-display text-4xl">Buchungen</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["alle", ...bookingStatuses.map((s) => s.id)] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`min-h-11 rounded-full px-4 text-sm ${
                filter === id ? "bg-accent text-accent-fg" : "border border-line text-muted"
              }`}
            >
              {id === "alle" ? "Alle" : bookingStatuses.find((s) => s.id === id)?.label}
            </button>
          ))}
        </div>
      </div>

      {stats ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Neu", String(stats.neu), "/admin/posteingang"] as const,
            ["Heute", String(stats.today), "/admin/kalender"] as const,
            ["Ungelesen", String(stats.unread), "/admin/posteingang"] as const,
            ["Bestätigt", eur(stats.confirmedCents / 100), "/admin/erpnext"] as const,
          ].map(([t, v, to]) => (
            <Link
              key={t}
              to={to}
              className="rounded-md border border-line bg-surface p-4 hover:border-fg"
            >
              <p className="text-xs uppercase tracking-[0.14em] text-subtle">{t}</p>
              <p className="mt-2 font-display text-3xl">{v}</p>
            </Link>
          ))}
        </div>
      ) : null}

      {stats ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["E-Mail Ausgang", stats.outboundEmail],
            ["WhatsApp Ausgang", stats.outboundWhatsapp],
            ["Telegram Ausgang", stats.outboundTelegram],
          ].map(([t, v]) => (
            <Link
              key={t}
              to="/admin/automatisierung"
              className="rounded-md border border-line bg-bg p-4 hover:border-fg"
            >
              <p className="text-xs uppercase tracking-[0.14em] text-subtle">{t}</p>
              <p className="mt-1 font-display text-2xl">{v}</p>
            </Link>
          ))}
        </div>
      ) : null}

      <label className="mt-8 block">
        <span className="sr-only">Buchungen durchsuchen</span>
        <input
          className={inputClass}
          value={query}
          maxLength={80}
          placeholder="Name, Telefon, E-Mail oder WG-Nummer"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {error ? <p className="mt-6 text-sm text-danger">{error}</p> : null}
      {rows === null && !error ? (
        <p className="mt-8 text-sm text-muted">Laden …</p>
      ) : visible.length === 0 ? (
        <p className="mt-8 rounded-md border border-line bg-surface p-6 text-sm text-muted">
          Noch keine Anfragen. Sobald jemand den Preisrechner absendet, erscheint die Buchung hier.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {visible.map((row) => {
            const pack = packages.find((p) => p.id === row.package_id);
            const city = cities.find((c) => c.slug === row.city_slug);
            const extra = extraLabel(row.extra_ids);
            return (
              <li key={row.id} className="rounded-md border border-line bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-subtle">WG-{row.id}</p>
                    <h2 className="font-display text-2xl">{row.customer_name}</h2>
                    <p className="mt-1 text-sm text-muted">
                      <a href={`tel:${row.phone}`} className="hover:text-fg">
                        {row.phone}
                      </a>
                      {row.email ? (
                        <>
                          {" · "}
                          <a href={`mailto:${row.email}`} className="hover:text-fg">
                            {row.email}
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <p className="font-display text-2xl">{eur(row.total_cents / 100)}</p>
                </div>
                <p className="mt-3 text-sm text-muted">
                  {pack?.name ?? row.package_id} · {row.class_id}
                  {city ? ` · ${city.name}` : ""}
                  {row.preferred_date
                    ? ` · ${row.preferred_date}${row.preferred_slot ? ` ${row.preferred_slot}` : ""}`
                    : ""}
                  {extra ? ` · ${extra}` : ""}
                </p>
                {row.note ? <p className="mt-2 text-sm text-fg">{row.note}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {row.status === "neu" ? (
                    <Button
                      type="button"
                      disabled={pending === row.id}
                      onClick={async () => {
                        setPending(row.id);
                        try {
                          await updateBookingStatus({
                            data: { id: row.id, status: "bestaetigt" },
                          });
                          await reload();
                        } finally {
                          setPending(null);
                        }
                      }}
                    >
                      Termin zusagen
                    </Button>
                  ) : null}
                  {bookingStatuses.map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      variant={row.status === s.id ? "primary" : "ghost"}
                      className="px-3"
                      disabled={pending === row.id}
                      onClick={async () => {
                        setPending(row.id);
                        try {
                          await updateBookingStatus({ data: { id: row.id, status: s.id } });
                          await reload();
                        } finally {
                          setPending(null);
                        }
                      }}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
                {row.status === "bestaetigt" ? (
                  <p className="mt-3 text-xs text-subtle">
                    Bestätigung erzeugt Ausgang in E-Mail, WhatsApp und Telegram sowie
                    Kalendererinnerung.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
