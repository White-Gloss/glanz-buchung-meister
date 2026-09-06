import { applySecurityHeaders } from "../security-headers";
import { responseCacheControl } from "../cache-policy";

type HeaderBag = {
  set: (name: string, value: string) => void;
  get?: (name: string) => string | null;
};

type MiddlewareEvent = {
  url?: { protocol?: string; pathname?: string };
  req?: { method?: string };
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
  const res = result as { headers?: HeaderBag; status?: number };
  if (typeof res.headers?.set !== "function") return result;
  applySecurityHeaders((name, value) => res.headers!.set(name, value), {
    allowFraming: false,
    hsts: true,
  });
  const cacheControl = responseCacheControl({
    pathname: event.url?.pathname ?? "",
    contentType: res.headers.get?.("content-type") ?? "",
    existing: res.headers.get?.("cache-control") ?? "",
    method: event.req?.method,
    status: res.status,
    hasSetCookie: Boolean(res.headers.get?.("set-cookie")),
  });
  if (cacheControl) res.headers.set("Cache-Control", cacheControl);
  return result;
}
