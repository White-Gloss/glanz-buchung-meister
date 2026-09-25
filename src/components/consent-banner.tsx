import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CONSENT_SETTINGS_EVENT, getStoredConsent, onConsentChange, setStoredConsent } from "@/lib/consent";
import { loadGoogleTag, stopGoogleTag } from "@/lib/googleTag";
import { ctaGhost, ctaPrimary } from "./ui";

export function CookieSettingsButton() {
  return <button type="button" className="link-draw inline-flex min-h-11 items-center text-left hover:text-fg" onClick={() => window.dispatchEvent(new Event(CONSENT_SETTINGS_EVENT))}>Cookie-Einstellungen</button>;
}

/**
 * Cookie-Einwilligung (§ 25 TDDDG). Erscheint nur, solange noch keine
 * Entscheidung in localStorage (`wg-consent`) liegt. Erst nach „Akzeptieren“
 * lädt {@link loadGoogleTag} den Google Tag (Ads/GA4) nach — vorher stellt
 * die Website keine Verbindung zu Google her.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const rejectRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const existing = getStoredConsent();
    setAccepted(existing === "accepted");
    if (existing === "accepted") {
      loadGoogleTag();
    } else if (existing === null) {
      setVisible(true);
    }
    const openSettings = () => setVisible(true);
    window.addEventListener(CONSENT_SETTINGS_EVENT, openSettings);
    const unsubscribe = onConsentChange((choice) => {
      setAccepted(choice === "accepted");
      if (choice === "accepted") loadGoogleTag();
      else if (stopGoogleTag()) window.location.reload();
    });
    return () => {
      window.removeEventListener(CONSENT_SETTINGS_EVENT, openSettings);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    document.body.dataset.consentBanner = "open";
    const banner = bannerRef.current;
    const updateHeight = () => {
      document.documentElement.style.setProperty(
        "--consent-banner-height",
        `${banner?.getBoundingClientRect().height ?? 0}px`,
      );
    };
    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    if (banner) resizeObserver.observe(banner);
    const active = document.activeElement;
    previousFocusRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
    rejectRef.current?.focus();
    return () => {
      resizeObserver.disconnect();
      document.documentElement.style.removeProperty("--consent-banner-height");
      delete document.body.dataset.consentBanner;
    };
  }, [visible]);

  if (!visible) return null;

  function dismiss() {
    if (bannerRef.current?.contains(document.activeElement)) {
      const previous = previousFocusRef.current;
      const target =
        previous?.isConnected && !previous.closest("[inert]")
          ? previous
          : document.getElementById("main-content");
      target?.focus({ preventScroll: true });
    }
    setVisible(false);
  }

  function accept() {
    setStoredConsent("accepted");
    dismiss();
  }

  function reject() {
    setStoredConsent("rejected");
    dismiss();
  }

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      aria-describedby="consent-text"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          reject();
        }
      }}
      className="consent-banner fixed inset-x-0 bottom-0 z-50 border-t border-fg/10 bg-bg text-fg"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p id="consent-title" className="font-medium">
            Cookie-Einstellungen
          </p>
          <p id="consent-text" className="text-sm text-fg/80">
            Mit Ihrer Zustimmung nutzen wir Google Ads und Analytics zur Werbe- und Besucherauswertung. Die Dienste werden erst nach einem Klick auf „Akzeptieren“ geladen. Details finden Sie in der{" "}
            <Link to="/datenschutz" className="underline underline-offset-2">
              Datenschutzerklärung
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button ref={rejectRef} type="button" onClick={reject} className={ctaGhost}>
            {accepted ? "Einwilligung widerrufen" : "Ablehnen"}
          </button>
          <button type="button" onClick={accept} className={ctaPrimary}>
            Akzeptieren
          </button>
        </div>
      </div>
    </div>
  );
}
