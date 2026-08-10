/**
 * GOOGLE-ANBINDUNG (ADS-CONVERSIONS UND ANALYTICS)
 * ------------------------------------------------
 * Beide Google-Dienste laufen über dasselbe Skript (gtag.js) und dieselbe
 * Einwilligung. Deshalb liegen sie hier zusammen.
 *
 * ES GIBT DREI SCHALTER, ALLE ÜBER UMGEBUNGSVARIABLEN:
 *   VITE_GOOGLE_ADS_CONVERSION_ID     z. B. AW-123456789
 *   VITE_GOOGLE_ADS_CONVERSION_LABEL  das Kürzel der Conversion-Aktion
 *   VITE_GA4_MEASUREMENT_ID           z. B. G-ABC123DEF4
 * Ist ein Wert leer, bleibt genau dieser Teil aus. Sind alle leer, wird gar
 * kein Google-Skript geladen und das Cookie-Banner erscheint nicht.
 *
 * RECHTLICHER RAHMEN: Das Skript wird erst NACH aktiver Einwilligung
 * nachgeladen (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO). Auch jedes
 * einzelne Ereignis prüft die Einwilligung noch einmal — ein Widerruf wirkt
 * damit sofort, ohne dass die Seite neu geladen werden muss.
 */

/** Minimaler Typ für das von Google injizierte globale `gtag`. */
type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

/**
 * Der Schlüssel trägt die Fassung des Einwilligungstextes im Namen.
 *
 * WARUM: Eine Einwilligung gilt immer nur für die Zwecke, über die beim
 * Erteilen aufgeklärt wurde (Art. 4 Nr. 11 DSGVO). Wer früher „Akzeptieren"
 * gewählt hat, hat dem damaligen Text zugestimmt — Google Ads und Meta,
 * ohne Analytics. Würde derselbe gespeicherte Wert jetzt auch Analytics
 * freischalten, wäre das eine Verarbeitung ohne Rechtsgrundlage.
 *
 * Der neue Schlüssel lässt alte Zustimmungen ins Leere laufen: Das Banner
 * erscheint einmal erneut, diesmal mit dem erweiterten Text. Bei jeder
 * künftigen inhaltlichen Änderung des Bannertextes muss die Zahl erhöht
 * werden.
 *
 * Der alte Schlüssel wird beim ersten Zugriff entfernt, damit keine
 * verwaisten Werte im Browser zurückbleiben.
 */
const STORAGE_KEY = "ads-consent-v2";
const LEGACY_STORAGE_KEYS = ["ads-consent"];

export type AdsConsent = "granted" | "denied";

const adsId = () => import.meta.env.VITE_GOOGLE_ADS_CONVERSION_ID || "";
const adsLabel = () => import.meta.env.VITE_GOOGLE_ADS_CONVERSION_LABEL || "";
const ga4Id = () => import.meta.env.VITE_GA4_MEASUREMENT_ID || "";

/** Ist überhaupt ein Google-Dienst konfiguriert? */
export function googleTrackingConfigured(): boolean {
  return Boolean(adsId() || ga4Id());
}

export function readStoredConsent(): AdsConsent | null {
  if (typeof window === "undefined") return null;
  for (const key of LEGACY_STORAGE_KEYS) window.localStorage.removeItem(key);
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "granted" || value === "denied" ? value : null;
}

export function storeAdsConsent(value: AdsConsent) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value);
}

/** Einwilligung erteilt und mindestens ein Dienst konfiguriert? */
function trackingAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (!googleTrackingConfigured()) return false;
  return readStoredConsent() === "granted";
}

/**
 * Lädt gtag.js nach und meldet die konfigurierten Ziele an. Mehrfachaufrufe
 * sind unschädlich. Der Warteschlangen-Code steht bewusst in TypeScript und
 * nicht als eingebettetes Skript im Dokument: So funktioniert die Anbindung
 * auch dann, wenn später eine strengere Content-Security-Policy eingebettete
 * Skripte verbietet.
 */
export function loadGoogleTags() {
  if (!trackingAllowed()) return;
  if (document.getElementById("google-tag")) return;

  window.dataLayer = window.dataLayer || [];
  // Google erwartet ausdrücklich `arguments` und keinen Rest-Parameter:
  // Die Bibliothek liest die Einträge später als arguments-Objekte aus.
  function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  }
  window.gtag = gtag as GtagFn;

  window.gtag("js", new Date());
  if (adsId()) window.gtag("config", adsId());
  if (ga4Id()) window.gtag("config", ga4Id(), { anonymize_ip: true });

  // Eine Kennung genügt zum Laden; die weiteren Ziele hängen an derselben
  // Bibliothek und werden über die `config`-Aufrufe oben aktiviert.
  const script = document.createElement("script");
  script.id = "google-tag";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(adsId() || ga4Id())}`;
  document.head.appendChild(script);
}

/** Alter Name, weiterhin gültig – die Anbindung umfasst jetzt auch Analytics. */
export const loadGoogleAdsTag = loadGoogleTags;

/** Ein Ereignis an alle konfigurierten Google-Ziele senden. */
function sendEvent(name: string, params: Record<string, unknown>) {
  if (!trackingAllowed()) return;
  loadGoogleTags();
  window.gtag?.("event", name, params);
}

/**
 * Abgeschickte Terminanfrage – das eigentliche Ziel der Website.
 *
 * Der Auftragswert ist zu diesem Zeitpunkt nur der errechnete Angebotspreis;
 * verbindlich wird er erst nach der Prüfung. Er wird trotzdem mitgesendet,
 * weil Google Ads sonst alle Anfragen gleich gewichtet und günstige
 * Innenreinigungen genauso hoch bewertet wie eine Keramikversiegelung.
 */
export function reportBookingRequest(params: { value: number; bookingId: string }) {
  if (adsId() && adsLabel()) {
    sendEvent("conversion", {
      send_to: `${adsId()}/${adsLabel()}`,
      value: params.value,
      currency: "EUR",
      transaction_id: params.bookingId,
    });
  }
  // Für Analytics ein eigenes, sprechendes Ereignis: In GA4 lässt es sich
  // als Schlüsselereignis markieren, ohne die Ads-Conversion zu berühren.
  if (ga4Id()) {
    sendEvent("generate_lead", {
      send_to: ga4Id(),
      value: params.value,
      currency: "EUR",
    });
  }
}

/** Meldet nach erteilter Einwilligung einen abgeschlossenen Auftrag. */
export function reportAdsConversion(params: { value: number; invoiceNumber: string }) {
  if (!adsId() || !adsLabel()) return;
  sendEvent("conversion", {
    send_to: `${adsId()}/${adsLabel()}`,
    value: params.value,
    currency: "EUR",
    transaction_id: params.invoiceNumber,
  });
}

/** Entfernt die gespeicherte Einwilligung und zeigt das Banner erneut an. */
export function resetAdsConsent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  for (const key of LEGACY_STORAGE_KEYS) window.localStorage.removeItem(key);
  window.location.reload();
}
