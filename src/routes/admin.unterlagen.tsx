import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { listDocuments, type DocumentRow } from "@/lib/admin.functions";
import { listBookings, type BookingRow } from "@/lib/bookings.functions";
import {
  lexwareStatus,
  lexwareSyncOverview,
  setLexwareSyncEnabled,
  retryLexwareSync,
  saveLexwareApiKey,
  refreshLexwareInvoice,
  setLexwareAutomaticInvoices,
} from "@/lib/lexware.functions";
import { Button, Field, inputClass } from "@/components/ui";
import { eur } from "@/lib/utils";
import { LexwareBillingForm } from "@/components/lexware-billing-form";
import { CustomerMailPanel } from "@/components/customer-mail-panel";
import { sendLexwareCustomerMail } from "@/lib/customer-mail.functions";

export const Route = createFileRoute("/admin/unterlagen")({
  component: AdminDocs,
});

function lexwareStatusLabel(status: string) {
  if (status === "synced") return "Übertragen";
  if (status === "pending") return "Wartet auf Übertragung";
  if (status === "review") return "Prüfung erforderlich";
  return "Übertragung fehlgeschlagen";
}

function AdminDocs() {
  const [docs, setDocs] = useState<DocumentRow[] | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [lexStatus, setLexStatus] = useState<Awaited<ReturnType<typeof lexwareStatus>> | null>(
    null,
  );
  const [lexSync, setLexSync] = useState<Awaited<ReturnType<typeof lexwareSyncOverview>> | null>(
    null,
  );
  const [lexPending, setLexPending] = useState(false);
  const [lexKey, setLexKey] = useState("");
  const [automaticApproval, setAutomaticApproval] = useState(false);

  async function reload() {
    const [d, b, status, transfers] = await Promise.all([
      listDocuments(),
      listBookings(),
      lexwareStatus().catch(() => null),
      lexwareSyncOverview().catch(() => null),
    ]);
    setDocs(d);
    setBookings(b);
    setLexStatus(status);
    setLexSync(transfers);
  }

  useEffect(() => {
    void reload().catch(() =>
      setActionMsg("Dokumente konnten nicht geladen werden. Bitte erneut laden."),
    );
  }, []);

  const erledigtWithQonto = bookings.filter((b) => b.qonto_invoice_id || b.qonto_invoice_status);

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Verwaltung</p>
      <h1 className="mt-2 font-display text-4xl">Rechnungen & Lexware</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Hier bearbeitest du die Rechnungen zu deinen Aufträgen. Lexware führt die Belege. Nach
        Abschluss eines Auftrags wird dort automatisch eine Rechnung vorbereitet. Verbindliche
        Rechnungen benötigen die einmalige Aktivierung der Automatik und geprüfte Rechnungsdaten.
      </p>
      {actionMsg ? <p className="mt-4 text-sm text-muted">{actionMsg}</p> : null}

      <section className="mt-8 rounded-md border border-line bg-surface p-5">
        <h2 className="font-display text-2xl">Buchungen nach Lexware übertragen</h2>
        <p className="mt-2 text-sm text-muted">
          Nach der lokalen Speicherung legt die Queue den Kundenkontakt in Lexware Office an. Eine
          Entwurfsrechnung entsteht erst bei Status erledigt. Prüfe den Endpreis vor dem Abschluss.
          Ohne Rechnungsautomatik bleibt der Beleg ein Entwurf. Fertige Lexware-Rechnungen
          versendest du hier über Resend. Bereits bestehende Entwürfe müssen in Lexware
          fertiggestellt werden.
        </p>
        <p className="mt-2 text-sm text-muted">
          {lexStatus?.configured
            ? lexStatus.source === "env"
              ? "Schlüssel liegt in der Serverumgebung."
              : "Schlüssel ist im Betriebspanel hinterlegt."
            : "Noch kein Schlüssel — unten einfügen, nicht in den Chat."}
        </p>
        {lexSync?.canManage ? (
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <p>
              Verbindliche Rechnungsautomatik:{" "}
              <strong>{lexStatus?.autoFinalize ? "Aktiv" : "Aus"}</strong>
            </p>
            {!lexStatus?.autoFinalize ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={automaticApproval}
                  onChange={(e) => setAutomaticApproval(e.target.checked)}
                />
                Nach Abschluss dürfen verbindliche Lexware-Rechnungen entstehen, sobald ich Adresse,
                Leistungstag und Endpreis freigegeben habe. Der Versand bleibt ein separater
                Schritt.
              </label>
            ) : null}
            <Button
              type="button"
              disabled={
                lexPending ||
                !lexStatus?.configured ||
                (!lexStatus?.autoFinalize && !automaticApproval)
              }
              onClick={async () => {
                setLexPending(true);
                setActionMsg(null);
                try {
                  await setLexwareAutomaticInvoices({
                    data: { enabled: !lexStatus?.autoFinalize, understood: true },
                  });
                  setAutomaticApproval(false);
                  await reload();
                } catch (e) {
                  setActionMsg(e instanceof Error ? e.message : "Umstellung fehlgeschlagen.");
                } finally {
                  setLexPending(false);
                }
              }}
            >
              {lexStatus?.autoFinalize
                ? "Rechnungsautomatik ausschalten"
                : "Verbindliche Rechnungsautomatik aktivieren"}
            </Button>
          </div>
        ) : null}
        {lexSync?.canManage ? (
          <form
            className="mt-4 max-w-xl space-y-3"
            onSubmit={async (event: FormEvent) => {
              event.preventDefault();
              setLexPending(true);
              setActionMsg(null);
              try {
                const result = await saveLexwareApiKey({ data: { apiKey: lexKey } });
                setLexKey("");
                await reload();
                setActionMsg(
                  result.connected
                    ? "Lexware-Schlüssel gespeichert und geprüft."
                    : result.error || "Schlüssel wurde nicht gespeichert.",
                );
              } catch (error) {
                setActionMsg(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
              } finally {
                setLexPending(false);
              }
            }}
          >
            <Field id="lexware-key" label="Lexware-API-Schlüssel">
              <input
                id="lexware-key"
                type="password"
                className={inputClass}
                value={lexKey}
                onChange={(e) => setLexKey(e.target.value)}
                autoComplete="new-password"
                required
                minLength={20}
                spellCheck={false}
              />
            </Field>
            <Button type="submit" disabled={lexPending || !lexKey.trim()}>
              {lexPending ? "Prüfe Verbindung …" : "Schlüssel speichern"}
            </Button>
          </form>
        ) : null}
        {lexSync?.canManage ? (
          <Button
            type="button"
            className="mt-4"
            disabled={lexPending || !lexStatus?.configured}
            onClick={async () => {
              setLexPending(true);
              setActionMsg(null);
              try {
                await setLexwareSyncEnabled({ data: { enabled: !lexStatus?.enabled } });
                await reload();
              } catch (error) {
                setActionMsg(error instanceof Error ? error.message : "Umstellung fehlgeschlagen.");
              } finally {
                setLexPending(false);
              }
            }}
          >
            {lexStatus?.enabled
              ? "Lexware-Übertragung pausieren"
              : "Lexware-Übertragung einschalten"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="mt-4"
          onClick={() => void reload().catch(() => setActionMsg("Laden fehlgeschlagen."))}
        >
          Status aktualisieren
        </Button>
        {lexSync ? (
          lexSync.rows.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Noch keine Lexware-Übertragungen.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {lexSync.rows.map((row) => (
                <li
                  key={row.booking_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <span>
                    WG-{row.booking_id} · {row.customer_name} · {eur(row.total_cents / 100)}
                    <span className="block">{lexwareStatusLabel(row.status)}</span>
                    {row.lex_contact_id ? (
                      <span className="block text-xs text-muted">
                        Kontakt {row.lex_contact_id}
                        {row.lex_invoice_id
                          ? ` · ${row.invoice_number || "Rechnungsentwurf"} · ${row.invoice_status || "Status noch nicht abgerufen"}`
                          : " · noch keine Rechnung"}
                      </span>
                    ) : null}
                    {row.last_error ? (
                      <span className="block text-xs text-muted">
                        {row.write_pending
                          ? "Übertragung unklar. Vor einem weiteren Versuch den Beleg in Lexware prüfen, damit keine Dublette entsteht."
                          : row.last_error}
                      </span>
                    ) : null}
                  </span>
                  {row.lex_invoice_id ? (
                    <div className="flex flex-wrap gap-2">
                      <a
                        className="inline-flex min-h-11 items-center rounded-md border border-line px-4 underline"
                        href={`https://app.lexware.de/permalink/invoices/view/${encodeURIComponent(row.lex_invoice_id)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        In Lexware prüfen
                      </a>
                      {lexSync.canManage
                        ? (["invoice", "reminder"] as const).map((kind) => (
                            <Button
                              key={kind}
                              type="button"
                              variant="ghost"
                              disabled={lexPending}
                              onClick={async () => {
                                setLexPending(true);
                                setActionMsg(null);
                                try {
                                  const result = await sendLexwareCustomerMail({
                                    data: { bookingId: row.booking_id, kind, approved: true },
                                  });
                                  setActionMsg(
                                    result.queued
                                      ? "Versandauftrag gespeichert. Den Zustellstatus findest du im Versandverlauf."
                                      : "Versandauftrag existiert bereits; kein Doppelversand.",
                                  );
                                } catch (e) {
                                  setActionMsg(
                                    e instanceof Error
                                      ? e.message
                                      : "Versand konnte nicht vorbereitet werden.",
                                  );
                                } finally {
                                  setLexPending(false);
                                }
                              }}
                            >
                              {kind === "invoice"
                                ? "Rechnung per E-Mail senden"
                                : "Offenen Betrag prüfen & Zahlungserinnerung senden"}
                            </Button>
                          ))
                        : null}
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={lexPending}
                        onClick={async () => {
                          setLexPending(true);
                          try {
                            await refreshLexwareInvoice({ data: { bookingId: row.booking_id } });
                            await reload();
                          } catch {
                            setActionMsg(
                              "Der Rechnungsstatus konnte nicht von Lexware abgerufen werden.",
                            );
                          } finally {
                            setLexPending(false);
                          }
                        }}
                      >
                        Rechnungsstatus abrufen
                      </Button>
                      {row.invoice_checked_at ? (
                        <span className="w-full text-xs text-muted">
                          Stand: {new Date(row.invoice_checked_at).toLocaleString("de-DE")}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {lexSync.canManage &&
                  !row.write_pending &&
                  ["failed", "review"].includes(row.status) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={lexPending}
                      onClick={async () => {
                        setLexPending(true);
                        try {
                          await retryLexwareSync({ data: { bookingId: row.booking_id } });
                          await reload();
                        } catch (error) {
                          setActionMsg(
                            error instanceof Error ? error.message : "Prüfung fehlgeschlagen.",
                          );
                        } finally {
                          setLexPending(false);
                        }
                      }}
                    >
                      Erneut prüfen
                    </Button>
                  ) : null}
                  {lexSync.canManage && !row.lex_invoice_id && !row.write_pending ? (
                    <LexwareBillingForm
                      bookingId={row.booking_id}
                      totalCents={row.total_cents}
                      onSaved={reload}
                    />
                  ) : null}
                  {row.billing_data ? (
                    <p className="w-full text-xs text-muted">
                      Rechnungsdaten freigegeben: {row.billing_data.street}, {row.billing_data.zip}{" "}
                      {row.billing_data.city} · Leistungstag {row.billing_data.serviceDate}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="mt-4 text-sm text-muted">
            Lexware-Übertragungsstatus konnte nicht geladen werden.
          </p>
        )}
      </section>

      <CustomerMailPanel canManage={Boolean(lexSync?.canManage)} />
      <a
        className="mt-6 inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm underline"
        href="https://app.lexware.de/vouchers"
        target="_blank"
        rel="noreferrer"
      >
        Belege in Lexware öffnen
      </a>
      <p className="mt-2 text-xs text-muted">
        Ältere lokale Unterlagen und Qonto-Rechnungen sind unten weiterhin verfügbar.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Archiv: frühere Qonto-Rechnungen</h2>
        <p className="mt-1 text-sm text-muted">
          Historische Belege bleiben nachvollziehbar. Neue Rechnungen entstehen in Lexware.
        </p>
        {erledigtWithQonto.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Noch keine Qonto-Rechnungen.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {erledigtWithQonto.map((b) => {
              const status = b.qonto_invoice_status || "—";
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
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
