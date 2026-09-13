import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, RefreshCw } from "lucide-react";
import { Button, Field, inputClass } from "@/components/ui";
import { bitrixAgentContext, runBitrixAgent } from "@/lib/bitrix-agent.functions";
import { BITRIX_AGENT_MODEL, type AgentAnswer } from "@/lib/bitrix-agent";

const steps = [
  [
    "Anfrage",
    "Kundendaten, Fahrzeug, Leistungen und Fotos gemeinsam erfassen. Preis vorläufig, Termin unverbindlich.",
  ],
  ["Eingang", "Sofortige E-Mail ohne PDF. Die Website bestätigt ausschließlich den Eingang."],
  [
    "Deine Prüfung",
    "Fotos, Leistungen, Preis, Beginn und Ende prüfen. Geändertes Angebot benötigt gegebenenfalls die Zustimmung des Kunden.",
  ],
  [
    "Zeitraum reservieren",
    "Bei deiner Freigabe die vollständige Dauer je Kapazität prüfen und sperren, einschließlich mehrtägiger Arbeiten.",
  ],
  [
    "Bestätigungs-PDF",
    "Nach Freigabe und Reservierung automatisch mit Logo und vereinbarten Angaben versenden. Noch keine Rechnung.",
  ],
  [
    "Dienstleistung abschließen",
    "Du bestätigst die tatsächliche Durchführung, den endgültigen Betrag und die Zahlungsvariante.",
  ],
  [
    "Separate Rechnung",
    "Barbetrag und Zahlungsdatum erfassen oder Überweisung mit sieben Kalendertagen Zahlungsziel. Versand und Zahlung zuordnen.",
  ],
];

