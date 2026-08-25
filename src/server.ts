import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { cacheControlForPath } from "./lib/responseCache";
import { protokollAusnahme } from "./lib/serverLog";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

const CANONICAL_HOST = "white-gloss.de";

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  protokollAusnahme(
    "ssr",
    "von h3 verschluckter Fehler",
    consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`),
  );
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function canonicalRedirect(request: Request): Response | undefined {
  const url = new URL(request.url);
  if (url.hostname !== `www.${CANONICAL_HOST}`) return;
  url.hostname = CANONICAL_HOST;
  url.protocol = "https:";
  return Response.redirect(url, 308);
}

function withProductionHeaders(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // Schriften bleiben self-hosted. Externe Verbindungen sind auf Supabase,
  // die erst nach Einwilligung geladenen Google-Ads- und Meta-Skripte sowie
  // die cookielose Reichweitenmessung von Ahrefs beschränkt. 'unsafe-inline'
  // ist für JSON-LD und Hydration-State nötig.
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net https://analytics.ahrefs.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://*.supabase.co https://www.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.facebook.com",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.facebook.com https://analytics.ahrefs.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  );

  const url = new URL(request.url);
  const cacheControl = cacheControlForPath(url.pathname);
  if (request.method === "GET" && response.status === 200 && cacheControl) {
    // HTML nach Deployments nicht im CDN festhalten. Alte HTML-Antworten können
    // sonst auf bereits entfernte, gehashte JS-Chunks zeigen und einzelne
    // Routen wie /preise mit einem Ladefehler abbrechen lassen.
    headers.set("Cache-Control", cacheControl);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const redirect = canonicalRedirect(request);
      if (redirect) return redirect;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return withProductionHeaders(request, normalized);
    } catch (error) {
      protokollAusnahme("server", "Anfrage abgebrochen", error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
