import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, ShieldCheck } from "lucide-react";
import {
  askVibeAgent,
  saveVibeAiKey,
  vibeAgentResult,
  vibeAgentStatus,
} from "@/lib/vibe-agent.functions";
import { Button, Field, inputClass } from "./ui";

export function BitrixAiAgent() {
  const [state, setState] = useState<Awaited<ReturnType<typeof vibeAgentStatus>> | null>(null);
  const [key, setKey] = useState("");
  const [question, setQuestion] = useState(
    "Prüfe die Anfrage und zeige mir, welche Angaben für meine manuelle Freigabe noch fehlen.",
  );
  const [bookingId, setBookingId] = useState("");
  const [pending, setPending] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef<{ requestId: string; question: string; bookingId?: number } | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);

  async function refresh() {
    setState(await vibeAgentStatus());
  }
  useEffect(() => {
    mounted.current = true;
    void refresh().catch(() => setError("KI-Status konnte nicht geladen werden."));
    return () => {
      mounted.current = false;
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setNotice("");
    setAnswer("");
    const data = {
      question: question.trim(),
      bookingId: bookingId ? Number(bookingId) : undefined,
    };
    if (
      !request.current ||
      request.current.question !== data.question ||
      request.current.bookingId !== data.bookingId
    ) {
      request.current = { ...data, requestId: crypto.randomUUID() };
    }
    const input = request.current;
    try {
      let result = await askVibeAgent({ data: input });
      for (let n = 0; result.status === "running" && n < 25 && mounted.current; n++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        result = (await vibeAgentResult({ data: { requestId: input.requestId } })) ?? result;
      }
      if (!mounted.current) return;
      if (result.status === "running")
        setNotice(
          "Die Anfrage wird noch verarbeitet. Erneutes Klicken fragt denselben Vorgang ab.",
        );
      else if (result.status === "failed") setError(result.error || "KI-Anfrage fehlgeschlagen.");
      else setAnswer(result.result || "Keine Antwort verfügbar.");
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Die Antwort konnte nicht geladen werden. Erneutes Klicken verwendet dieselbe Anfrage.",
        );
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      await saveVibeAiKey({ data: { apiKey: key } });
      setKey("");
      await refresh();
      setNotice("KI-Schlüssel geprüft und gespeichert.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Speichern fehlgeschlagen.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <section id="ki-agent" className="mt-8 rounded-md border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-2xl">
          <Sparkles aria-hidden className="size-5" />
          White-Gloss KI-Agent
        </h2>
        <span className="text-xs text-muted">
          {state
            ? state.configured
              ? "KI bereit"
              : "KI-Schlüssel fehlt"
            : "Verbindung wird geprüft …"}
        </span>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
        Anfragen zusammenfassen, fehlende Angaben erkennen und Antworten vorbereiten. Wähle einen
        Auftrag, damit der Agent dessen gespeicherte Daten und Versandstatus berücksichtigt.
      </p>
      <p className="mt-3 flex items-start gap-2 text-sm">
        <ShieldCheck aria-hidden className="mt-1 size-4 shrink-0" />
        Du gibst Termine, Preise und Leistungsabschlüsse persönlich frei. KI-Antworten sind interne
        Entwürfe.
      </p>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer py-2">KI-Verbindung einrichten</summary>
        <p className="mt-2 text-muted">
          VibeCode AI Router · bitrix/bitrixgpt-5.5. Der KI-Schlüssel wird serverseitig gespeichert.
          Die CRM-Verbindung wird separat verwaltet.
        </p>
        {state?.canManage ? (
          <form onSubmit={save} className="mt-3 max-w-xl space-y-3">
            <Field id="vibe-ai-key" label="VibeCode-KI-Schlüssel">
              <input
                id="vibe-ai-key"
                type="password"
                className={inputClass}
                autoComplete="new-password"
                spellCheck={false}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                maxLength={400}
                required
                disabled={pending}
              />
            </Field>
            <Button disabled={pending || !key.trim()} type="submit">
              KI-Schlüssel prüfen und speichern
            </Button>
          </form>
        ) : (
          <p className="mt-3 text-muted">Einrichtung über das Inhaberkonto.</p>
        )}
      </details>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field id="vibe-booking" label="Auftrag">
          <select
            id="vibe-booking"
            className={inputClass}
            value={bookingId}
            disabled={pending}
            onChange={(e) => {
              setBookingId(e.target.value);
              setAnswer("");
            }}
          >
            <option value="">Allgemeine Frage zum Ablauf</option>
            {state?.bookings.map((b) => (
              <option key={b.id} value={b.id}>
                WG-{b.id} · {b.customer_name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="vibe-question" label="Deine Frage">
          <textarea
            id="vibe-question"
            className={`${inputClass} min-h-28 py-3`}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={2000}
            required
            disabled={pending}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || !state?.configured || !question.trim()}>
            {pending ? "KI prüft …" : "KI fragen"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              request.current = null;
              setAnswer("");
              setError("");
              setNotice("Nächster Aufruf verwendet den aktuellen Datenstand.");
            }}
          >
            Neue Auswertung
          </Button>
          <Link to="/admin" className="inline-flex min-h-11 items-center px-3 text-sm underline">
            Buchungen öffnen
          </Link>
        </div>
      </form>
      {error ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-4 text-sm text-muted" role="status">
          {notice}
        </p>
      ) : null}
      {answer ? (
        <div className="mt-5 rounded-md border border-line bg-bg p-4" role="status">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
            KI-Entwurf · Datenstand beim Aufruf
          </p>
          <p className="whitespace-pre-wrap break-words text-sm leading-7">{answer}</p>
        </div>
      ) : null}
      <p className="mt-4 text-xs leading-5 text-muted">
        Fotos prüfst du selbst. Die KI erhält hier den Uploadstatus; sie bewertet die Bilder nicht.
        Ein übertragener Deal allein bestätigt noch keinen vollständigen Bitrix-Rechnungsablauf.
      </p>
    </section>
  );
}
