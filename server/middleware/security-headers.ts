import { applySecurityHeaders } from "../security-headers";

type HeaderBag = {
  set: (name: string, value: string) => void;
  get?: (name: string) => string | null;
};

type MiddlewareEvent = {
  url?: { protocol?: string; pathname?: string };
};

/**
 * Production (Nitro) security headers. Framing is locked — this path is the
 * IONOS/Vercel deploy, not the Grok preview iframe.
 *
 * HSTS is always on here. Caddy terminates TLS and proxies HTTP to Node, so
 * `event.url.protocol` is `http:` even for public HTTPS. Smoke and browsers
 * still need Strict-Transport-Security on the live response.
 */
export default async function securityHeadersMiddleware(
  event: MiddlewareEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const result = await next();
  if (!result || typeof result !== "object") return result;
  const res = result as { headers?: HeaderBag };
  if (typeof res.headers?.set !== "function") return result;
  applySecurityHeaders((name, value) => res.headers!.set(name, value), {
    allowFraming: false,
    hsts: true,
  });
  const path = event.url?.pathname ?? "";
  const type = res.headers.get?.("content-type") ?? "";
  if (/\.(?:avif|webp|woff2|png|jpe?g|svg|js|css|webm|mp4|ico|gif|webmanifest)$/i.test(path)) {
    res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (/\.(?:xml|txt)$/i.test(path)) {
    res.headers.set("Cache-Control", "public, max-age=86400");
  } else if (type.includes("text/html") || path === "/" || !path.includes(".")) {
    res.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  }
  return result;
}
