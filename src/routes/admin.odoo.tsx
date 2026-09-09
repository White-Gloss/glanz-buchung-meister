import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { accountingSummary } from "@/lib/admin.functions";
import {
  odooStatus,
  saveOdooApiKey,
  odooSyncOverview,
  setOdooSyncEnabled,
  retryOdooSync,
} from "@/lib/odoo.functions";
import { ODOO_DEFAULT_BASE_URL } from "@/lib/odoo-site";
import { eur } from "@/lib/utils";
import { site } from "@/data/site";
import { Button, Field, inputClass } from "@/components/ui";

const driveFolderUrl = "https://drive.google.com/drive/folders/18Sryi1PBc_lC_LRHITMVm97_QKmr4nUN";

export const Route = createFileRoute("/admin/odoo")({
  component: AdminOdoo,
});

type OdooStatus = Awaited<ReturnType<typeof odooStatus>>;

function AdminOdoo() {
  const [data, setData] = useState<Awaited<ReturnType<typeof accountingSummary>> | null>(null);
  const [status, setStatus] = useState<OdooStatus | null>(null);
  const [sync, setSync] = useState<Awaited<ReturnType<typeof odooSyncOverview>> | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    const [summary, next, transfers] = await Promise.all([
      accountingSummary().catch(() => null),
      odooStatus().catch(() => null),
      odooSyncOverview().catch(() => null),
    ]);
    setData(summary);
    setStatus(next);
    setSync(transfers);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const result = await saveOdooApiKey({ data: { apiKey } });
      setApiKey("");
      await refresh();
      setMessage(
        result.connected
          ? `Odoo verbunden${result.uid ? ` · Benutzer-ID ${result.uid}` : ""}.`
          : "Odoo-Anmeldung fehlgeschlagen. Der neue Schlüssel wurde nicht gespeichert. Bitte Schlüssel und API-Zugang prüfen.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verbindung fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  const connected = Boolean(status?.connected);

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Verwaltung</p>
      <h1 className="mt-2 font-display text-4xl">Odoo &amp; Qonto</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Neue Angebote und Rechnungen werden in Odoo erstellt. Qonto bleibt das Bankkonto; bestehende
        Qonto-Rechnungen werden erhalten. Terminbestätigung und Rechnungsversand erfolgen manuell.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          [
            "Bestätigtes Volumen",
            data ? eur(data.confirmedCents / 100) : "—",
            `${data?.confirmedCount ?? 0} Aufträge`,
          ],
          [
            "Offene Qonto-Rechnungen",
            data ? eur(data.openInvoiceCents / 100) : "—",
            `${data?.openInvoiceCount ?? 0} Belege`,
          ],
          [
            "Bezahlt",
            data ? eur(data.paidInvoiceCents / 100) : "—",
            `${data?.paidInvoiceCount ?? 0} Belege`,
          ],
        ].map(([title, value, detail]) => (
          <div key={title} className="rounded-md border border-line bg-surface p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-subtle">{title}</p>
            <p className="mt-2 font-display text-3xl">{value}</p>
            <p className="mt-1 text-sm text-muted">{detail}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-md border border-line bg-surface p-5">
        <h2 className="font-display text-2xl">Systemgrenzen</h2>
        <ul className="mt-3 grid gap-2 text-sm text-muted md:grid-cols-2">
          <li>Odoo: {connected ? "verbunden" : "noch nicht verbunden"}</li>
          <li>Qonto: Bankkonto und bestehende Rechnungen</li>
          <li>Website: Buchungsdaten aus der produktiven PostgreSQL-Datenbank</li>
          <li>
            <a className="hover:text-fg" href={driveFolderUrl} target="_blank" rel="noreferrer">
              Google Drive: zentraler Auftragsordner
            </a>
          </li>
          <li>WhatsApp/Meta: Kommunikation und Eingangskanäle</li>
          <li>IONOS-Mail {site.email}: geschäftlicher E-Mail-Kanal</li>
        </ul>
        <p className="mt-4 text-xs text-subtle">
          Odoo-Schreibzugriffe: Kunden {status?.writes.customers ? "freigegeben" : "gesperrt"} ·
          Aufträge {status?.writes.operations ? "freigegeben" : "gesperrt"}.
        </p>
        <a
          className="mt-4 inline-flex min-h-11 items-center text-sm text-muted hover:text-fg"
          href={`${ODOO_DEFAULT_BASE_URL}/odoo`}
          target="_blank"
          rel="noreferrer"
        >
          White-Gloss Odoo öffnen
        </a>
      </section>

      <section className="mt-8 rounded-md border border-line bg-surface p-5">
        <h2 className="font-display text-2xl">Buchungen nach Odoo übertragen</h2>
        <p className="mt-2 text-sm text-muted">
          Kontakte und Aufträge werden regelmäßig übertragen. Neue Anfragen warten weiterhin auf
          deine manuelle Terminbestätigung im Betriebspanel. Rechnungen werden dabei weder erstellt
          noch versendet.
        </p>
        {sync?.canManage ? (
          <Button
            type="button"
            className="mt-4"
            disabled={pending || !connected}
            onClick={async () => {
              setPending(true);
              setMessage("");
              try {
                await setOdooSyncEnabled({ data: { enabled: !status?.writes.operations } });
                await refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Umstellung fehlgeschlagen.");
              } finally {
                setPending(false);
              }
            }}
          >
            {status?.writes.operations
              ? "Übertragung pausieren"
              : "Automatische Übertragung einschalten"}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" className="mt-4" onClick={() => void refresh()}>
          Status aktualisieren
        </Button>
        {sync ? (
          <ul className="mt-4 divide-y divide-line">
            {sync.rows.map((row) => (
              <li
                key={row.booking_id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <span>
                  WG-{row.booking_id} ·{" "}
                  {row.status === "synced"
                    ? "Übertragen"
                    : row.status === "pending"
                      ? "Wartet auf Übertragung"
                      : row.status === "review"
                        ? "Prüfung erforderlich"
                        : "Übertragung fehlgeschlagen"}
                  {row.last_error ? (
                    <span className="block text-xs text-muted">
                      {row.last_error === "odoo_create_needs_review"
                        ? "Unklarer Erstellungsversuch: bestehenden Odoo-Datensatz prüfen, bevor erneut angelegt wird."
                        : row.last_error}
                    </span>
                  ) : null}
                </span>
                <span className="flex gap-3">
                  {row.odoo_order_id ? (
                    <a
                      className="underline"
                      target="_blank"
                      rel="noreferrer"
                      href={`${ODOO_DEFAULT_BASE_URL}/odoo/x_auftrage/${row.odoo_order_id}`}
                    >
                      Auftrag in Odoo
                    </a>
                  ) : null}
                  {sync.canManage && ["failed", "review"].includes(row.status) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={pending}
                      onClick={async () => {
                        setPending(true);
                        try {
                          await retryOdooSync({ data: { bookingId: row.booking_id } });
                          await refresh();
                        } catch (error) {
                          setMessage(
                            error instanceof Error ? error.message : "Prüfung fehlgeschlagen.",
                          );
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      Erneut prüfen
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">Übertragungsstatus konnte nicht geladen werden.</p>
        )}
      </section>

      <form
        onSubmit={onSave}
        className="mt-8 max-w-xl space-y-4 rounded-md border border-line bg-surface p-5"
      >
        <h2 className="font-display text-2xl">Odoo sicher verbinden</h2>
        <p className="text-sm leading-relaxed text-muted">
          Tragen Sie hier nur einen eigenen, widerrufbaren Odoo-API-Schlüssel ein. Er bleibt auf dem
          Server und wird nie an öffentliche Browser ausgeliefert. Die Verbindung benötigt bei Odoo
          Online den Custom-Tarif.
        </p>
        {status?.configured ? (
          <p className="text-sm text-muted">
            Schlüssel{" "}
            {status.source === "env"
              ? "liegt in der Serverumgebung"
              : "ist im Betriebspanel hinterlegt"}
            {connected
              ? " und wurde erfolgreich geprüft."
              : ", die Verbindung ist aber noch nicht gültig."}
          </p>
        ) : null}
        <Field id="odoo-key" label="Odoo-API-Schlüssel">
          <input
            id="odoo-key"
            type="password"
            className={inputClass}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="new-password"
            required
            minLength={20}
            spellCheck={false}
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
