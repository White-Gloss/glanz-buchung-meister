import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * META CONVERSIONS API (CAPI)
 * ----------------------------
 * Serverseitiges Gegenstück zum Meta Pixel. Sinn der Sache: Werbeblocker
 * und Browser-Tracking-Schutz verhindern häufig den Browser-Aufruf. Wird
 * dasselbe Ereignis zusätzlich vom Server gemeldet, bleibt die Messung
 * vollständig.
 *
 * DOPPELZÄHLUNG: Pixel und Server senden dieselbe `event_id`. Meta
 * verwirft daraufhin die zweite Meldung (Deduplizierung).
 *
 * EINWILLIGUNG: Diese Funktion wird ausschließlich aus trackMetaEvent()
 * heraus aufgerufen und dort strikt an die erteilte Einwilligung geknüpft.
 * Serverseitiges Melden ist rechtlich KEINE Umgehung der Einwilligung —
 * ohne Zustimmung darf auch hier nichts gesendet werden.
 *
 * Benötigte Umgebungsvariablen (nur serverseitig, niemals im Build):
 *   META_PIXEL_ID           ID des Datensatzes (wie VITE_META_PIXEL_ID)
 *   META_CAPI_ACCESS_TOKEN  Token aus dem Events Manager
 *   META_TEST_EVENT_CODE    optional, für den Testereignis-Reiter
 */

const GRAPH_API_VERSION = "v21.0";

/**
 * Meta erwartet personenbezogene Merkmale ausschließlich als SHA-256-Hash
 * in Kleinbuchstaben — Klartext würde die Anfrage ungültig machen.
 */
async function sha256Hex(value: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** Liest einen einzelnen Cookie-Wert aus dem Cookie-Header. */
function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || undefined;
  }
  return undefined;
}

export type MetaConversionInput = {
  eventName: string;
  /** Dieselbe ID wie im Browser-Ereignis — Grundlage der Deduplizierung. */
  eventId: string;
  eventSourceUrl: string;
  customData?: Record<string, string | number>;
  /** Optional, z. B. bei einer Terminanfrage mit bekannter E-Mail. */
  email?: string;
  phone?: string;
};

/**
 * Meldet ein Ereignis an die Conversions API.
 *
 * Schlägt der Aufruf fehl, wird das protokolliert, aber kein Fehler an den
 * Browser zurückgegeben: eine fehlgeschlagene Messung darf die Website nie
 * beeinträchtigen.
 */
export const sendMetaConversion = createServerFn({ method: "POST" })
  .validator((data: MetaConversionInput) => data)
  .handler(async ({ data }) => {
    const pixelId = process.env.META_PIXEL_ID || process.env.VITE_META_PIXEL_ID;
    const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
    // Ohne vollständige Konfiguration ist die Anbindung schlicht inaktiv.
    if (!pixelId || !accessToken) return { ok: false, skipped: true };

    const eventName = String(data.eventName ?? "").slice(0, 50);
    const eventId = String(data.eventId ?? "").slice(0, 100);
    if (!eventName || !eventId) return { ok: false, skipped: true };

    const request = getRequest();
    const headers = request?.headers;

    const userAgent = headers?.get("user-agent") ?? undefined;
    // Hinter dem Reverse-Proxy von Hostinger steht die echte Adresse im
    // ersten Eintrag von X-Forwarded-For.
    const forwardedFor = headers?.get("x-forwarded-for");
    const clientIp = forwardedFor?.split(",")[0]?.trim() || undefined;

    // Meta-eigene Browser-Kennungen: _fbp (Pixel-Cookie) und _fbc (Klick-ID
    // aus dem fbclid-Parameter). Sie verbessern die Zuordnung deutlich.
    const cookieHeader = headers?.get("cookie") ?? null;
    const fbp = readCookie(cookieHeader, "_fbp");
    const fbc = readCookie(cookieHeader, "_fbc");

    const userData: Record<string, unknown> = {
      ...(clientIp ? { client_ip_address: clientIp } : {}),
      ...(userAgent ? { client_user_agent: userAgent } : {}),
      ...(fbp ? { fbp } : {}),
      ...(fbc ? { fbc } : {}),
      ...(data.email ? { em: [await sha256Hex(data.email)] } : {}),
      // Telefonnummern ohne Sonderzeichen und mit Ländervorwahl hashen.
      ...(data.phone ? { ph: [await sha256Hex(data.phone.replace(/[^0-9]/g, ""))] } : {}),
    };

    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          event_source_url: data.eventSourceUrl,
          action_source: "website",
          user_data: userData,
          ...(data.customData ? { custom_data: data.customData } : {}),
        },
      ],
      ...(process.env.META_TEST_EVENT_CODE
        ? { test_event_code: process.env.META_TEST_EVENT_CODE }
        : {}),
    };

    try {
      const response = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(
          accessToken,
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        // Antworttext bewusst nicht weiterreichen: er kann Teile der
        // Konfiguration enthalten.
        console.error(`[Meta CAPI] Ereignis abgelehnt (HTTP ${response.status})`);
        return { ok: false, skipped: false };
      }
      return { ok: true, skipped: false };
    } catch (error) {
      console.error("[Meta CAPI] Ereignis konnte nicht gesendet werden", error);
      return { ok: false, skipped: false };
    }
  });
