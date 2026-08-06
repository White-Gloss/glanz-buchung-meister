import { readStoredConsent } from "./adsConsent";

/**
 * META PIXEL (FACEBOOK / INSTAGRAM)
 * ----------------------------------
 * Ereignisse für Meta-Anzeigen: ViewContent beim Lesen eines Ratgeber-
 * Beitrags, Lead/Contact bei Anfragen aus einem FAQ-Abschnitt heraus.
 *
 * RECHTLICHER RAHMEN (identisch zum bereits vorhandenen Google-Ads-Tag):
 * Der Pixel darf erst NACH aktiver Einwilligung laden (§ 25 Abs. 1 TDDDG,
 * Art. 6 Abs. 1 lit. a DSGVO). Deshalb hängt sowohl das Nachladen des
 * Skripts als auch JEDES einzelne Ereignis an derselben Einwilligung, die
 * das Cookie-Banner speichert. Ohne Einwilligung passiert hier nichts —
 * es wird kein Skript geladen und keine Anfrage gesendet.
 *
 * Ohne gesetzte VITE_META_PIXEL_ID ist die gesamte Anbindung inaktiv.
 */

type FbqFn = ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean };

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

/** Einheitliche Kategorie für alle Inhalte dieser Website. */
export const META_CONTENT_CATEGORY = "Fahrzeugpflege/Detailing";

function pixelId(): string | undefined {
  return import.meta.env.VITE_META_PIXEL_ID;
}

/** Einwilligung erteilt und Pixel konfiguriert? */
function trackingAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (!pixelId()) return false;
  return readStoredConsent() === "granted";
}

/**
 * Lädt das Pixel-Skript nach — erst aufrufen, wenn die Einwilligung
 * vorliegt. Mehrfachaufrufe sind unschädlich.
 */
export function loadMetaPixel() {
  if (!trackingAllowed()) return;
  if (window.fbq) return;

  // Offizieller Meta-Ladeschnipsel, in TypeScript nachgebaut: Ereignisse
  // werden zwischengespeichert, bis das externe Skript geladen ist.
  const fbq: FbqFn = function (...args: unknown[]) {
    fbq.queue?.push(args);
  } as FbqFn;
  fbq.queue = [];
  fbq.loaded = true;
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.id = "meta-pixel";
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  fbq("init", pixelId());
  fbq("track", "PageView");
}

/**
 * Erzeugt eine Ereignis-ID. Pixel (Browser) und Conversions API (Server)
 * senden dasselbe Ereignis mit derselben ID — Meta erkennt daran das
 * Duplikat und zählt es nur einmal.
 */
function createEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

type TrackOptions = {
  /** Zusätzliche Ereignisdaten (content_name, value, …). */
  params?: Record<string, unknown>;
  /**
   * Ereignis zusätzlich serverseitig über die Conversions API melden.
   * Sinnvoll für Lead/Contact — dort kosten blockierte Skripte echte
   * Messdaten. Für ViewContent meist unnötig.
   */
  alsoServerSide?: boolean;
};

/**
 * Sendet ein Standard-Ereignis an Meta. Gibt die Ereignis-ID zurück
 * (bzw. null, wenn wegen fehlender Einwilligung nichts gesendet wurde).
 */
export function trackMetaEvent(eventName: string, options: TrackOptions = {}): string | null {
  if (!trackingAllowed()) return null;

  loadMetaPixel();
  const eventId = createEventId();
  const params = { ...options.params };

  window.fbq?.("track", eventName, params, { eventID: eventId });

  if (options.alsoServerSide) {
    // Bewusst dynamisch importiert: die Server-Function zieht Code nach,
    // den öffentliche Seiten sonst ungenutzt mitladen würden.
    void import("./metaCapi.functions")
      .then(({ sendMetaConversion }) =>
        sendMetaConversion({
          data: {
            eventName,
            eventId,
            eventSourceUrl: window.location.href,
            customData: params as Record<string, string | number>,
          },
        }),
      )
      .catch(() => {
        // Messfehler dürfen die Seite nie beeinträchtigen.
      });
  }

  return eventId;
}

/** Aufruf einer Ratgeber-Seite melden (Lesen eines Blogartikels). */
export function trackArticleView(article: { slug: string; title: string }) {
  trackMetaEvent("ViewContent", {
    params: {
      content_type: "article",
      content_ids: [article.slug],
      content_name: article.title,
      content_category: META_CONTENT_CATEGORY,
    },
  });
}

/**
 * Kontaktaufnahme aus einem FAQ- oder Ratgeber-Abschnitt heraus.
 *
 * "Contact" = Anruf/WhatsApp/E-Mail direkt aus dem Inhalt heraus,
 * "Lead" = abgeschickte Terminanfrage. Beides zusätzlich serverseitig,
 * weil gerade diese Ereignisse für die Anzeigenoptimierung zählen.
 */
export function trackContactFromContent(source: string) {
  trackMetaEvent("Contact", {
    params: { content_category: META_CONTENT_CATEGORY, content_name: source },
    alsoServerSide: true,
  });
}

export function trackLeadFromContent(source: string, value?: number) {
  trackMetaEvent("Lead", {
    params: {
      content_category: META_CONTENT_CATEGORY,
      content_name: source,
      ...(typeof value === "number" ? { value, currency: "EUR" } : {}),
    },
    alsoServerSide: true,
  });
}
