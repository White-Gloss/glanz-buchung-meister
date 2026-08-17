import { describe, expect, it } from "vitest";
import { simpleParser } from "mailparser";

/**
 * SCHUTZ FÜR EINE ERZWUNGENE ABHÄNGIGKEIT
 * ----------------------------------------
 * Der Posteingang (inbox.server.ts) liest `parsed.text`. Bei reinen
 * HTML-Mails — also den allermeisten — entsteht dieser Text erst durch die
 * Umwandlung in mailparser, tief unten über `html-to-text` und
 * `deepmerge-ts`.
 *
 * In package.json steht für `deepmerge-ts` ein `overrides`-Eintrag auf
 * Version 8, weil Version 7 eine Sicherheitsmeldung hat und `html-to-text`
 * noch auf `^7` festgelegt ist. Eine erzwungene Hauptversion kann Verhalten
 * ändern, ohne dass es irgendwo knallt: Der Posteingang würde einfach leere
 * oder kaputte Nachrichtentexte anzeigen.
 *
 * Dieser Test macht genau das sichtbar. Schlägt er nach einem
 * Abhängigkeits-Update fehl, ist der Override das Erste, wo man nachsieht.
 */
describe("Posteingang – Umwandlung von HTML-Mails in Text", () => {
  const htmlMail = [
    "From: Kunde <kunde@example.com>",
    "To: info@white-gloss.de",
    "Subject: Anfrage Keramikversiegelung",
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    "<html><body><h1>Guten Tag</h1>" +
      "<p>Ich h&auml;tte gern einen Termin f&uuml;r eine <b>Keramikversiegelung</b>.</p>" +
      "<ul><li>BMW 3er</li><li>FDS-WG 26</li></ul>" +
      '<a href="https://white-gloss.de">Ihre Seite</a></body></html>',
  ].join("\r\n");

  it("liest Kopfzeilen einer HTML-Mail", async () => {
    const parsed = await simpleParser(htmlMail);

    expect(parsed.subject).toBe("Anfrage Keramikversiegelung");
    expect(parsed.from?.text).toContain("kunde@example.com");
  });

  it("erzeugt aus dem HTML einen lesbaren Text", async () => {
    const parsed = await simpleParser(htmlMail);
    const text = parsed.text ?? "";

    // Ohne funktionierende Umwandlung bliebe das Feld leer.
    expect(text.trim().length).toBeGreaterThan(0);
    // Umlaute als HTML-Entitäten müssen aufgelöst werden.
    expect(text).toContain("hätte");
    expect(text).toContain("für");
    // Struktur darf nicht verlorengehen.
    expect(text).toContain("BMW 3er");
    expect(text).toContain("FDS-WG 26");
    expect(text.toUpperCase()).toContain("GUTEN TAG");
    expect(text).toContain("white-gloss.de");
    // Kein rohes Markup im Klartext.
    expect(text).not.toContain("<p>");
    expect(text).not.toContain("&auml;");
  });

  it("lässt eine reine Textmail unverändert", async () => {
    const parsed = await simpleParser(
      [
        "From: Kunde <kunde@example.com>",
        "Subject: Kurze Frage",
        "Content-Type: text/plain; charset=utf-8",
        "",
        "Guten Tag, wann hätten Sie einen Termin frei?",
      ].join("\r\n"),
    );

    expect(parsed.text?.trim()).toBe("Guten Tag, wann hätten Sie einen Termin frei?");
  });
});
