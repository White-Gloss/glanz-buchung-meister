import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  listDocuments,
  updateDocumentStatus,
  sendQontoInvoice,
  type DocumentRow,
} from "@/lib/admin.functions";
import { listBookings, type BookingRow } from "@/lib/bookings.functions";
import { Button } from "@/components/ui";
import { eur } from "@/lib/utils";
import { ODOO_DEFAULT_BASE_URL } from "@/lib/odoo-site";

export const Route = createFileRoute("/admin/unterlagen")({
  component: AdminDocs,
});

function AdminDocs() {
  const [docs, setDocs] = useState<DocumentRow[] | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  async function reload() {
    const [d, b] = await Promise.all([listDocuments(), listBookings()]);
    setDocs(d);
    setBookings(b);
  }

  useEffect(() => {
    void reload().catch(() => setDocs([]));
  }, []);

  const erledigtWithQonto = bookings.filter((b) => b.qonto_invoice_id || b.qonto_invoice_status);

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Verwaltung</p>
      <h1 className="mt-2 font-display text-4xl">Dokumente</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Neue Angebote, Rechnungen und Mahnungen erstellst du in Odoo. Der Rechnungsversand erfolgt
        manuell. Bestehende Qonto-Rechnungen bleiben hier erhalten.
      </p>
      {actionMsg ? <p className="mt-4 text-sm text-muted">{actionMsg}</p> : null}
      <a
        className="mt-6 inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm underline"
        href={`${ODOO_DEFAULT_BASE_URL}/odoo/accounting`}
        target="_blank"
        rel="noreferrer"
      >
        Rechnungen in Odoo öffnen
      </a>
      <p className="mt-2 text-xs text-muted">
        Ältere lokale Unterlagen und Qonto-Rechnungen sind unten weiterhin verfügbar.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Qonto-Rechnungen</h2>
        <p className="mt-1 text-sm text-muted">Status und Versand für erledigte Buchungen.</p>
        {erledigtWithQonto.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Noch keine Qonto-Rechnungen.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {erledigtWithQonto.map((b) => {
              const status = b.qonto_invoice_status || "—";
              const canSend =
                Boolean(b.qonto_invoice_id) &&
                (status === "unpaid" || status === "failed" || status === "sent");
              return (
                <li key={b.id} className="rounded-md border border-line bg-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-subtle">
                        WG-{b.id} · {b.status} · Qonto {status}
                      </p>
                      <h3 className="font-display text-xl">{b.customer_name}</h3>
                      <p className="mt-1 text-sm text-muted">
                        {b.qonto_invoice_number
                          ? `Nr. ${b.qonto_invoice_number}`
                          : "Noch keine Rechnungsnummer"}
                        {b.qonto_sent_at ? ` · gesendet ${b.qonto_sent_at}` : ""}
                      </p>
                      {b.qonto_invoice_error ? (
                        <p className="mt-2 text-sm text-muted">Fehler: {b.qonto_invoice_error}</p>
                      ) : null}
                    </div>
                    <p className="text-sm">{eur(b.total_cents / 100)}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {canSend ? (
                      <Button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={async () => {
                          setBusyId(b.id);
                          setActionMsg(null);
                          try {
                            const res = await sendQontoInvoice({ data: { bookingId: b.id } });
                            setActionMsg(
                              res.ok
                                ? `Rechnung WG-${b.id} per E-Mail gesendet.`
                                : res.error || "Versand fehlgeschlagen.",
                            );
                            await reload();
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        Per E-Mail senden
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
