import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { accountingSummary } from "@/lib/admin.functions";
import { eur } from "@/lib/utils";
import { site } from "@/data/site";

export const Route = createFileRoute("/admin/erpnext")({
  component: AdminAccounting,
});

function AdminAccounting() {
  const [data, setData] = useState<Awaited<ReturnType<typeof accountingSummary>> | null>(null);

  useEffect(() => {
    void accountingSummary()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const net = data ? data.confirmedCents / (1 + data.vatRate) : 0;
  const vat = data ? data.confirmedCents - net : 0;

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Verwaltung</p>
      <h1 className="mt-2 font-display text-4xl">Buchhaltung</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Übersicht aus bestätigten Aufträgen und Belegstatus. ERPNext und Lexware bleiben die
        Systeme der Wahrheit – hier sehen Sie, was noch offen ist, bevor Sie verbuchen.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ["Bestätigtes Volumen", data ? eur(data.confirmedCents / 100) : "—", `${data?.confirmedCount ?? 0} Aufträge`],
          ["Offene Rechnungen", data ? eur(data.openInvoiceCents / 100) : "—", `${data?.openInvoiceCount ?? 0} Belege`],
          ["Bezahlt", data ? eur(data.paidInvoiceCents / 100) : "—", `${data?.paidInvoiceCount ?? 0} Belege`],
        ].map(([t, v, s]) => (
          <div key={t} className="rounded-md border border-line bg-surface p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-subtle">{t}</p>
            <p className="mt-2 font-display text-3xl">{v}</p>
            <p className="mt-1 text-sm text-muted">{s}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="font-display text-2xl">MwSt.-Schätzung</h2>
          <p className="mt-3 text-sm text-muted">
            Netto {eur(net / 100)} · 19 % {eur(vat / 100)} · Brutto{" "}
            {data ? eur(data.confirmedCents / 100) : "—"}.
          </p>
          <p className="mt-2 text-xs text-subtle">
            Kein Steuerbescheid. Kleinunternehmerregelung ist in den Stammdaten nicht aktiv.
          </p>
        </section>
        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="font-display text-2xl">Anbindungen</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>ERPNext (WHITE GLOSS OS): nicht verbunden</li>
            <li>Lexware: nicht verbunden – verbindliche Rechnungen bleiben dort</li>
            <li>E-Mail {site.email}: Anfragen landen bereits im Posteingang</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
