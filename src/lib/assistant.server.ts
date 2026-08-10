import Anthropic from "@anthropic-ai/sdk";

import { company, currency } from "./servicesConfig";
import { effectivePrice, type Booking } from "./bookings";

/**
 * KI-ASSISTENT IM ADMINBEREICH (serverseitig)
 * --------------------------------------------
 * Läuft ausschließlich auf dem Server. Der Schlüssel ANTHROPIC_API_KEY darf
 * niemals ein `VITE_`-Präfix bekommen — damit läge er im Browser-Bündel und
 * wäre für jeden Besucher lesbar.
 *
 * GRUNDREGEL: Der Assistent SCHLÄGT VOR, er handelt nicht. Kein Ergebnis geht
 * ungelesen an Kundschaft. Jede Antwort ist ein Entwurf, den White Gloss prüft,
 * ändert und selbst abschickt.
 *
 * DATENSCHUTZ: Für jede Anfrage werden Buchungsdaten an Anthropic übertragen —
 * das ist eine Auftragsverarbeitung im Sinne von Art. 28 DSGVO und braucht
 * einen Vertrag mit Anthropic sowie einen Eintrag im Verarbeitungsverzeichnis.
 * Deshalb ist der Assistent ohne gesetzten Schlüssel vollständig inaktiv und
 * im Adminbereich gar nicht sichtbar. Zustandsfotos gehen nur dann mit, wenn
 * die Bildbewertung ausdrücklich angefordert wird.
 */

const MODEL = "claude-opus-5";

/** Ohne Schlüssel bleibt der gesamte Assistent aus. */
export function assistantConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ist nicht gesetzt.");
  return new Anthropic({ apiKey });
}

/**
 * Gemeinsame Grundhaltung für alle Aufgaben.
 *
 * Bewusst knapp gehalten: Neuere Modelle folgen Anweisungen sehr genau, und
 * überlange Regelwerke führen eher zu steifen Ergebnissen als zu besseren.
 */
const GRUNDHALTUNG = [
  `Du unterstützt ${company.name}, einen Fahrzeugaufbereitungsbetrieb in Horb am Neckar.`,
  "",
  "Schreibe auf Deutsch, in der Sie-Form, sachlich und freundlich — so wie ein",
  "erfahrener Handwerksmeister mit seiner Kundschaft spricht. Keine Werbesprache,",
  "keine Ausrufezeichen-Ketten, keine Emojis.",
  "",
  "Erfinde nichts. Wenn eine Angabe fehlt, sage das offen, statt sie zu ergänzen.",
  "Nenne keine Uhrzeiten: Termine werden rein nach Datum vergeben und die Uhrzeit",
  "wird persönlich abgestimmt.",
].join("\n");

/** Kompakte, für das Modell lesbare Fassung einer Buchung. */
export function bookingSummary(booking: Booking): string {
  const zeilen = [
    `Vorgangsnummer: ${booking.invoiceNumber}`,
    `Eingegangen am: ${booking.createdAt.slice(0, 10)}`,
    `Wunschtermin: ${booking.date}`,
    `Status: ${booking.status}`,
    `Fahrzeug: ${booking.vehicleId}`,
    `Paket: ${booking.packageId}`,
    booking.addOnIds.length ? `Zusatzleistungen: ${booking.addOnIds.join(", ")}` : null,
    booking.pickupCity ? `Abholung in: ${booking.pickupCity}` : "Abholung: nein",
    `Berechneter Preis: ${currency(booking.total)}`,
    booking.agreedPrice !== null ? `Vereinbarter Preis: ${currency(booking.agreedPrice)}` : null,
    booking.offerNote ? `Bisherige Begründung: ${booking.offerNote}` : null,
    `Kundschaft: ${booking.customer.name}`,
    `Kennzeichen: ${booking.customer.plate}`,
    `Bevorzugter Kontaktweg: ${booking.preferredContact}`,
  ];
  return zeilen.filter(Boolean).join("\n");
}

export type AssistantResult = { text: string; inputTokens: number; outputTokens: number };

/**
 * Ein Durchlauf gegen das Modell.
 *
 * Gestreamt, weil längere Antworten sonst in die Zeitgrenze der
 * HTTP-Verbindung laufen können. Das Ergebnis wird am Stück zurückgegeben —
 * der Adminbereich zeigt einen Ladezustand, kein Zeichen-für-Zeichen-Tippen.
 */
