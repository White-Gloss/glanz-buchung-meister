/**
 * „VORÜBERGEHEND NICHT ERREICHBAR" IST NICHT „GIBT ES NICHT"
 * -----------------------------------------------------------
 * Diese Unterscheidung entscheidet über die Sichtbarkeit bei Google.
 *
 * Die öffentlichen Leseabfragen lieferten früher bei *jedem* Problem
 * schlicht `null` beziehungsweise eine leere Liste — auch bei einer
 * Zeitüberschreitung der Datenbank oder fehlender Konfiguration. Die Route
 * machte daraus „Beitrag nicht gefunden": Antwort 404 mit `noindex`. Für
 * Google heißt das nicht „später nochmal versuchen", sondern „diese Seite
 * gibt es nicht mehr" — die Seite fliegt aus dem Index und braucht danach
 * Wochen, um zurückzukommen. Dasselbe gilt für eine Sitemap, die stillschweigend
 * kürzer ausfällt.
 *
 * Ein technischer Ausfall wirft deshalb diesen Fehler. Daraus wird eine
 * 5xx-Antwort, und die versteht Google als „später nochmal versuchen".
 * Nur eine Abfrage, die den Datensatz sauber nicht findet, gibt weiterhin
 * `null` zurück und führt zu einem echten 404.
 */
export class ContentUnavailableError extends Error {
  constructor(grund: string) {
    super(`Die Inhalte sind derzeit nicht abrufbar (${grund}).`);
    this.name = "ContentUnavailableError";
  }
}
