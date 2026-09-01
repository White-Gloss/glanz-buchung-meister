import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { accountingSummary } from "@/lib/admin.functions";
import { erpnextStatus, saveErpnextCredentials } from "@/lib/erpnext.functions";
import { ERPNEXT_DEFAULT_BASE_URL } from "@/lib/erpnext-site";
import { eur } from "@/lib/utils";
import { site } from "@/data/site";
import { Button, Field, inputClass } from "@/components/ui";

export const Route = createFileRoute("/admin/erpnext")({
  component: AdminAccounting,
});

type ErpStatus = Awaited<ReturnType<typeof erpnextStatus>>;

function AdminAccounting() {
  const [data, setData] = useState<Awaited<ReturnType<typeof accountingSummary>> | null>(null);
  const [status, setStatus] = useState<ErpStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    const [summary, next] = await Promise.all([
      accountingSummary().catch(() => null),
      erpnextStatus().catch(() => null),
    ]);
    setData(summary);
    setStatus(next);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const net = data ? data.confirmedCents / (1 + data.vatRate) : 0;
  const vat = data ? data.confirmedCents - net : 0;
  const connected = Boolean(status?.connected);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const result = await saveErpnextCredentials({ data: { apiKey, apiSecret } });
      setApiKey("");
      setApiSecret("");
      await refresh();
      setMessage(
        result.connected
          ? `WHITE GLOSS OS verbunden${result.user ? ` als ${result.user}` : ""}. Schreiben bleibt aus.`
          : "Schlüssel gespeichert, Anmeldung an WHITE GLOSS OS fehlgeschlagen. Bitte API-Zugang prüfen.",
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Verbindung fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Verwaltung</p>
      <h1 className="mt-2 font-display text-4xl">Buchhaltung</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Übersicht aus bestätigten Aufträgen und Belegstatus. ERPNext (WHITE GLOSS OS) ist das
        Betriebssystem für Kunden und Aufträge. Lexware bleibt für verbindliche Rechnungen.
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
            <li>
              ERPNext (WHITE GLOSS OS): {connected ? "verbunden" : "nicht verbunden"}
              {status?.user ? ` · ${status.user}` : ""}
            </li>
            <li>Lexware: nicht verbunden – verbindliche Rechnungen bleiben dort</li>
            <li>E-Mail {site.email}: Anfragen landen bereits im Posteingang</li>
          </ul>
          <p className="mt-3 text-xs text-subtle">
            Schreibrechte für Kunden und Aufträge bleiben aus, bis sie serverseitig freigegeben
            werden.
            {status?.writes.customer || status?.writes.vehicleOrder
              ? " Aktuell ist mindestens ein Schreibschalter offen."
              : " Aktuell geschlossen."}
          </p>
          <a
            className="mt-4 inline-flex min-h-11 items-center text-sm text-muted hover:text-fg"
            href={ERPNEXT_DEFAULT_BASE_URL}
            target="_blank"
            rel="noreferrer"
          >
            WHITE GLOSS OS öffnen
          </a>
        </section>
      </div>

      <form onSubmit={onSave} className="mt-8 max-w-xl space-y-4 rounded-md border border-line bg-surface p-5">
        <h2 className="font-display text-2xl">WHITE GLOSS OS verbinden</h2>
        <p className="text-sm leading-relaxed text-muted">
          In WHITE GLOSS OS unter Benutzer → API-Zugang einen Schlüssel für den technischen Benutzer
          anlegen. Der Schlüssel bleibt auf dem Server, nie im Browser. Öffentliche Besucher sehen
          das nicht.
        </p>
        <p className="text-xs text-subtle">System: {ERPNEXT_DEFAULT_BASE_URL}</p>
        {status?.configured ? (
          <p className="text-sm text-muted">
            Schlüssel {status.source === "env" ? "liegen serverseitig in der Umgebung" : "sind im Betriebspanel hinterlegt"}
            {connected ? " und die Anmeldung ist gültig." : ", die Anmeldung ist aber noch nicht gültig."}
          </p>
        ) : null}
        <Field id="erpnext-key" label="API-Schlüssel">
          <input
            id="erpnext-key"
            className={inputClass}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            required
            minLength={8}
            spellCheck={false}
          />
        </Field>
        <Field id="erpnext-secret" label="API-Geheimnis">
          <input
            id="erpnext-secret"
            type="password"
            className={inputClass}
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </Field>
        {message ? (
          <p className="text-sm text-muted" role="status">
            {message}
          </p>
        ) : null}
        {status?.error && !message ? (
          <p className="text-sm text-danger" role="alert">
            Letzte Prüfung: {status.error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Prüfe Verbindung …" : "Speichern und Verbindung prüfen"}
        </Button>
      </form>
    </main>
  );
}
