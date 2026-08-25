import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * WELCHE SERVERFUNKTIONEN SIND OHNE ANMELDUNG ERREICHBAR?
 * =======================================================
 * Eine `createServerFn` ist ein Endpunkt. Ohne
 * `.middleware([attachSupabaseAuth, requireSupabaseAuth])` kann sie jeder
 * aufrufen, der die Adresse kennt — kein Browser nötig, keine Oberfläche.
 *
 * Das ist für manche Funktionen genau richtig: das Buchungsformular, die
 * veröffentlichten Inhalte, die Preisliste. Für alle anderen wäre es ein
 * offenes Scheunentor, und der Unterschied ist eine einzige vergessene
 * Zeile.
 *
 * Besonders wiegt das, weil mehrere dieser Funktionen über
 * `src/lib/db.server.ts` gehen. Dieser Weg verbindet sich privilegiert und
 * UMGEHT DIE ZUGRIFFSREGELN DER DATENBANK VOLLSTÄNDIG. Row Level Security
 * fängt hier also nichts auf — was diese Funktionen tun, tun sie.
 *
 * Deshalb steht unten eine ausdrückliche Liste. Wer eine Serverfunktion
 * ohne Anmeldepflicht hinzufügt, muss sie hier eintragen und begründen.
 * Wer eine Anmeldepflicht versehentlich entfernt, fällt auf.
 */
const OHNE_ANMELDUNG_ERLAUBT: Record<string, string> = {
  // Öffentliche Inhalte — genau dafür gedacht.
  listPublishedBlogPosts: "Ratgeber-Übersicht auf der Website",
  getPublishedBlogPost: "einzelner Ratgeber-Beitrag",
  listPublishedFaqs: "FAQ-Bereich",
  listPublishedGalleryItems: "Galerie",
  listPublishedCustomServices: "Zusatzleistungen im Buchungsformular",
  listServicePrices: "Preise, die ohnehin auf der Seite stehen",

  // Öffentliche Formulare. Alle mit Drosselung nach Absenderadresse.
  createBooking: "das Buchungsformular selbst",
  getDayLoad: "Auslastung je Tag für den Buchungskalender",
  submitConditionReport: "Zustandsmeldung ohne Kundenkonto",
  uploadConditionPhoto: "Aufnahme zur Zustandsmeldung",
  submitDentRepairRequest: "Anfrage zur Dellen-Begutachtung",

  // Zugang über ein Token statt über ein Konto. Das Token ist eine uuid
  // aus gen_random_uuid() mit Ablaufdatum, wird serverseitig geprüft und
  // nie an den Browser gegeben.
  getOfferByToken: "Kunde sieht sein Gegenangebot über den Link aus der Mail",
  acceptOffer: "Kunde nimmt einen angebotenen Termin an",

  // Reines Weiterreichen eines Ereignisses, ohne Datenbankzugriff.
  sendMetaConversion: "Conversion-Meldung an Meta",
};

type Fund = { name: string; datei: string; angemeldet: boolean };

function serverFunktionen(): Fund[] {
  const wurzel = join(process.cwd(), "src");
  const funde: Fund[] = [];

  const durchgehen = (verzeichnis: string) => {
    for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
      const pfad = join(verzeichnis, eintrag.name);
      if (eintrag.isDirectory()) durchgehen(pfad);
      else if (eintrag.name.endsWith(".functions.ts")) {
        const inhalt = readFileSync(pfad, "utf8");
        const muster = /export const (\w+)\s*=\s*createServerFn\(/g;
        let treffer: RegExpExecArray | null;
        const stellen: Array<[string, number]> = [];
        while ((treffer = muster.exec(inhalt))) stellen.push([treffer[1], treffer.index]);

        stellen.forEach(([name, start], i) => {
          const ende = i + 1 < stellen.length ? stellen[i + 1][1] : inhalt.length;
          const block = inhalt.slice(start, ende);
          funde.push({
            name,
            datei: pfad.replace(`${process.cwd()}/`, ""),
            angemeldet: block.includes("requireSupabaseAuth"),
          });
        });
      }
    }
  };

  durchgehen(wurzel);
  return funde;
}

describe("Serverfunktionen ohne Anmeldepflicht", () => {
  const alle = serverFunktionen();

  it("findet überhaupt Serverfunktionen — sonst prüft dieser Test nichts", () => {
    expect(alle.length).toBeGreaterThan(50);
  });

  it("hat keine unerwartet offene Serverfunktion", () => {
    const offen = alle.filter((f) => !f.angemeldet).map((f) => f.name);
    const unerwartet = offen.filter((name) => !(name in OHNE_ANMELDUNG_ERLAUBT));

    // Die Meldung nennt gleich, was zu tun ist: entweder Anmeldepflicht
    // ergänzen oder oben mit Begründung eintragen.
    expect(
      unerwartet,
      `Ohne Anmeldepflicht und nicht in der Liste: ${unerwartet.join(", ")}. ` +
        "Entweder .middleware([attachSupabaseAuth, requireSupabaseAuth]) ergänzen " +
        "oder in OHNE_ANMELDUNG_ERLAUBT eintragen und begründen.",
    ).toEqual([]);
  });

  it("führt keine Funktion in der Liste, die inzwischen geschützt ist", () => {
    const geschuetzt = new Set(alle.filter((f) => f.angemeldet).map((f) => f.name));
    const ueberholt = Object.keys(OHNE_ANMELDUNG_ERLAUBT).filter((n) => geschuetzt.has(n));
    expect(
      ueberholt,
      `Diese sind inzwischen anmeldepflichtig und gehören aus der Liste: ${ueberholt.join(", ")}`,
    ).toEqual([]);
  });

  it("führt keinen Eintrag, zu dem es keine Funktion mehr gibt", () => {
    const vorhanden = new Set(alle.map((f) => f.name));
    const verwaist = Object.keys(OHNE_ANMELDUNG_ERLAUBT).filter((n) => !vorhanden.has(n));
    expect(verwaist, `Ohne zugehörige Funktion: ${verwaist.join(", ")}`).toEqual([]);
  });
});
