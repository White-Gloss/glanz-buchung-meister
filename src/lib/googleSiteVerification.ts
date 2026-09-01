/**
 * BESTÄTIGUNGSCODES DER GOOGLE SEARCH CONSOLE
 * -------------------------------------------
 * Google bestätigt den Besitz einer Property unter anderem über ein
 * `meta`-Tag im Quelltext. Der zugehörige Code steht in der Umgebungs-
 * variablen `VITE_GOOGLE_SITE_VERIFICATION`.
 *
 * Zwei Dinge sind dabei in der Praxis schiefgegangen, beide fängt diese
 * Datei ab:
 *
 * 1. MEHRERE PROPERTIES. Für den Domainumzug müssen alte und neue Domain
 *    gleichzeitig bestätigt sein — sonst bietet die Search Console die
 *    Adressänderung gar nicht erst an. Früher trug die Variable genau einen
 *    Code; der zweite ließ sich nicht hinterlegen. Jetzt sind mehrere Codes
 *    zulässig, getrennt durch Komma, Semikolon oder Zeilenumbruch.
 *
 * 2. DAS GANZE TAG STATT DES CODES. Google zeigt beim Einrichten ein
 *    fertiges `<meta …>`-Tag an; kopiert wird erfahrungsgemäß das gesamte
 *    Tag statt nur des `content`-Werts. Das Ergebnis war ein verschachteltes,
 *    ungültiges Tag — und eine Bestätigung, die ohne erkennbaren Grund
 *    scheiterte. Wird ein vollständiges Tag übergeben, holt sich diese
 *    Funktion den `content`-Wert selbst heraus.
 *
 * Ebenfalls erkannt: die DNS-Schreibweise `google-site-verification=CODE`.
 *
 * Bewusst NICHT übernommen werden Dateinamen wie
 * `googlec46de81dfa777419.html`. Das ist der Code der Datei-Methode, nicht
 * der des Meta-Tags. Als Meta-Wert eingetragen bestätigt er nichts — er
 * sähe nur so aus, als täte er es.
 */

/** Ein gültiger Meta-Code besteht ausschließlich aus diesen Zeichen. */
const CODE_PATTERN = /^[A-Za-z0-9_-]{8,}$/;

/** `content="…"` bzw. `content='…'` aus einem kopierten Tag herauslösen. */
const CONTENT_ATTRIBUTE = /content\s*=\s*["']([^"']+)["']/gi;

/** Markup-Reste, nachdem die `content`-Werte entnommen wurden. */
const TAG_MARKUP = /<[^>]*>/g;

/** Die Schreibweise des DNS-TXT-Eintrags bzw. der Bestätigungsdatei. */
const KEY_PREFIX = /google-site-verification\s*[=:]\s*/gi;

/**
 * Zerlegt den Rohwert in eine Liste sauberer Bestätigungscodes.
 * Reihenfolge bleibt erhalten, Doppelungen und Unbrauchbares fallen weg.
 */
export function parseGoogleSiteVerification(raw: string | undefined | null): string[] {
  if (!raw) return [];

  const codes: string[] = [];

  // Zuerst die content-Werte, sonst zerlegt die Leerzeichentrennung unten
  // ein kopiertes Tag in seine Einzelteile.
  let rest = raw;
  for (const treffer of raw.matchAll(CONTENT_ATTRIBUTE)) {
    codes.push(treffer[1]);
  }
  rest = rest.replace(CONTENT_ATTRIBUTE, " ").replace(TAG_MARKUP, " ");

  codes.push(...rest.replace(KEY_PREFIX, " ").split(/[,;\s]+/));

  const gesehen = new Set<string>();
  return codes
    .map((code) => code.trim())
    .filter((code) => CODE_PATTERN.test(code))
    .filter((code) => {
      if (gesehen.has(code)) return false;
      gesehen.add(code);
      return true;
    });
}

/**
 * Fertige `meta`-Einträge für den Dokumentkopf.
 * Ohne Code entsteht kein Tag — ein leeres `content` lehnt Google als
 * ungültig ab und die Bestätigung schlägt fehl.
 */
export function googleSiteVerificationMeta(
  raw: string | undefined | null,
): Array<{ name: string; content: string }> {
  return parseGoogleSiteVerification(raw).map((content) => ({
    name: "google-site-verification",
    content,
  }));
}