export function BitrixAgentPanel() {
  const [context, setContext] = useState<Awaited<ReturnType<typeof bitrixAgentContext>> | null>(
    null,
  );
  const [bookingId, setBookingId] = useState("");
  const [question, setQuestion] = useState(
    "Prüfe diese Anfrage und die Fahrzeugfotos. Welche Angaben fehlen, was sollte ich vor der Freigabe prüfen und was ist der nächste manuelle Schritt?",
  );
  const [includePhotos, setIncludePhotos] = useState(true);
  const [answer, setAnswer] = useState<AgentAnswer | null>(null);
  const [answerLabel, setAnswerLabel] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const active = useRef(false);

  async function refresh() {
    try {
      setContext(await bitrixAgentContext());
      setError("");
    } catch {
      setError("Buchungen und KI-Verbindung konnten nicht geladen werden. Bitte erneut laden.");
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (active.current) return;
    const booking = context?.bookings.find((row) => row.id === Number(bookingId));
    if (bookingId && !booking) {
      setError("Bitte Buchungen neu laden und erneut auswählen.");
      return;
    }
    active.current = true;
    setPending(true);
    setAnswer(null);
    setError("");
    setAnswerLabel(
      booking ? `WG-${booking.id} · Stand ${booking.version}` : "Allgemeine Ablaufhilfe",
    );
    try {
      setAnswer(
        await runBitrixAgent({
          data: {
            requestId: crypto.randomUUID(),
            question,
            includePhotos,
            ...(booking ? { bookingId: booking.id, expectedVersion: booking.version } : {}),
          },
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Die Analyse ist fehlgeschlagen.");
    } finally {
      active.current = false;
      setPending(false);
    }
  }

  return (
    <section
      className="mt-8 space-y-5 rounded-md border border-line bg-surface p-5"
      aria-labelledby="bitrix-agent-title"
    >
      <div className="flex items-center gap-2">
        <Bot aria-hidden className="size-5" />
        <h2 id="bitrix-agent-title" className="font-display text-2xl">
          Dein KI-Agent
        </h2>
      </div>
      <p className="text-sm leading-6 text-muted">
        Unterstützt dich bei der Prüfung von Anfragen und Fahrzeugfotos. Bereitet Rückfragen und
        Vorschläge vor. Buchungsfreigabe, Kundenzustimmung, Leistungsabschluss und Zahlung
        bestätigst du persönlich.
      </p>
      <p className="text-xs text-subtle">{BITRIX_AGENT_MODEL} · VibeCode AI Router</p>
      {context && !context.configured ? (
        <p className="text-sm" role="status">
          Der persönliche VibeCode-API-Schlüssel fehlt.{" "}
          <Link className="underline" to="/admin/bitrix">
            Unter Bitrix24 hinterlegen
          </Link>
          . Ein REST-Webhook verbindet das CRM, stellt aber keinen KI-Zugang bereit.
        </p>
      ) : null}
      <form onSubmit={submit} className="space-y-4">
        <Field id="agent-booking" label="Buchungsanfrage">
          <select
            id="agent-booking"
            className={inputClass}
            value={bookingId}
            disabled={pending}
            onChange={(event) => {
              setBookingId(event.target.value);
              setAnswer(null);
            }}
          >
            <option value="">Allgemeine Ablaufhilfe</option>
            {context?.bookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                WG-{booking.id} · {booking.customer_name} · {booking.status}
              </option>
            ))}
          </select>
        </Field>
        <Field id="agent-question" label="Was soll der Agent prüfen?">
          <textarea
            id="agent-question"
            className={`${inputClass} min-h-28 py-2`}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            minLength={3}
            maxLength={2000}
            required
            disabled={pending}
          />
        </Field>
        <label className="flex items-start gap-2 text-sm leading-6 text-muted">
          <input
            type="checkbox"
            className="mt-1"
            checked={includePhotos}
            disabled={pending || !bookingId}
            onChange={(event) => setIncludePhotos(event.target.checked)}
          />
          Zugeordnete Fahrzeugfotos mitprüfen (bis zu vier Bilder, je 3 MB; Videos prüfst du
          selbst).
        </label>
        <p className="text-xs leading-5 text-muted">
          Die ausgewählte Anfrage und gegebenenfalls ihre Fotos werden für diese Analyse an VibeCode
          übergeben.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending || !context?.configured}>
            {pending ? "Anfrage wird analysiert …" : "Analyse starten"}
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => void refresh()}>
            <RefreshCw aria-hidden className="mr-2 size-4" /> Buchungen neu laden
          </Button>
          <Link className="inline-flex min-h-11 items-center text-sm underline" to="/admin">
            Buchungen prüfen
          </Link>
        </div>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {answer ? (
        <div className="space-y-4 rounded-md border border-line bg-bg p-4" aria-live="polite">
          <p className="text-xs text-subtle">
            KI-Vorschlag · {answerLabel} · keine Freigabe oder Reservierung
          </p>
          <p className="whitespace-pre-wrap text-sm leading-6">{answer.summary}</p>
          {(
            [
              ["Beobachtungen", answer.observations],
              ["Fehlende Angaben", answer.missingInformation],
              ["Deine nächsten Schritte", answer.recommendations],
            ] as const
          ).map(([label, items]) =>
            items.length ? (
              <div key={label}>
                <h3 className="text-sm font-medium">{label}</h3>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
                  {items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
          {answer.customerDraft ? (
            <div>
              <h3 className="text-sm font-medium">Kundentext · ungesendeter Entwurf</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                {answer.customerDraft}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      <details className="border-t border-line pt-4">
        <summary className="cursor-pointer text-sm font-medium">
          Dein festgelegter Ablauf in sieben Schritten
        </summary>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6">
          {steps.map(([title, description]) => (
            <li key={title}>
              <strong>{title}:</strong> {description}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm leading-6 text-muted">
          Dieser Ablauf ist die Vorgabe für den Agenten. Die vollständige Bedienung in Bitrix24, die
          Übernahme manueller Kalendersperren und die separate Rechnungs- und Zahlungsautomatik sind
          noch nicht vollständig angebunden und geprüft. Die KI kann diese Einrichtung nicht
          ersetzen.
        </p>
      </details>
    </section>
  );
}
