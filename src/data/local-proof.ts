/**
 * Vom Betreiber bestätigte Angaben, die eine Abholgebiet-Seite wirklich von den
 * anderen unterscheiden: echte Aufträge aus dem Ort, tatsächliche Abholtage,
 * konkrete Übergabehinweise und echte Kundenfragen.
 *
 * Regeln (geprüft von `src/lib/local-proof.test.ts`):
 * - Nur eintragen, was nachweislich stimmt. Nichts schätzen, nichts umformulieren.
 * - Keine Namen, Kennzeichen, Telefonnummern, E-Mail-Adressen oder Straßen.
 * - Aufträge nur mit Einverständnis des Kunden (`consent: true`).
 * - Ein Ort ohne Eintrag zeigt keinen zusätzlichen Abschnitt.
 *
 * Ausfüllhilfe und Prioritäten: `docs/ortsseiten-ausbau-2026-11-03.md`.
 */

export type LocalReference = {
  /** Monat der Ausführung, Format JJJJ-MM. */
  month: string;
  /** Fahrzeug ohne Kennzeichen, z. B. „VW Golf 8 Variant“. */
  vehicle: string;
  /** Slug einer buchbaren Leistung aus `services` in `site.ts`. */
  service: string;
  /** Sachlich, was gemacht wurde und warum (1–3 Sätze, keine Versprechen). */
  summary: string;
  /** Optional: ID eines freigegebenen Fotos aus `customer-photos.ts`. */
  photoId?: string;
  /** Der Kunde hat der Veröffentlichung zugestimmt. */
  consent: true;
};

export type LocalFaq = {
  /** Eine Frage, die Kunden aus diesem Ort tatsächlich gestellt haben. */
  question: string;
  answer: string;
};

export type CityLocalProof = {
  /** Datum der Betreiberbestätigung, Format JJJJ-MM-TT. */
  confirmedAt: string;
  /** Nur wenn tatsächlich so geplant, z. B. „Dienstag und Donnerstag vormittags“. */
  pickupDays?: string;
  /** Konkrete Übergabemöglichkeiten im Ort, z. B. am Arbeitsplatz. */
  handover?: string;
  references?: LocalReference[];
  faqs?: LocalFaq[];
};

/** Schlüssel ist der Slug aus `cities`, z. B. "tuebingen". */
export const localProof: Partial<Record<string, CityLocalProof>> = {};
