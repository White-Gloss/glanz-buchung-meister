/**
 * AHREFS WEB ANALYTICS
 * ---------------------
 * Reichweitenmessung ohne Cookies. Das Skript setzt nichts im Browser-
 * Speicher ab und liest nichts daraus — deshalb greift § 25 Abs. 1 TDDDG
 * hier nicht, und die Messung läuft ohne Einwilligungsbanner. Verarbeitet
 * wird die IP-Adresse (Art. 6 Abs. 1 lit. f DSGVO, berechtigtes Interesse an
 * einer Reichweitenmessung); Ahrefs speichert sie nach eigenen Angaben nicht.
 *
 * ABGRENZUNG ZU GOOGLE UND META: Jene beiden setzen Cookies und laufen
 * deshalb ausschließlich nach aktiver Zustimmung (siehe `adsConsent.ts` und
 * `metaPixel.ts`). Diese Trennung ist Absicht — wer hier eine Einwilligung
 * einbaut, wo keine nötig ist, verschenkt Messdaten; wer sie dort weglässt,
 * verarbeitet ohne Rechtsgrundlage.
 *
 * SCHALTER: `VITE_AHREFS_ANALYTICS_KEY`. Ist der Wert leer, wird gar kein
 * Skript ausgeliefert. Der Schlüssel ist öffentlich — er steht ohnehin im
 * Quelltext jeder Seite und darf deshalb in der `.env` stehen.
 *
 * ACHTUNG, ZEITPUNKT: `VITE_`-Werte setzt Vite beim BAUEN fest ein, nicht
 * beim Starten. Der Schlüssel muss also schon zur Bauzeit vorliegen; ihn
 * nachträglich in der Laufzeitumgebung zu setzen, ändert nichts. Ein- und
 * Ausschalten heißt hier: Wert ändern und neu bauen.
 *
 * Wird die Adresse des Skripts geändert, muss sie auch in der
 * Content-Security-Policy in `src/server.ts` stehen (`script-src` für das
 * Laden, `connect-src` für das Melden der Aufrufe).
 */

export const AHREFS_ANALYTICS_SRC = "https://analytics.ahrefs.com/analytics.js";

/** Der öffentliche Schlüssel der Website, oder leer. */
export function ahrefsAnalyticsKey(): string {
  return import.meta.env.VITE_AHREFS_ANALYTICS_KEY?.trim() || "";
}

export type HeadScript = {
  src: string;
  async: true;
  "data-key": string;
};

/**
 * Einträge für `head.scripts` der Wurzelroute.
 *
 * Serverseitig gerendert statt im Browser nachgeladen: So steht das Skript
 * bereits in der ersten Antwort und misst auch dann, wenn die Hydration
 * scheitert oder der Besucher die Seite vorher verlässt.
 *
 * Ohne Schlüssel bleibt die Liste leer — dann steht auch kein Skript im
 * Quelltext.
 */
export function ahrefsAnalyticsScripts(): HeadScript[] {
  const key = ahrefsAnalyticsKey();
  if (!key) return [];
  return [{ src: AHREFS_ANALYTICS_SRC, async: true, "data-key": key }];
}
