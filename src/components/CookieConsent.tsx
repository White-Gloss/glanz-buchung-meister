import { useEffect, useState } from "react";
import {
  loadGoogleAdsTag,
  readStoredConsent,
  storeAdsConsent,
  type AdsConsent,
} from "@/lib/adsConsent";

/**
 * COOKIE-CONSENT FÜR GOOGLE ADS CONVERSION-TRACKING
 * ---------------------------------------------------
 * Diese Seite lädt außer dem Google-Ads-Tag keine weiteren Tracking-Skripte.
 * Das Banner regelt ausschließlich die dafür nötigen Cookies und ähnlichen
 * Speichertechnologien.
 *
 * Rechtlicher Kern (TDDDG § 25, DSGVO Art. 6 Abs. 1 lit. a):
 *   - Das Google-Tag darf erst NACH aktiver Zustimmung laden – nicht vorher
 *     und nicht standardmäßig aktiv mit nachträglicher Widerspruchsmöglichkeit.
 *   - "Ablehnen" muss genauso leicht erreichbar sein wie "Akzeptieren" (keine
 *     Cookie-Wall, kein optisch hervorgehobener Zustimmen-Knopf).
 *   - Die Entscheidung wird selbst gespeichert (localStorage), damit das
 *     Banner nicht bei jedem Aufruf erneut erscheint – das ist zulässig,
 *     weil diese eine Speicherung keine Werbedaten enthält, sondern nur die
 *     eigene Entscheidung des Besuchers festhält.
 *   - Der Widerruf muss jederzeit möglich sein; die Datenschutzerklärung
 *     stellt dafür eine eigene Schaltfläche bereit.
 */

export function CookieConsentBanner() {
  const [consent, setConsent] = useState<AdsConsent | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readStoredConsent());
    setReady(true);
  }, []);

  useEffect(() => {
    if (consent !== "granted") return;
    loadGoogleAdsTag();
    // Meta Pixel erst nach der Einwilligung nachladen – gleiche Regel wie
    // beim Google-Tag. Dynamischer Import, damit der Pixel-Code auf
    // Seiten ohne Einwilligung gar nicht erst im Bundle landet.
    void import("@/lib/metaPixel").then((m) => m.loadMetaPixel());
  }, [consent]);

  if (!ready || consent !== null) return null;
  // Ohne konfiguriertes Ziel gibt es nichts zu erlauben – kein Banner nötig.
  if (!import.meta.env.VITE_GOOGLE_ADS_CONVERSION_ID && !import.meta.env.VITE_META_PIXEL_ID) {
    return null;
  }

  function decide(value: AdsConsent) {
    storeAdsConsent(value);
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
          Mit Ihrer Einwilligung nutzen wir Cookies und ähnliche Technologien von Google Ads sowie
          Meta (Facebook und Instagram), um zu messen, über welche Anzeige eine Terminanfrage
          zustande kommt. Ohne Einwilligung funktionieren Website und Buchung unverändert – nur die
          Anzeigenmessung entfällt. Details in der{" "}
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
