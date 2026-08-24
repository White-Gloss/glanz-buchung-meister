/**
 * ICS-BAUSTEINE
 * --------------
 * Die reinen Textfunktionen des Kalender-Feeds liegen hier, damit sie ohne
 * Datenbank und ohne HTTP-Handler geprüft werden können.
 */

/**
 * Escaping nach RFC 5545: Backslash, Semikolon und Komma haben im
 * Eigenschaftswert eine Sonderbedeutung, Zeilenumbrüche werden zur Sequenz
 * `\n`.
 *
 * WICHTIG: Der Backslash muss zuerst ersetzt werden. Sonst würden die
 * Backslashes der später eingefügten Sequenzen erneut escaped — der Kalender
 * zeigte dann ein sichtbares "\n" statt eines Zeilenumbruchs.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n?/g, "\n")
    .replace(/\n/g, "\\n");
}

/**
 * Setzt einen mehrzeiligen Eigenschaftswert zusammen. Leere Zeilen entfallen;
 * die Zeilen werden mit einem echten Umbruch verbunden und erst danach
 * escaped, damit genau eine `\n`-Sequenz entsteht.
 */
export function icsMultiline(lines: Array<string | null | undefined | false>): string {
  return escapeIcsText(lines.filter((line): line is string => Boolean(line)).join("\n"));
}

/** YYYY-MM-DD -> YYYYMMDD für Ganztagestermine. */
export function toIcsDate(dateIso: string): string {
  return dateIso.slice(0, 10).replace(/-/g, "");
}

/** Verschiebt ein ISO-Datum um n Tage und gibt es im ICS-Format zurück. */
export function shiftIcsDate(dateIso: string, days: number): string {
  const date = new Date(`${dateIso.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export function icsTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
}
