import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getStoredConsent, setStoredConsent } from "@/lib/consent";
import { loadGoogleTag } from "@/lib/googleTag";
import { ctaGhost, ctaPrimary } from "./ui";

/**
 * Cookie-Einwilligung (§ 25 TDDDG). Erscheint nur, solange noch keine
 * Entscheidung in localStorage (`wg-consent`) liegt. Erst nach „Akzeptieren“
 * lädt {@link loadGoogleTag} den Google Tag (Ads/GA4) nach — vorher stellt
 * die Website keine Verbindung zu Google her.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const rejectRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const existing = getStoredConsent();
    if (existing === "accepted") {
      loadGoogleTag();
    } else if (existing === null) {
      setVisible(true);
    }
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
    loadGoogleTag();
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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-fg/10 bg-bg p-4 text-fg shadow-[0_-4px_20px_rgba(0,0,0,0.15)] sm:p-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p id="consent-title" className="sr-only">
            Cookie-Einwilligung
          </p>
          <p id="consent-text" className="text-sm text-fg/80">
            Wir laden Google Ads/Analytics erst, wenn Sie „Akzeptieren“ wählen. Details in der{" "}
            <Link to="/datenschutz" className="underline underline-offset-2">
              Datenschutzerklärung
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button ref={rejectRef} type="button" onClick={reject} className={ctaGhost}>
            Ablehnen
          </button>
          <button type="button" onClick={accept} className={ctaPrimary}>
            Akzeptieren
          </button>
        </div>
      </div>
    </div>
  );
}