async function frage(params: {
  system: string;
  inhalt: Anthropic.ContentBlockParam[];
  maxTokens?: number;
  /** "low" für Kurzaufgaben, "high" wenn wirklich abgewogen werden muss. */
  effort?: "low" | "medium" | "high";
}): Promise<AssistantResult> {
  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: params.maxTokens ?? 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: params.effort ?? "medium" },
    system: `${GRUNDHALTUNG}\n\n${params.system}`,
    messages: [{ role: "user", content: params.inhalt }],
  });

  const antwort = await stream.finalMessage();

  // Ablehnungen kommen als erfolgreiche Antwort ohne Inhalt zurück — vor dem
  // Auslesen prüfen, sonst greift man ins Leere.
  if (antwort.stop_reason === "refusal") {
    throw new Error(
      "Die Anfrage wurde abgelehnt. Bitte formulieren Sie sie anders oder ohne heikle Inhalte.",
    );
  }

  const text = antwort.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Das Modell hat keine verwertbare Antwort geliefert. Bitte erneut versuchen.");
  }

  return {
    text,
    inputTokens: antwort.usage.input_tokens,
    outputTokens: antwort.usage.output_tokens,
  };
}

/* ------------------------------------------------------------------ */
/* 1. Antwortentwurf an die Kundschaft                                 */
/* ------------------------------------------------------------------ */

export type ReplyKind = "gegenangebot" | "rueckfrage" | "absage" | "bestaetigung";

const REPLY_AUFGABEN: Record<ReplyKind, string> = {
  gegenangebot:
    "Entwirf ein Gegenangebot: nenne den angepassten Preis, begründe ihn nachvollziehbar aus dem Fahrzeugzustand und dem Aufwand, und biete drei alternative Termine an, ohne sie zu erfinden — schreibe stattdessen Platzhalter in eckigen Klammern.",
  rueckfrage:
    "Entwirf eine kurze Rückfrage zum Fahrzeugzustand. Frage genau das, was für eine belastbare Kalkulation fehlt — nicht mehr.",
  absage:
    "Entwirf eine freundliche Absage. Nenne einen ehrlichen Grund, ohne die Kundschaft abzuwerten, und weise auf eine Alternative hin, falls es eine gibt.",
  bestaetigung:
    "Entwirf eine Terminbestätigung. Halte fest, was gemacht wird, was es kostet und wie die Übergabe abläuft.",
};

export async function draftReply(params: {
  booking: Booking;
  kind: ReplyKind;
  hinweis?: string;
}): Promise<AssistantResult> {
  const system = [
    "Du entwirfst eine E-Mail an die Kundschaft. Der Betrieb liest sie gegen,",
    "ändert sie und schickt sie selbst ab — schreibe deshalb einen fertigen",
    "Entwurf, keine Vorschlagsliste und keine Erläuterung deiner Überlegungen.",
    "",
    "Beginne mit einer Betreffzeile in der Form „Betreff: …“, danach der Text.",
    "Angaben, die du nicht kennst, schreibst du als Platzhalter in eckigen",
    "Klammern — niemals als erfundene Tatsache.",
    "",
    REPLY_AUFGABEN[params.kind],
  ].join("\n");

  const inhalt = [
    "Vorgang:",
    bookingSummary(params.booking),
    "",
    `Aktuell gültiger Preis: ${currency(effectivePrice(params.booking))}`,
    params.hinweis ? `\nZusätzliche Anweisung des Betriebs:\n${params.hinweis}` : "",
  ].join("\n");

  return frage({
    system,
    inhalt: [{ type: "text", text: inhalt }],
    effort: "medium",
  });
}

/* ------------------------------------------------------------------ */
/* 2. Fragen zu den eigenen Zahlen                                     */
/* ------------------------------------------------------------------ */

export async function answerAboutBookings(params: {
  frage: string;
  bookings: Booking[];
}): Promise<AssistantResult> {
  const system = [
    "Du beantwortest eine Frage des Betriebs zu seinen eigenen Buchungen.",
    "",
    "Rechne nur mit den Daten, die unten stehen. Nenne konkrete Zahlen und sage",
    "dazu, auf welchen Zeitraum sie sich beziehen. Wenn die Daten die Frage nicht",
    "hergeben, sage das in einem Satz statt zu schätzen.",
    "",
    "Antworte in Fließtext, kurz. Eine Tabelle nur, wenn wirklich mehrere Werte",
    "nebeneinander stehen müssen.",
  ].join("\n");

  const tabelle = params.bookings
    .map((b) =>
      [
        b.createdAt.slice(0, 10),
        b.date,
        b.status,
        b.packageId,
        b.vehicleId,
        b.pickupCity ?? "-",
        String(effectivePrice(b)),
      ].join(" | "),
    )
    .join("\n");

  const inhalt = [
    `Frage: ${params.frage}`,
    "",
    `Datenbestand (${params.bookings.length} Buchungen).`,
    "Spalten: Eingang | Termin | Status | Paket | Fahrzeug | Abholort | Preis in Euro",
    "",
    tabelle || "(keine Buchungen vorhanden)",
  ].join("\n");

  return frage({
    system,
    inhalt: [{ type: "text", text: inhalt }],
    effort: "medium",
  });
}

