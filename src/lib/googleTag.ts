/**
 * GOOGLE ADS / GA4 / GOOGLE TAG (GTAG.JS)
 * ---------------------------------------
 * Verwaltung des Google Tags für Google Ads Conversion-Tracking und optional
 * GA4. Standard-Tag-ID für Ads: AW-18384520682.
 *
 * WICHTIG (§ 25 TDDDG / Art. 6 Abs. 1 lit. a DSGVO): Das Skript
 * `googletagmanager.com/gtag/js` darf erst geladen werden, nachdem die
 * Besucher:in im Cookie-Banner „Akzeptieren“ gewählt hat. `loadGoogleTag()`
 * ist dafür der einzige vorgesehene Aufrufort — es gibt bewusst keinen
 * unbedingten `<script>`-Tag im HTML-Head mehr.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Gültiges Format für eine Google Ads ID (z.B. AW-18384520682). */
const ADS_ID_PATTERN = /^AW-\d+$/;

/** RegEx zum Herausfiltern einer AW-ID aus einem versehentlich vollständig kopierten HTML-Skript. */
const EXTRACT_ID_FROM_HTML = /AW-\d+/;

export const DEFAULT_GOOGLE_ADS_ID = "AW-18384520682";

/**
 * Löst die Google Ads Conversion-ID auf.
 * Berücksichtigt Umgebungsvariablen, bereinigt versehentlich kopierten
 * HTML-Code und fällt auf die Standard-ID zurück.
 */
export function resolveGoogleAdsId(raw?: string | null): string | null {
  if (raw === "false" || raw === "0" || raw === "none" || raw === "off") {
    return null;
  }

  const candidate = raw ? raw.trim() : "";
  if (!candidate) {
    return DEFAULT_GOOGLE_ADS_ID;
  }

  if (ADS_ID_PATTERN.test(candidate)) {
    return candidate;
  }

  const match = candidate.match(EXTRACT_ID_FROM_HTML);
  if (match) {
    return match[0];
  }

  return DEFAULT_GOOGLE_ADS_ID;
}

/** Gültiges Format für eine GA4-Mess-ID (z.B. G-RFX3GFRVBG). */
const GA4_ID_PATTERN = /^G-[A-Za-z0-9]+$/;

/**
 * Löst die GA4-Mess-ID auf. Anders als bei Google Ads gibt es keine
 * Standard-ID — ohne gültigen Wert bleibt GA4 schlicht inaktiv.
 */
export function resolveGa4MeasurementId(raw?: string | null): string | null {
  if (!raw) return null;
  if (raw === "false" || raw === "0" || raw === "none" || raw === "off") {
    return null;
  }
  const candidate = raw.trim();
  if (!candidate || !GA4_ID_PATTERN.test(candidate)) {
    return null;
  }
  return candidate;
}

let googleTagLoaded = false;

/** Nur für Tests: setzt den internen Ladezustand zurück. */
export function __resetGoogleTagStateForTests(): void {
  googleTagLoaded = false;
}

function ensureDataLayer(): void {
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  }
}

/**
 * Lädt gtag.js für Google Ads (und optional GA4) — ausschließlich nach
 * erteilter Cookie-Einwilligung. Wird die Funktion mehrfach aufgerufen, lädt
 * sie das Skript nur einmal und aktualisiert lediglich den Consent-Status.
 * Ohne konfigurierte ID (Ads deaktiviert und kein GA4 gesetzt) passiert
 * nichts.
 */
export function loadGoogleTag(options?: { adsId?: string | null; ga4Id?: string | null }): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  const adsId =
    options && options.adsId !== undefined
      ? options.adsId
      : resolveGoogleAdsId(import.meta.env.VITE_GOOGLE_ADS_CONVERSION_ID);
  const ga4Id =
    options && options.ga4Id !== undefined
      ? options.ga4Id
      : resolveGa4MeasurementId(import.meta.env.VITE_GA4_MEASUREMENT_ID);

  if (!adsId && !ga4Id) return false;

  ensureDataLayer();

  if (googleTagLoaded) {
    window.gtag?.("consent", "update", {
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted",
    });
    return true;
  }

  const primaryId = adsId ?? ga4Id;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${primaryId}`;
  document.head.appendChild(script);

  window.gtag?.("js", new Date());
  window.gtag?.("consent", "update", {
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
    analytics_storage: "granted",
  });
  if (adsId) window.gtag?.("config", adsId);
  if (ga4Id) window.gtag?.("config", ga4Id);

  googleTagLoaded = true;
  return true;
}

/**
 * Löst eine Conversion für Google Ads aus (z. B. nach Absenden einer Terminanfrage).
 * Verwendet das konfigurierte Conversion-Label, falls vorhanden.
 */
export function trackGoogleAdsConversion(options?: {
  adsId?: string | null;
  label?: string | null;
  value?: number;
  currency?: string;
}): boolean {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return false;
  }

  const adsId = options?.adsId ?? resolveGoogleAdsId(import.meta.env.VITE_GOOGLE_ADS_CONVERSION_ID);
  if (!adsId) return false;

  const label = options?.label ?? import.meta.env.VITE_GOOGLE_ADS_CONVERSION_LABEL ?? "";
  const sendTo = label ? `${adsId}/${label}` : adsId;

  window.gtag("event", "conversion", {
    send_to: sendTo,
    value: options?.value,
    currency: options?.currency ?? "EUR",
  });

  return true;
}
