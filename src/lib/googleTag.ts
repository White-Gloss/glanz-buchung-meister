/**
 * GOOGLE ADS / GOOGLE TAG (GTAG.JS)
 * ---------------------------------
 * Verwaltung des Google Tags für Google Ads Conversion-Tracking.
 * Standard-Tag-ID: AW-18384520682.
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