/* ------------------------------------------------------------------ */
/* 3. Textentwürfe für die Website                                     */
/* ------------------------------------------------------------------ */

export type TextKind = "ratgeber" | "faq" | "ortstext";

const TEXT_AUFGABEN: Record<TextKind, string> = {
  ratgeber:
    "Schreibe einen Ratgeber-Beitrag für die Website. Fachlich korrekt, ohne Übertreibung, mit Zwischenüberschriften. Beginne mit einer Titelzeile in der Form „Titel: …“, danach eine Zeile „Beschreibung: …“ mit höchstens 155 Zeichen für die Suchmaschine, danach der Beitrag.",
  faq: "Schreibe Frage-Antwort-Paare für die FAQ-Seite. Je Antwort höchstens fünf Sätze. Format: eine Zeile „F: …“, darunter „A: …“, dann eine Leerzeile.",
  ortstext:
    "Schreibe zwei bis vier Sätze über die Arbeit in einem bestimmten Ort für dessen Stadtseite. WICHTIG: Du kennst keine tatsächlichen Aufträge dort. Schreibe deshalb ein Gerüst mit Platzhaltern in eckigen Klammern, das der Betrieb mit echten Angaben füllt — erfinde keine Kundschaft, keine Fahrzeuge und keine Referenzen.",
};

export async function draftWebsiteText(params: {
  kind: TextKind;
  thema: string;
}): Promise<AssistantResult> {
  const system = [
    TEXT_AUFGABEN[params.kind],
    "",
    "Der Text erscheint auf der Website eines realen Betriebs. Schreibe nichts,",
    "was der Betrieb nicht belegen kann: keine Zahl an Aufträgen, keine",
    "Auszeichnungen, keine Jahre der Erfahrung, keine Kundenstimmen. Solche",
    "Stellen bleiben Platzhalter in eckigen Klammern.",
  ].join("\n");

  return frage({
    system,
    inhalt: [{ type: "text", text: `Thema: ${params.thema}` }],
    maxTokens: 8000,
    effort: "medium",
  });
}

/* ------------------------------------------------------------------ */
/* 4. Einschätzung der Fahrzeugfotos                                   */
/* ------------------------------------------------------------------ */

export type PhotoInput = { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string };

export async function assessPhotos(params: {
  booking: Booking;
  photos: PhotoInput[];
}): Promise<AssistantResult> {
  const system = [
    "Du siehst Fotos eines Fahrzeugs, das zur Aufbereitung angefragt wurde, und",
    "schätzt den Aufwand ein.",
    "",
    "Gliedere deine Antwort in drei Teile:",
    "1. Was auf den Bildern erkennbar ist — nur das, was du wirklich siehst.",
    "2. Was sich daraus für den Aufwand ergibt.",
    "3. Ob der berechnete Preis passt, oder ob ein Gegenangebot sinnvoll wäre —",
    "   mit Betrag und Begründung.",
    "",
    "WICHTIG: Fotos zeigen weder Lackdicke noch Vorschäden unter der",
    "Oberfläche, und Beleuchtung täuscht über Kratzer hinweg. Deine",
    "Einschätzung ist eine Vorsortierung für den Meister, keine Begutachtung.",
    "Benenne ausdrücklich, was sich auf den Bildern NICHT beurteilen lässt.",
    "Wenn ein Bild zu unscharf oder zu dunkel für eine Aussage ist, sage das.",
  ].join("\n");

  const inhalt: Anthropic.ContentBlockParam[] = [
    ...params.photos.map<Anthropic.ContentBlockParam>((photo) => ({
      type: "image",
      source: { type: "base64", media_type: photo.mediaType, data: photo.base64 },
    })),
    {
      type: "text",
      text: [
        "Vorgang:",
        bookingSummary(params.booking),
        "",
        `Berechneter Preis: ${currency(params.booking.total)}`,
      ].join("\n"),
    },
  ];

  // Höherer Aufwand: Hier hängt eine Preisempfehlung dran, und die Bilder
  // wollen genau angesehen werden.
  return frage({ system, inhalt, maxTokens: 6000, effort: "high" });
}
