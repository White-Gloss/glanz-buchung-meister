/** Minimaler Typ für das von Google injizierte globale `gtag`. */
type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

const STORAGE_KEY = "ads-consent";

export type AdsConsent = "granted" | "denied";

export function readStoredConsent(): AdsConsent | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "granted" || value === "denied" ? value : null;
}

export function storeAdsConsent(value: AdsConsent) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value);
}

export function loadGoogleAdsTag() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
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

/** Meldet nach erteilter Einwilligung einen abgeschlossenen Auftrag. */
export function reportAdsConversion(params: { value: number; invoiceNumber: string }) {
  const conversionId = import.meta.env.VITE_GOOGLE_ADS_CONVERSION_ID;
  const label = import.meta.env.VITE_GOOGLE_ADS_CONVERSION_LABEL;
  if (!conversionId || !label || readStoredConsent() !== "granted") return;
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  window.gtag("event", "conversion", {
    send_to: `${conversionId}/${label}`,
    value: params.value,
    currency: "EUR",
    transaction_id: params.invoiceNumber,
  });
}

/** Entfernt die gespeicherte Einwilligung und zeigt das Banner erneut an. */
export function resetAdsConsent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}
