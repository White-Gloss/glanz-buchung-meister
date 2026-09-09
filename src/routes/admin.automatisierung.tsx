import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { BellRing, CalendarDays, Mail, ReceiptText, ShieldCheck, Workflow } from "lucide-react";
import {
  flushOutboundMail,
  getOperatorSettings,
  getNotificationStatus,
  inboundOperatorMessage,
  listAgentLog,
  listAutomationEvents,
  listOutbound,
  runAgentCommand,
  runReminders,
  type AgentLogRow,
} from "@/lib/admin.functions";
import { Button, inputClass } from "@/components/ui";
import { stamp } from "@/lib/utils";

export const Route = createFileRoute("/admin/automatisierung")({
  component: AdminAutomation,
});

const deliveryStatusLabels: Record<string, string> = {
  queued: "Geplant",
  processing: "Wird übermittelt",
  sent: "Übermittelt",
  failed: "Fehlgeschlagen",
  review: "Prüfung erforderlich",
  blocked: "Einrichtung fehlt",
  cancelled: "Nicht mehr aktuell",
};

function AdminAutomation() {
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<"panel" | "whatsapp" | "telegram">("panel");
  const [useAi, setUseAi] = useState(false);
  const [result, setResult] = useState("");
  const [log, setLog] = useState<AgentLogRow[]>([]);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof listAutomationEvents>>>([]);
  const [outbound, setOutbound] = useState<Awaited<ReturnType<typeof listOutbound>>>([]);
  const [pending, setPending] = useState(false);
  const [delivery, setDelivery] = useState<Awaited<
    ReturnType<typeof getNotificationStatus>
  > | null>(null);
  const [inboundPin, setInboundPin] = useState("WG-BETRIEB");
  const [inboundText, setInboundText] = useState("termine");
  const [inboundChannel, setInboundChannel] = useState<"whatsapp" | "telegram">("whatsapp");

  async function reload() {
    const [l, e, o, s, state] = await Promise.all([
      listAgentLog(),
      listAutomationEvents(),
      listOutbound(),
      getOperatorSettings().catch(() => ({ pin: "WG-BETRIEB", updatedAt: null })),
      getNotificationStatus(),
    ]);
    setLog(l);
    setEvents(e);
    setOutbound(o);
    setInboundPin(s.pin);
    setDelivery(state);
  }

  useEffect(() => {
    void reload().catch(() =>
      setResult("Automationsstatus konnte nicht geladen werden. Bitte erneut versuchen."),
    );
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await runAgentCommand({ data: { text, channel, useAi } });
      setResult(res.result);
      await reload();
      setText("");
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Befehl fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">White Gloss Workflow</p>
      <h1 className="mt-2 font-display text-4xl">Automatisierung</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Jede Anfrage wartet auf deine persönliche Bestätigung unter Buchungen. WhatsApp informiert
        dich über neue Anfragen und relevante Änderungen. Kunden erhalten E-Mails; Erinnerungen
        werden nur für bestätigte Termine versendet. Versandprobleme bleiben hier sichtbar.
      </p>
      {delivery ? (
        <div className="mt-5 rounded-md border border-line bg-surface p-4 text-sm" role="status">
          <p>
            WhatsApp: {delivery.whatsappConfigured ? "eingerichtet" : "Einrichtung fehlt"} · E-Mail:{" "}
            {delivery.emailConfigured ? "eingerichtet" : "Einrichtung fehlt"}
          </p>
          <p className="mt-2 text-muted">
            Automatischer Aufruf:{" "}
            {delivery.cronConfigured ? "Zugang eingerichtet" : "Einrichtung fehlt"}. Letzte
            Verarbeitung:{" "}
            {delivery.lastRun ? stamp(delivery.lastRun) : "noch kein erfolgreicher Lauf"}.
          </p>
        </div>
      ) : null}

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            { Icon: Mail, title: "E-Mail", text: "Anfrage und Bestätigung erzeugen Ausgang" },
            { Icon: CalendarDays, title: "Kalender", text: "ICS für Google, Outlook, Handy" },
            {
              Icon: ReceiptText,
              title: "Buchhaltung",
              text: "Neue Rechnungen erstellst und versendest du manuell in Odoo. Qonto bleibt das Bankkonto.",
            },
            {
              Icon: BellRing,
              title: "Erinnerungen",
              text: "24 Stunden vor der bestätigten Fahrzeugabgabe",
            },
          ] as const
        ).map(({ Icon, title, text }) => (
          <section key={title} className="rounded-md border border-line bg-surface p-5">
            <div className="flex items-center gap-2">
              <Icon aria-hidden className="size-4" />
              <h2 className="text-sm font-medium uppercase tracking-[0.12em]">{title}</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">{text}</p>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-md border border-line bg-surface p-5">
        <div className="flex items-center gap-2 text-fg">
          <Workflow aria-hidden className="size-4" />
          <h2 className="font-display text-2xl">Zielablauf</h2>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {[
            ["1", "Anfrage", "Kunde sendet den Konfigurator"],
            ["2", "Eingang", "Akte, Posteingang, interne Meldung"],
            ["3", "Zusage", "Ausschließlich persönlich unter Buchungen"],
            ["4", "Abgabe", "Bestätigte Abgabezeit im Kalender, Erinnerung vorab"],
            [
              "5",
              "Abschluss",
              "Manuell als erledigt markieren; Rechnung in Odoo erstellen und prüfen",
            ],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-sm border border-line bg-bg p-4">
              <p className="text-xs text-subtle">Schritt {n}</p>
              <p className="mt-2 font-medium">{t}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-start gap-2 text-sm text-muted">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          WhatsApp- und Telegram-Tokens niemals im Browser. Verbindung nur über Server-Geheimnisse
          beim Hoster.
        </p>
      </section>

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-4 rounded-md border border-line bg-surface p-5"
      >
        <h2 className="font-display text-2xl">KI-Agent</h2>
        <p className="text-sm text-muted">
          Unterstützt bei Übersichten und internen Entwürfen. Die KI darf keine Termine bestätigen
          oder Buchungsstatus ändern.
        </p>
        <label className="flex flex-col gap-2 text-sm">
          Kanal
          <select
            className={inputClass}
            value={channel}
            onChange={(e) => setChannel(e.target.value as typeof channel)}
          >
            <option value="panel">Betriebspanel</option>
            <option value="whatsapp">WhatsApp (Simulation)</option>
            <option value="telegram">Telegram (Simulation)</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Befehl
          <textarea
            className={`${inputClass} min-h-24 py-2`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="termine"
            required
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
          Freitext mit KI interpretieren
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            Befehl ausführen
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              setPending(true);
              try {
                const res = await runReminders();
                setResult(res.result);
                await reload();
              } catch {
                setResult("Erinnerungen konnten nicht verarbeitet werden. Bitte erneut versuchen.");
              } finally {
                setPending(false);
              }
            }}
            disabled={pending}
          >
            Erinnerungen jetzt
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              setPending(true);
              try {
                const res = await flushOutboundMail();
                setResult(
                  `Versandliste: ${res.sent} übermittelt, ${res.retried} erneut geplant, ${res.failed + res.review} benötigen Prüfung.`,
                );
                await reload();
              } catch (err) {
                setResult(err instanceof Error ? err.message : "Versand fehlgeschlagen.");
              } finally {
                setPending(false);
              }
            }}
            disabled={pending}
          >
            Versandliste jetzt prüfen
          </Button>
        </div>
      </form>

      <form
        className="mt-8 space-y-4 rounded-md border border-line bg-surface p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          try {
            const res = await inboundOperatorMessage({
              data: {
                pin: inboundPin,
                text: inboundText,
                channel: inboundChannel,
                useAi: useAi,
              },
            });
            setResult(
              res.ok ? `Eingang ${inboundChannel}: ${res.result}` : `Abgelehnt: ${res.result}`,
            );
            await reload();
          } catch (err) {
            setResult(err instanceof Error ? err.message : "Eingang fehlgeschlagen.");
          } finally {
            setPending(false);
          }
        }}
      >
        <h2 className="font-display text-2xl">Befehle im Betriebspanel prüfen</h2>
        <p className="text-sm text-muted">
          Dieser Test benötigt deine angemeldete Betriebssitzung. Messenger-Nachrichten können keine
          Termine freigeben. Test-PIN ändern unter{" "}
          <Link to="/admin/einstellungen" className="underline hover:text-fg">
            Einstellungen
          </Link>
          . Tokens bleiben beim Hoster, nicht im Browser.
        </p>
        <label className="flex flex-col gap-2 text-sm">
          Kanal
          <select
            className={inputClass}
            value={inboundChannel}
            onChange={(e) => setInboundChannel(e.target.value as "whatsapp" | "telegram")}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="telegram">Telegram</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          PIN
          <input
            className={inputClass}
            value={inboundPin}
            onChange={(e) => setInboundPin(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Nachricht
          <textarea
            className={`${inputClass} min-h-24 py-2`}
            value={inboundText}
            onChange={(e) => setInboundText(e.target.value)}
            placeholder="termine"
            required
          />
        </label>
        <Button type="submit" disabled={pending}>
          Befehl prüfen
        </Button>
      </form>

      {result ? (
        <pre className="mt-6 whitespace-pre-wrap rounded-md border border-line bg-elevated p-4 font-sans text-sm">
          {result}
        </pre>
      ) : (
        <p className="mt-6 text-sm text-muted">
          Befehle: termine, post, kunde &lt;Name&gt;, rechnung &lt;ID&gt;, erinnerung. Termine
          persönlich unter Buchungen bestätigen.
        </p>
      )}

      <h2 className="mt-10 font-display text-2xl">Versandliste</h2>
      <ul className="mt-4 space-y-2">
        {outbound.length === 0 ? (
          <li className="text-sm text-muted">Noch kein Ausgang.</li>
        ) : (
          outbound.map((row) => (
            <li key={row.id} className="border-t border-line pt-2 text-sm">
              <span className="text-xs text-subtle">
                {row.channel} · {deliveryStatusLabels[row.status] || row.status} ·{" "}
                {stamp(row.created_at)}
              </span>
              <p>
                {row.subject} → {row.to_addr}
              </p>
              {row.last_error_code && ["failed", "blocked", "review"].includes(row.status) ? (
                <p className="mt-1 text-danger">
                  {row.status === "blocked"
                    ? "Die Verbindung muss eingerichtet oder geprüft werden."
                    : row.last_error_code === "legacy_delivery_unverified"
                      ? "Historischer Ausgang: vor einer erneuten Nachricht bitte die bisherige Zustellung prüfen."
                      : row.status === "review"
                        ? "Die Zustellung ist unklar. Bitte beim Anbieter prüfen, bevor du erneut schreibst."
                        : "Die Nachricht konnte nicht zugestellt werden. Bitte den Empfänger oder die Verbindung prüfen."}{" "}
                  Versuche: {row.attempt_count}.
                </p>
              ) : null}
            </li>
          ))
        )}
      </ul>

      <h2 className="mt-10 font-display text-2xl">Protokoll</h2>
      <ul className="mt-4 space-y-3">
        {events.map((entry) => (
          <li key={`e-${entry.id}`} className="border-t border-line pt-3 text-sm">
            <p className="text-xs text-subtle">
              {entry.area} · {stamp(entry.created_at)}
            </p>
            <p>
              {entry.event}
              {entry.context ? ` · ${entry.context}` : ""}
            </p>
          </li>
        ))}
        {log.map((entry) => (
          <li key={`a-${entry.id}`} className="border-t border-line pt-3 text-sm">
            <p className="text-xs text-subtle">
              Agent · {entry.channel} · {stamp(entry.created_at)}
            </p>
            <p className="mt-1 text-fg">{entry.input}</p>
            <p className="mt-1 whitespace-pre-wrap text-muted">{entry.result}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
