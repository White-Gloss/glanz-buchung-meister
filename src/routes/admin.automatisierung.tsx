import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  BellRing,
  CalendarDays,
  Mail,
  ReceiptText,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import {
  flushOutboundMail,
  getOperatorSettings,
  inboundOperatorMessage,
  listAgentLog,
  listAutomationEvents,
  listOutbound,
  runAgentCommand,
  runReminders,
  type AgentLogRow,
} from "@/lib/admin.functions";
import { agentHelpText } from "@/lib/agent";
import { Button, inputClass } from "@/components/ui";
import { stamp } from "@/lib/utils";

export const Route = createFileRoute("/admin/automatisierung")({
  component: AdminAutomation,
});

function AdminAutomation() {
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<"panel" | "whatsapp" | "telegram">("panel");
  const [useAi, setUseAi] = useState(false);
  const [result, setResult] = useState("");
  const [log, setLog] = useState<AgentLogRow[]>([]);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof listAutomationEvents>>>([]);
  const [outbound, setOutbound] = useState<Awaited<ReturnType<typeof listOutbound>>>([]);
  const [pending, setPending] = useState(false);
  const [pin, setPin] = useState("");
  const [inboundPin, setInboundPin] = useState("WG-BETRIEB");
  const [inboundText, setInboundText] = useState("termine");
  const [inboundChannel, setInboundChannel] = useState<"whatsapp" | "telegram">("whatsapp");

  async function reload() {
    const [l, e, o, s] = await Promise.all([
      listAgentLog(),
      listAutomationEvents(),
      listOutbound(),
      getOperatorSettings().catch(() => ({ pin: "WG-BETRIEB", updatedAt: null })),
    ]);
    setLog(l);
    setEvents(e);
    setOutbound(o);
    setPin(s.pin);
    setInboundPin(s.pin);
  }

  useEffect(() => {
    void reload().catch(() => undefined);
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
        Buchung mit freiem Wunschtermin: automatisch zugesagt. Ohne Datum, am Wochenende oder
        bei vollem Tag prüfst du unter Buchungen. Danach: Eingangsmail, Terminmail, Kalender,
        Erinnerung. Rechnung bleibt Lexware. WhatsApp an Kunden bleibt aus.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            { Icon: Mail, title: "E-Mail", text: "Anfrage und Bestätigung erzeugen Ausgang" },
            { Icon: CalendarDays, title: "Kalender", text: "ICS für Google, Outlook, Handy" },
            {
              Icon: ReceiptText,
              title: "Buchhaltung",
              text: "WHITE GLOSS OS über Buchhaltung verbinden; Lexware bleibt für Rechnungen",
            },
            {
              Icon: BellRing,
              title: "Erinnerungen",
              text: "Bestätigte Termine der nächsten 24 Stunden",
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
            ["1", "Buchung", "Kunde sendet den Konfigurator"],
            ["2", "Eingang", "Akte, Posteingang, interne Meldung"],
            ["3", "Zusage", "Automatisch bei freiem Werktag, sonst unter Buchungen"],
            ["4", "Rechnung", "Entwurf hier, Beleg in Lexware"],
            ["5", "Termin", "Kalender und Erinnerung"],
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

      <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-md border border-line bg-surface p-5">
        <h2 className="font-display text-2xl">KI-Agent</h2>
        <p className="text-sm text-muted">
          Gleiche Befehle wie später in WhatsApp und Telegram. Freitext nur auf Knopf – nie
          automatisch, nie bei jedem Tastendruck.
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
            placeholder="status 1 bestaetigt"
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
              const res = await runReminders();
              setResult(res.result);
              await reload();
            }}
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
                  `E-Mail-Warteschlange: ${res.sent} gesendet, ${res.failed} fehlgeschlagen, ${res.skipped} übersprungen.`,
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
            E-Mail-Warteschlange senden
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
              res.ok
                ? `Eingang ${inboundChannel}: ${res.result}`
                : `Abgelehnt: ${res.result}`,
            );
            await reload();
          } catch (err) {
            setResult(err instanceof Error ? err.message : "Eingang fehlgeschlagen.");
          } finally {
            setPending(false);
          }
        }}
      >
        <h2 className="font-display text-2xl">WhatsApp / Telegram Eingang</h2>
        <p className="text-sm text-muted">
          Derselbe Agent, den später der Messenger trifft. PIN aktuell: {pin || "WG-BETRIEB"}.
          Ändern unter{" "}
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
            placeholder="bestätige 1"
            required
          />
        </label>
        <Button type="submit" disabled={pending}>
          Nachricht wie aus dem Messenger
        </Button>
      </form>

      {result ? (
        <pre className="mt-6 whitespace-pre-wrap rounded-md border border-line bg-elevated p-4 font-sans text-sm">
          {result}
        </pre>
      ) : (
        <pre className="mt-6 whitespace-pre-wrap text-sm text-muted">{agentHelpText()}</pre>
      )}

      <h2 className="mt-10 font-display text-2xl">Versandliste</h2>
      <ul className="mt-4 space-y-2">
        {outbound.length === 0 ? (
          <li className="text-sm text-muted">Noch kein Ausgang.</li>
        ) : (
          outbound.map((row) => (
            <li key={row.id} className="border-t border-line pt-2 text-sm">
              <span className="text-xs text-subtle">
                {row.channel} · {row.status} · {stamp(row.created_at)}
              </span>
              <p>
                {row.subject} → {row.to_addr}
              </p>
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
