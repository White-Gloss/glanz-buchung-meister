import { useEffect, useState } from "react";

/** Minimaler Typ für das von Google injizierte globale `gtag`. */
type GtagFn = (...args: unknown[]) => void;
declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

/**
 * COOKIE-CONSENT FÜR GOOGLE ADS CONVERSION-TRACKING
 * ---------------------------------------------------
 * Diese Seite lädt außer dem Google-Ads-Tag keine weiteren Cookies oder
 * Tracking-Skripte. Das Banner regelt ausschließlich diesen einen Cookie.
 *
 * Rechtlicher Kern (TTDSG § 25, DSGVO Art. 6 Abs. 1 lit. a):
 *   - Das Google-Tag darf erst NACH aktiver Zustimmung laden – nicht vorher
 *     und nicht standardmäßig aktiv mit nachträglicher Widerspruchsmöglichkeit.
 *   - "Ablehnen" muss genauso leicht erreichbar sein wie "Akzeptieren" (keine
 *     Cookie-Wall, kein optisch hervorgehobener Zustimmen-Knopf).
 *   - Die Entscheidung wird selbst gespeichert (localStorage), damit das
 *     Banner nicht bei jedem Aufruf erneut erscheint – das ist zulässig,
 *     weil diese eine Speicherung keine Werbedaten enthält, sondern nur die
 *     eigene Entscheidung des Besuchers festhält.
 *   - Der Widerruf muss jederzeit möglich sein: siehe `resetAdsConsent()`,
 *     verlinkt aus der Datenschutzerklärung.
 */

const STORAGE_KEY = "ads-consent";
type Consent = "granted" | "denied";

function readStoredConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "granted" || value === "denied" ? value : null;
}

function loadGoogleAdsTag() {
  const conversionId = import.meta.env.VITE_GOOGLE_ADS_CONVERSION_ID;
  if (!conversionId || document.getElementById("google-ads-tag")) return;

  const script = document.createElement("script");
  script.id = "google-ads-tag";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${conversionId}`;
  document.head.appendChild(script);

  const inline = document.createElement("script");
  inline.id = "google-ads-tag-init";
  inline.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${conversionId}');
  `;
  document.head.appendChild(inline);
}

/** Vom Buchungsassistenten aufgerufen, um den Abschluss zu melden. */
export function reportAdsConversion(params: { value: number; invoiceNumber: string }) {
  const conversionId = import.meta.env.VITE_GOOGLE_ADS_CONVERSION_ID;
  const label = import.meta.env.VITE_GOOGLE_ADS_CONVERSION_LABEL;
  if (!conversionId || !label) return;
  if (readStoredConsent() !== "granted") return;
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  window.gtag("event", "conversion", {
    send_to: `${conversionId}/${label}`,
    value: params.value,
    currency: "EUR",
    transaction_id: params.invoiceNumber,
  });
}

/** Von der Datenschutzerklärung aus verlinkt – macht die Einwilligung rückgängig. */
export function resetAdsConsent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

export function CookieConsentBanner() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readStoredConsent());
    setReady(true);
  }, []);

  useEffect(() => {
    if (consent === "granted") loadGoogleAdsTag();
  }, [consent]);

  if (!ready || consent !== null) return null;
  // Ohne konfigurierte Conversion-ID gibt es nichts zu erlauben – kein Banner nötig.
  if (!import.meta.env.VITE_GOOGLE_ADS_CONVERSION_ID) return null;

  function decide(value: Consent) {
    window.localStorage.setItem(STORAGE_KEY, value);
    setConsent(value);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie-Einwilligung"
      aria-describedby="cookie-consent-text"
      className="fixed inset-x-0 bottom-0 z-[90] border-t border-border bg-background/95 px-4 py-5 backdrop-blur sm:px-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p id="cookie-consent-text" className="text-sm leading-6 text-muted-foreground">
          Mit Ihrer Einwilligung nutzen wir ein Cookie von Google Ads, um zu messen, über welche
          Anzeige eine Terminanfrage zustande kommt. Ohne Einwilligung funktioniert die Buchung
          unverändert – nur die Anzeigenmessung entfällt. Details in der{" "}
          <a href="/datenschutz" className="text-primary underline underline-offset-2">
            Datenschutzerklärung
          </a>
          .
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => decide("denied")}
            className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary/50"
          >
            Ablehnen
          </button>
          <button
            type="button"
            onClick={() => decide("granted")}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Akzeptieren
          </button>
        </div>
      </div>
    </div>
  );
}
