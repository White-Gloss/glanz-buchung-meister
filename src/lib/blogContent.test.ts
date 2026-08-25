import { describe, expect, it } from "vitest";

import { imageDimensionsFromUrl, renderArticle } from "./blogContent";

/**
 * Der Ratgeber ist die einzige Stelle der Anwendung, die fertiges HTML in
 * die Seite schreibt (`dangerouslySetInnerHTML` in `ratgeber.$slug.tsx`).
 * Der Modulkopf von `blogContent.ts` verspricht, dass aus dem
 * Datenbankinhalt kein eigenes Markup entstehen kann — „auch dann nicht,
 * wenn ein Admin-Zugang kompromittiert wäre".
 *
 * Diese Tests prüfen genau dieses Versprechen. Sie sind bewusst als
 * Angriffe formuliert und nicht als Beispiele: Es geht nicht darum, dass
 * die Ausgabe hübsch aussieht, sondern darum, dass eine bestimmte Sache
 * NICHT darin steht.
 */
describe("renderArticle wehrt Markup aus dem Beitragstext ab", () => {
  it("gibt Skript-Tags als Text aus statt sie einzubauen", () => {
    const { html } = renderArticle("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("entschärft Ereignis-Attribute in rohem HTML", () => {
    const { html } = renderArticle('<img src=x onerror="alert(1)">');
    expect(html).not.toMatch(/<img[^>]*onerror/i);
    expect(html).toContain("&lt;img");
  });

  it("lehnt javascript:-Ziele ab, in jeder Schreibweise", () => {
    for (const eingabe of ["[k](javascript:alert(1))", "[k](JaVaScRiPt:alert(1))"]) {
      const { html } = renderArticle(eingabe);
      expect(html).not.toContain("<a ");
      expect(html.toLowerCase()).not.toContain('href="javascript');
    }
  });

  it("lehnt data:- und vbscript:-Ziele ab", () => {
    expect(renderArticle("![x](data:text/html;base64,PHNjcmlwdD4=)").html).not.toContain("<img");
    expect(renderArticle("[k](vbscript:msgbox(1))").html).not.toContain("<a ");
  });

  /**
   * PROTOKOLLRELATIVE ZIELE — der Fund, der diese Testdatei ausgelöst hat.
   *
   * `//fremde-seite.de` bestand die frühere Prüfung, weil sie nur „beginnt
   * mit einem Schrägstrich" verlangte. Herausgekommen wäre ein Link, der
   * nach einer Unterseite aussieht, im selben Tab zu einem fremden Host
   * führt und mangels `rel="noopener"` auch noch Zugriff auf das
   * ursprüngliche Fenster gibt.
   */
  it("lehnt protokollrelative Ziele ab", () => {
    const { html } = renderArticle("[Impressum](//fremde-seite.example)");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain('fremde-seite.example"');
  });

  it("lehnt auch die Backslash-Schreibweise ab, die manche Browser gleich lesen", () => {
    expect(renderArticle("[k](/\\fremde-seite.example)").html).not.toContain("<a ");
    expect(renderArticle("![k](//fremde-seite.example/b.png)").html).not.toContain("<img");
  });

  it("bricht nicht aus dem alt-Attribut eines Bildes aus", () => {
    const { html } = renderArticle('![" onerror="alert(1)](https://beispiel.de/b.png)');
    expect(html).toContain("<img");

    // Worauf es ankommt: Das Anführungszeichen des Angreifers steht als
    // `&quot;` da und beendet den alt-Wert deshalb nicht. Der Text
    // `onerror=` taucht in der Ausgabe durchaus auf — aber INNERHALB des
    // Attributwerts, wo der Browser ihn als Text liest und nicht als
    // Attribut. Geprüft wird also das echte Anführungszeichen, nicht das
    // Wort.
    expect(html).toContain('alt="&quot; onerror=&quot;alert(1)"');
    expect(html).not.toContain('" onerror="');
  });

  it("bricht nicht über doppelt kodierte Anführungszeichen aus", () => {
    const { html } = renderArticle("[k](https://beispiel.de/&quot; onmouseover=&quot;alert(1))");
    expect(html).not.toMatch(/onmouseover=["'][^"']*["']/);
  });
});

describe("renderArticle baut die erlaubten Fälle wie vorgesehen", () => {
  it("öffnet externe Links in einem neuen Tab, ohne Rückgriff auf das alte Fenster", () => {
    const { html } = renderArticle("[Partner](https://beispiel.de)");
    expect(html).toContain('href="https://beispiel.de"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("lässt eigene Pfade, Anker, mailto und tel unverändert zu", () => {
    for (const ziel of ["/leistungen", "#preise", "mailto:info@beispiel.de", "tel:+4912345"]) {
      expect(renderArticle(`[k](${ziel})`).html).toContain(`href="${ziel}"`);
    }
  });

  it("öffnet einen eigenen Pfad nicht in einem neuen Tab", () => {
    expect(renderArticle("[Leistungen](/leistungen)").html).not.toContain("target=");
  });

  it("sammelt Überschriften mit Ankern für das Inhaltsverzeichnis", () => {
    const { headings } = renderArticle("## Wie lange hält es?\n\nText\n\n### Pflege");
    expect(headings).toEqual([
      { id: expect.any(String), text: "Wie lange hält es?", level: 2 },
      { id: expect.any(String), text: "Pflege", level: 3 },
    ]);
    expect(headings[0].id).not.toContain(" ");
  });

  it("setzt feste Bildmaße, damit das Layout beim Nachladen nicht springt", () => {
    const { html } = renderArticle("![Auto](https://beispiel.de/b.png?w=1200&h=800)");
    expect(html).toContain('width="1200"');
    expect(html).toContain('height="800"');
  });

  it("fällt ohne Maße in der URL auf 16:9 zurück", () => {
    expect(imageDimensionsFromUrl("https://beispiel.de/b.png")).toBeNull();
    expect(renderArticle("![Auto](https://beispiel.de/b.png)").html).toContain('width="1600"');
  });

  it("lässt Sternchen in einem Code-Abschnitt in Ruhe", () => {
    const { html } = renderArticle("Der Ausdruck `a * b * c` bleibt.");
    expect(html).toContain("<code");
    expect(html).not.toContain("<em>");
  });
});
