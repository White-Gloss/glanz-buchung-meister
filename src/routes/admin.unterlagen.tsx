import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  createDocumentFromBooking,
  listDocuments,
  updateDocumentStatus,
  type DocumentRow,
} from "@/lib/admin.functions";
import { listBookings, type BookingRow } from "@/lib/bookings.functions";
import { Button } from "@/components/ui";
import { eur } from "@/lib/utils";

export const Route = createFileRoute("/admin/unterlagen")({
  component: AdminDocs,
});

function AdminDocs() {
  const [docs, setDocs] = useState<DocumentRow[] | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [bookingId, setBookingId] = useState<number | "">("");
  const [kind, setKind] = useState<"angebot" | "rechnung" | "erinnerung">("angebot");

  async function reload() {
    const [d, b] = await Promise.all([listDocuments(), listBookings()]);
    setDocs(d);
    setBookings(b);
  }

  useEffect(() => {
    void reload().catch(() => setDocs([]));
  }, []);

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Verwaltung</p>
      <h1 className="mt-2 font-display text-4xl">Dokumente</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Angebote, Rechnungsentwürfe und Erinnerungen aus einer Buchung. Verbindliche
        Steuerbelege bleiben bei Lexware – hier entsteht die betriebliche Vorstufe.
      </p>
      <form
        className="mt-8 flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (bookingId === "") return;
          await createDocumentFromBooking({ data: { bookingId, kind } });
          await reload();
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          Buchung
          <select
            className="min-h-11 rounded-md border border-line bg-bg px-3"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Bitte wählen</option>
            {bookings.map((b) => (
              <option key={b.id} value={b.id}>
                #{b.id} {b.customer_name} · {eur(b.total_cents / 100)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Art
          <select
            className="min-h-11 rounded-md border border-line bg-bg px-3"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="angebot">Angebot</option>
            <option value="rechnung">Rechnung</option>
            <option value="erinnerung">Erinnerung</option>
          </select>
        </label>
        <Button type="submit">Anlegen</Button>
      </form>
      {docs === null ? (
        <p className="mt-8 text-sm text-muted">Laden …</p>
      ) : docs.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Noch keine Unterlagen.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {docs.map((d) => (
            <li key={d.id} className="rounded-md border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-subtle">
                    {d.kind} · {d.status}
                  </p>
                  <h2 className="font-display text-2xl">{d.title}</h2>
                </div>
                <p className="text-sm">{eur(d.amount_cents / 100)}</p>
              </div>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-muted">{d.body}</pre>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["entwurf", "gesendet", "bezahlt"] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={d.status === s ? "primary" : "ghost"}
                    onClick={async () => {
                      await updateDocumentStatus({ data: { id: d.id, status: s } });
                      await reload();
                    }}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
