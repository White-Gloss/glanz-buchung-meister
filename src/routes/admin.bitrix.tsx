import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  bitrixStatus,
  bitrixSyncOverview,
  retryBitrixSync,
  runBitrixNow,
  saveBitrixApiKey,
} from "@/lib/bitrix.functions";
import { Button, Field, inputClass } from "@/components/ui";

export const Route = createFileRoute("/admin/bitrix")({
  component: AdminBitrix,
});

function statusLabel(status: string) {
  if (status === "synced") return "Übertragen";
  if (status === "pending") return "Wartet auf Übertragung";
  if (status === "review") return "Prüfung erforderlich";
  return "Übertragung fehlgeschlagen";
}

function AdminBitrix() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof bitrixStatus>> | null>(null);
  const [sync, setSync] = useState<Awaited<ReturnType<typeof bitrixSyncOverview>> | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    const [next, transfers] = await Promise.all([
      bitrixStatus().catch(() => null),
      bitrixSyncOverview().catch(() => null),
    ]);
    setStatus(next);
    setSync(transfers);
  }

  useEffect(() => {
    void refresh().catch(() => setMessage("Bitrix-Status konnte nicht geladen werden."));
  }, []);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const result = await saveBitrixApiKey({ data: { apiKey } });
      setApiKey("");
      await refresh();
      setMessage(
        result.connected
          ? "Bitrix-Schlüssel gespeichert und geprüft. Offene Anfragen werden jetzt übertragen."
          : result.error || "Schlüssel wurde nicht gespeichert.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Betrieb</p>
      <h1 className="mt-2 font-display text-4xl">Bitrix24</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Das öffentliche Buchungspanel bleibt auf der Website. Jede gespeicherte Anfrage wird als
        Auftrag WG-… nach Bitrix24 übertragen: Kontakt, Leistungen, Fotos, später Termin und
        Rechnung. Zoho, Lexware und die lokale Buchung bleiben unverändert.
      </p>

      <section className="mt-8 rounded-md border border-line bg-surface p-5">
        <h2 className="font-display text-2xl">Verbindung</h2>
        <p className="mt-2 text-sm text-muted">
          {status?.configured
            ? status.source === "env"
              ? "Schlüssel liegt in der Serverumgebung."
              : "Schlüssel ist im Betriebspanel hinterlegt."
            : "Noch kein Schlüssel — unten die REST-Webhook-URL aus Bitrix24 einfügen. Ohne Verbindung bleibt die Website-Buchung gespeichert, Bitrix wartet."}
        </p>
        <p className="mt-2 text-sm text-muted">
          REST-API in Bitrix24: Anwendungen → Entwicklerressourcen → Anderes → Eingehender Webhook.
          Rechte CRM und Kalender. Die URL hier einfügen, nicht in den Chat.
        </p>
        {sync?.canManage ? (
          <form className="mt-4 max-w-xl space-y-3" onSubmit={onSave}>
            <Field id="bitrix-key" label="REST-Webhook-URL oder API-Schlüssel">
              <input
                id="bitrix-key"
                type="password"
                className={inputClass}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                autoComplete="new-password"
                required
                minLength={20}
                spellCheck={false}
              />
            </Field>
            <Button type="submit" disabled={pending || !apiKey.trim()}>
              {pending ? "Prüfe Verbindung …" : "Schlüssel speichern"}
            </Button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted">
            Den Schlüssel kann nur das Inhaberkonto speichern.
          </p>
        )}
        {sync?.canManage ? (
          <Button
            type="button"
            className="mt-4"
            disabled={pending || !status?.configured}
            onClick={async () => {
              setPending(true);
              setMessage("");
              try {
                const result = await runBitrixNow();
                await refresh();
                setMessage(
                  `Übertragung: ${result.synced} erfolgreich, ${result.failed} fehlgeschlagen, ${result.review} zur Prüfung, ${result.skipped} übersprungen.`,
                );
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Übertragung fehlgeschlagen.");
              } finally {
                setPending(false);
              }
            }}
          >
            Offene Aufträge jetzt übertragen
          </Button>
        ) : null}
        <Button type="button" variant="ghost" className="mt-4" onClick={() => void refresh()}>
          Status aktualisieren
        </Button>
        {message ? <p className="mt-4 text-sm text-muted">{message}</p> : null}
        <a
          className="mt-4 inline-flex min-h-11 items-center rounded-md border border-line px-4 text-sm underline"
          href="https://b24-emfor7.bitrix24.de"
          target="_blank"
          rel="noreferrer"
        >
          Bitrix24-Portal öffnen
        </a>
      </section>

      <section className="mt-8 rounded-md border border-line bg-surface p-5">
        <h2 className="font-display text-2xl">Übertragungen</h2>
        <p className="mt-2 text-sm text-muted">
          Quelle bleibt white-gloss.de/#buchung. Hier siehst du, welche Anfragen bereits als Deal
          angelegt sind.
        </p>
        {sync ? (
          sync.rows.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Noch keine Bitrix-Übertragungen.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {sync.rows.map((row) => (
                <li
                  key={row.booking_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <span>
                    WG-{row.booking_id} · {statusLabel(row.status)}
                    {row.bitrix_deal_id ? (
                      <span className="block text-xs text-muted">Deal {row.bitrix_deal_id}</span>
                    ) : null}
                    {row.last_error ? (
                      <span className="block text-xs text-muted">{row.last_error}</span>
                    ) : null}
                  </span>
                  {sync.canManage && ["failed", "review"].includes(row.status) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={pending}
                      onClick={async () => {
                        setPending(true);
                        try {
                          await retryBitrixSync({ data: { bookingId: row.booking_id } });
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
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="mt-4 text-sm text-muted">Übertragungsstatus konnte nicht geladen werden.</p>
        )}
      </section>
    </main>
  );
}
