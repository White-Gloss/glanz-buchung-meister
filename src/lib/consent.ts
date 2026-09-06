/**
 * COOKIE-EINWILLIGUNG (§ 25 TDDDG, Art. 6 Abs. 1 lit. a DSGVO)
 * --------------------------------------------------------------
 * Speichert die Entscheidung der Besucher:in zu nicht technisch notwendigen
 * Skripten (Google Ads, GA4, Meta Pixel) in localStorage unter dem Schlüssel
 * `wg-consent`. Ohne gespeicherte Entscheidung wird nichts geladen — das
 * Banner bleibt sichtbar, bis aktiv gewählt wurde.
 */

export type ConsentChoice = "accepted" | "rejected";

export const CONSENT_STORAGE_KEY = "wg-consent";

const CONSENT_CHANGE_EVENT = "wg-consent-change";

function isConsentChoice(value: unknown): value is ConsentChoice {
  return value === "accepted" || value === "rejected";
}

/** Liefert die gespeicherte Entscheidung, oder `null` wenn noch keine getroffen wurde. */
export function getStoredConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return isConsentChoice(value) ? value : null;
  } catch {
    // localStorage kann in privaten/eingeschränkten Kontexten eine Ausnahme
    // werfen (z. B. Safari im privaten Modus). Dann gilt: keine Entscheidung.
    return null;
  }
}

/** Speichert die Entscheidung und benachrichtigt Listener im selben Tab. */
export function setStoredConsent(choice: ConsentChoice): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Speichern fehlgeschlagen: Banner erscheint beim nächsten Aufruf erneut.
  }
  window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_CHANGE_EVENT, { detail: choice }));
}

/** Meldet Änderungen der Einwilligung innerhalb desselben Tabs (z. B. für einen erneuten Ladeversuch). */
export function onConsentChange(listener: (choice: ConsentChoice) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<ConsentChoice>).detail;
    if (isConsentChoice(detail)) listener(detail);
  };
  window.addEventListener(CONSENT_CHANGE_EVENT, handler);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, handler);
}
