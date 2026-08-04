import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

const CANONICAL_HOST = "whitegloss.de";
const PUBLIC_PAGE_PREFIXES = [
  "/abholservice",
  "/leistungen",
  "/preise",
  "/qualitaet",
  "/impressum",
  "/datenschutz",
];

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

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
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

function isPublicPage(pathname: string): boolean {
  if (pathname === "/" || pathname === "/sitemap.xml") return true;
  return PUBLIC_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function withProductionHeaders(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // Schriften bleiben self-hosted. Externe Verbindungen sind auf die
  // Supabase-Galerie sowie das erst nach Einwilligung geladene Google-Ads-Tag
  // beschränkt. 'unsafe-inline' ist für JSON-LD und Hydration-State nötig.
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://*.supabase.co https://www.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co https://www.googletagmanager.com https://www.google-analytics.com https://region1.google-analytics.com https://www.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  );

  const url = new URL(request.url);
  if (request.method === "GET" && response.status === 200 && isPublicPage(url.pathname)) {
    headers.set("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  } else if (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/reset-password")
  ) {
    headers.set("Cache-Control", "private, no-store");
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
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
