/**
 * WELCHE AUFNAHME DARF WEG?
 * --------------------------
 * Diese Entscheidung steht bewusst für sich, getrennt vom Speicherzugriff:
 * Gelöschte Aufnahmen sind unwiederbringlich weg, und eine versehentlich
 * umgedrehte Bedingung würde Kundenfotos vernichten. Als reine Funktion
 * lässt sie sich vollständig durchtesten.
 *
 * Es gilt genau eine Regel, in dieser Reihenfolge:
 *   1. Gehört die Datei zu einer Meldung? → bleibt, immer.
 *   2. Ist sie jünger als die Schonfrist? → bleibt (Formular evtl. offen).
 *   3. Sonst → verwaist, darf weg.
 *
 * Im Zweifel bleibt die Datei liegen. Ein unbekanntes Datum zählt deshalb
 * als „zu jung", nicht als „alt genug".
 */

export const CLEANUP_GRACE_DAYS = 7;

export type StoredMedia = {
  /** Vollständiger Pfad im Speicher, z. B. "<uuid>/<zeit>-<zufall>.jpg" */
  path: string;
  /** ISO-Zeitstempel des Uploads; unbekannt ist erlaubt. */
  createdAt?: string | null;
  sizeBytes?: number | null;
};

export type CleanupPlan = {
  /** Pfade, die gelöscht werden dürfen. */
  loeschen: string[];
  /** Summe der Größen der zu löschenden Dateien. */
  bytes: number;
  /** Zu jung zum Aufräumen. */
  geschont: number;
  /** Gehört zu einer Meldung. */
  inVerwendung: number;
};

export function planCleanup(
  dateien: StoredMedia[],
  referenzierte: Iterable<string>,
  jetzt: number = Date.now(),
  graceDays: number = CLEANUP_GRACE_DAYS,
): CleanupPlan {
  const referenziert = referenzierte instanceof Set ? referenzierte : new Set(referenzierte);
  const grenze = jetzt - graceDays * 24 * 60 * 60_000;

  const plan: CleanupPlan = { loeschen: [], bytes: 0, geschont: 0, inVerwendung: 0 };

  for (const datei of dateien) {
    if (referenziert.has(datei.path)) {
      plan.inVerwendung += 1;
      continue;
    }

    const angelegt = Date.parse(datei.createdAt ?? "");
    // Unbekanntes Datum => vorsichtshalber schonen.
    if (!Number.isFinite(angelegt) || angelegt > grenze) {
      plan.geschont += 1;
      continue;
    }

    plan.loeschen.push(datei.path);
    const groesse = Number(datei.sizeBytes ?? 0);
    if (Number.isFinite(groesse) && groesse > 0) plan.bytes += groesse;
  }

  return plan;
}

export function megabyte(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}
