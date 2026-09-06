import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    const existing = getStoredConsent();
    if (existing === "accepted") {
      loadGoogleTag();
    } else if (existing === null) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function accept() {
    setStoredConsent("accepted");
    loadGoogleTag();
    setVisible(false);
  }

  function reject() {
    setStoredConsent("rejected");
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie-Einwilligung"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-fg/10 bg-bg p-4 text-fg shadow-[0_-4px_20px_rgba(0,0,0,0.15)] sm:p-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-fg/80">
          Wir laden Google Ads/Analytics erst, wenn Sie „Akzeptieren“ wählen. Details in der{" "}
          <Link to="/datenschutz" className="underline underline-offset-2">
            Datenschutzerklärung
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={reject} className={ctaGhost}>
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
