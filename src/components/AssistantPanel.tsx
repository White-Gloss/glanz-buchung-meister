import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Copy, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  askAboutBookings,
  draftText,
  getAssistantStatus,
  type AssistantStatus,
} from "@/lib/assistant.functions";

/**
 * KI-ASSISTENT IM ADMINBEREICH
 * -----------------------------
 * Zwei Aufgaben, die ohne einen konkreten Vorgang auskommen: Fragen zum
 * eigenen Buchungsbestand und Textentwürfe für die Website. Der dritte Teil —
 * Antwortentwürfe an die Kundschaft — sitzt direkt an der jeweiligen Buchung,
 * weil er nur dort Sinn ergibt.
 *
 * Ohne hinterlegten Schlüssel erscheint dieser Bereich gar nicht: Ein Knopf,
 * der ausschließlich Fehlermeldungen erzeugt, ist schlimmer als kein Knopf.
 */

type Aufgabe = "frage" | "ratgeber" | "faq" | "ortstext";

const AUFGABEN: { id: Aufgabe; titel: string; platzhalter: string; hinweis: string }[] = [
  {
    id: "frage",
    titel: "Frage zu Ihren Buchungen",
    platzhalter: "Wie viele Anfragen kamen im letzten Monat, und welches Paket lief am besten?",
    hinweis: "Gerechnet wird ausschließlich mit Ihren tatsächlichen Buchungen.",
  },
  {
    id: "ratgeber",
    titel: "Ratgeber-Beitrag",
    platzhalter: "Warum eine Keramikversiegelung im Winter sinnvoll ist",
    hinweis: "Entwurf mit Titel und Suchmaschinen-Beschreibung. Bitte gegenlesen.",
  },
  {
    id: "faq",
    titel: "FAQ-Antworten",
    platzhalter: "Häufige Fragen zum Hol- und Bringservice",
    hinweis: "Frage-Antwort-Paare zum Einpflegen in die FAQ-Verwaltung.",
  },
  {
    id: "ortstext",
    titel: "Ortstext für eine Stadtseite",
    platzhalter: "Nagold",
    hinweis:
      "Liefert ein Gerüst mit Platzhaltern. Die echten Angaben zu Fahrzeugen und Aufträgen müssen von Ihnen kommen — erfundene Referenzen wären falsche Aussagen über Ihren Betrieb.",
  },
];

export function AssistantPanel() {
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [aufgabe, setAufgabe] = useState<Aufgabe>("frage");
  const [eingabe, setEingabe] = useState("");
  const [ergebnis, setErgebnis] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [kopiert, setKopiert] = useState(false);

  const fetchStatus = useServerFn(getAssistantStatus);
  const fragen = useServerFn(askAboutBookings);
  const texten = useServerFn(draftText);

  useEffect(() => {
    let aktiv = true;
    fetchStatus()
      .then((result) => aktiv && setStatus(result))
      .catch(() => aktiv && setStatus(null));
    return () => {
      aktiv = false;
    };
  }, [fetchStatus]);

  const aktuelle = AUFGABEN.find((a) => a.id === aufgabe)!;

  async function absenden() {
    const text = eingabe.trim();
    if (!text) {
      toast.error("Bitte geben Sie zuerst eine Frage oder ein Thema ein.");
      return;
    }
    setLaeuft(true);
    setErgebnis("");
    try {
      const antwort =
        aufgabe === "frage"
          ? await fragen({ data: { frage: text } })
          : await texten({ data: { kind: aufgabe, thema: text } });
      setErgebnis(antwort.text);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Der Assistent hat nicht geantwortet.");
    } finally {
      setLaeuft(false);
    }
  }

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(ergebnis);
      setKopiert(true);
      window.setTimeout(() => setKopiert(false), 2000);
    } catch {
      toast.error("Kopieren hat nicht geklappt. Bitte den Text von Hand markieren.");
    }
  }

  // Nicht eingerichtet oder kein Status: Bereich bleibt unsichtbar.
  if (!status?.configured) return null;

  return (
    <section className="glass mt-8 rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <Bot aria-hidden className="size-4 text-primary" />
        <h2 className="display-card text-sm uppercase">Assistent</h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Der Assistent macht <strong className="text-foreground/90">Vorschläge</strong>. Nichts davon
        geht automatisch an Kundschaft — Sie lesen gegen, ändern und schicken selbst.
      </p>

      <div
        role="tablist"
        aria-label="Art der Aufgabe"
        className="mt-5 flex flex-wrap gap-2 border-b border-border pb-4"
      >
        {AUFGABEN.map((a) => (
          <button
            key={a.id}
            role="tab"
            type="button"
            aria-selected={aufgabe === a.id}
            onClick={() => {
              setAufgabe(a.id);
              setErgebnis("");
            }}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              aufgabe === a.id
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {a.titel}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <Label htmlFor="assistent-eingabe">{aufgabe === "frage" ? "Ihre Frage" : "Thema"}</Label>
        <Textarea
          id="assistent-eingabe"
          rows={3}
          value={eingabe}
          placeholder={aktuelle.platzhalter}
          onChange={(event) => setEingabe(event.target.value)}
          className="mt-2"
        />
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{aktuelle.hinweis}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={absenden} loading={laeuft} disabled={laeuft}>
          {laeuft ? null : <Sparkles aria-hidden className="size-4" />}
          {aufgabe === "frage" ? "Antwort erzeugen" : "Entwurf erzeugen"}
        </Button>
        {ergebnis && (
          <Button variant="outline" onClick={kopieren}>
            {kopiert ? (
              <Check aria-hidden className="size-4" />
            ) : (
              <Copy aria-hidden className="size-4" />
            )}
            {kopiert ? "Kopiert" : "Text kopieren"}
          </Button>
        )}
      </div>

      {ergebnis && (
        <div className="mt-5">
          <h3 className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Entwurf</h3>
          <pre className="mt-2 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-card/70 p-4 font-sans text-sm leading-6 text-foreground/90">
            {ergebnis}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">
            Bitte vor der Verwendung prüfen. Angaben in eckigen Klammern sind Platzhalter, die Sie
            ersetzen müssen.
          </p>
        </div>
      )}
    </section>
  );
}
