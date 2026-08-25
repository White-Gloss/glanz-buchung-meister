/**
 * SERVERSEITIGE PROTOKOLLIERUNG
 * ------------------------------
 * Eine Zeile je Ereignis, immer gleich aufgebaut, ohne personenbezogene
 * Daten.
 *
 * WARUM NICHT EINFACH `console.error(text, error)`:
 * Node gibt bei einem Fehlerobjekt sämtliche Eigenschaften aus. Der
 * PostgreSQL-Treiber hängt an seine Fehler unter anderem `detail` — und
 * darin steht bei einer verletzten Eindeutigkeit der auslösende Wert, etwa
 * `Key (customer_email)=(max@example.de) already exists`. Ebenso reichen
 * HTTP-Antworten fremder Dienste die Empfängeradresse zurück. So landen
 * Kundendaten im Prozessprotokoll des Servers, wo sie nicht hingehören und
 * niemandem nützen.
 *
 * Deshalb: Fehler werden auf Name und Meldung eingedampft, die Meldung wird
 * gekürzt, und was nach E-Mail-Adresse, Telefonnummer oder Zugangsschlüssel
 * aussieht, wird ersetzt.
 *
 * Das ist bewusst kein Fremdsystem. Die Zeilen gehen in das Prozessprotokoll
 * des Servers; eine dauerhafte Ablage mit Ansicht im Adminbereich ist der
 * nächste Schritt und baut auf dieser Form auf.
 */

/** Längere Meldungen bringen im Protokoll keinen Erkenntnisgewinn mehr. */
const MAX_MELDUNG = 300;

const ERSATZ = "[entfernt]";

/** So viele Stack-Zeilen genügen, um die Stelle zu finden. */
const MAX_STACK_ZEILEN = 10;

/**
 * Ersetzt, was personenbezogen oder geheim sein kann.
 *
 * Bewusst großzügig: Ein zu viel ersetzter Wert kostet nichts, ein zu wenig
 * ersetzter steht dauerhaft im Protokoll.
 */
export function redigieren(text: string): string {
  return (
    text
      // E-Mail-Adressen
      .replace(/[^\s<>()[\]{}",;:]+@[^\s<>()[\]{}",;:]+\.[A-Za-z]{2,}/g, ERSATZ)
      // Telefonnummern: mindestens sechs Ziffern, übliche Trenner erlaubt.
      // Der Bindestrich steht ausdrücklich in beiden Ausschlüssen, sonst
      // verschwindet die Rechnungsnummer (`WGD-2026-17`) — gerade sie ist im
      // Protokoll der Griff, mit dem man den Vorgang wiederfindet.
      .replace(/(?<![\w.-])\+?\d[\d\s/().-]{4,}\d(?![\w-])/g, (treffer) =>
        treffer.replace(/\D/g, "").length >= 6 ? ERSATZ : treffer,
      )
      // Lange zusammenhängende Zeichenketten sehen nach Schlüssel oder Token aus
      .replace(/\b[A-Za-z0-9_-]{32,}\b/g, ERSATZ)
  );
}

/**
 * Beschreibt einen unbekannten Fehlerwert in einer Zeile.
 *
 * Ausdrücklich ohne die übrigen Eigenschaften des Objekts — genau dort
 * stecken bei Datenbank- und HTTP-Fehlern die Nutzdaten.
 */
export function fehlerBeschreiben(error: unknown, optionen?: { mitStack?: boolean }): string {
  if (error instanceof Error) {
    const name = error.name || "Error";
    const meldung = error.message || "(ohne Meldung)";
    const kopf = redigieren(`${name}: ${meldung}`).slice(0, MAX_MELDUNG);
    if (!optionen?.mitStack) return kopf;

    // Der Aufrufweg hilft bei einem unerwarteten Serverfehler mehr als alles
    // andere. Er wird ebenso redigiert — in einer Meldung mitten im Stack
    // können dieselben Daten stehen.
    const stack = (error.stack ?? "")
      .split("\n")
      .slice(1, MAX_STACK_ZEILEN + 1)
      .map((zeile) => redigieren(zeile.trim()))
      .filter(Boolean);
    return stack.length ? `${kopf}\n${stack.map((z) => `    ${z}`).join("\n")}` : kopf;
  }
  if (typeof error === "string") return redigieren(error).slice(0, MAX_MELDUNG);
  if (error === null || error === undefined) return "(kein Fehlerwert)";
  return redigieren(`${typeof error}: ${String(error)}`).slice(0, MAX_MELDUNG);
}

/** Baut die Protokollzeile, ohne sie auszugeben — damit prüfbar. */
export function protokollZeile(
  bereich: string,
  vorgang: string,
  fehler?: unknown,
  kontext?: Record<string, string | number | boolean | null | undefined>,
): string {
  const teile = [`[${bereich}]`, vorgang];

  if (kontext) {
    for (const [schluessel, wert] of Object.entries(kontext)) {
      if (wert === undefined || wert === null || wert === "") continue;
      teile.push(`${schluessel}=${redigieren(String(wert)).slice(0, 120)}`);
    }
  }

  if (fehler !== undefined) teile.push(`fehler="${fehlerBeschreiben(fehler)}"`);

  return teile.join(" ");
}

/** Störung: etwas ist fehlgeschlagen und jemand sollte es sehen. */
export function protokollFehler(
  bereich: string,
  vorgang: string,
  fehler?: unknown,
  kontext?: Record<string, string | number | boolean | null | undefined>,
): void {
  console.error(protokollZeile(bereich, vorgang, fehler, kontext));
}

/**
 * Unerwarteter Fehler, bei dem der Aufrufweg gebraucht wird — etwa in der
 * allgemeinen Serverfehlerbehandlung. Stack inbegriffen, ebenfalls redigiert.
 */
export function protokollAusnahme(bereich: string, vorgang: string, fehler: unknown): void {
  console.error(`[${bereich}] ${vorgang} ${fehlerBeschreiben(fehler, { mitStack: true })}`);
}

/** Hinweis: nicht kaputt, aber erwähnenswert — etwa fehlende Konfiguration. */
export function protokollHinweis(
  bereich: string,
  vorgang: string,
  kontext?: Record<string, string | number | boolean | null | undefined>,
): void {
  console.warn(protokollZeile(bereich, vorgang, undefined, kontext));
}
