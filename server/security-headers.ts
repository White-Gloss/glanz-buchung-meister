import { createHash, randomBytes } from "node:crypto";

export type SecurityHeaderMode = {
  /** Preview is framed by Grok — never send SAMEORIGIN there. */
  allowFraming: boolean;
  hsts: boolean;
  /** Fresh per SSR request; TanStack applies the same value to its scripts. */
  nonce?: string;
  /** Hashes for static HTML documents that bypass the SSR router. */
  scriptHashes?: readonly string[];
};

export function createScriptNonce(): string {
  return randomBytes(32).toString("base64");
}

/** The HTML parser normalizes CRLF before CSP checks an inline script's text. */
export function inlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  for (const [, attributes, text] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (/\bsrc\s*=/i.test(attributes)) continue;
    const type = attributes.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1].toLowerCase();
    if (type && !["module", "text/javascript", "application/javascript"].includes(type)) continue;
    const normalized = text.replace(/\r\n?/g, "\n");
    hashes.add(`sha256-${createHash("sha256").update(normalized, "utf8").digest("base64")}`);
  }
  return [...hashes];
}

export function securityHeaderEntries(mode: SecurityHeaderMode): [string, string][] {
  if (mode.nonce && !/^[A-Za-z0-9+/]{43}=$/.test(mode.nonce)) {
    throw new Error("CSP nonce must be a 32-byte base64 value");
  }
  const inlineSources = [
    // The existing framed preview is not a production deployment.
    ...(mode.allowFraming ? ["'unsafe-inline'"] : []),
    ...(mode.nonce ? [`'nonce-${mode.nonce}'`] : []),
    ...(mode.scriptHashes ?? []).map((hash) => {
      if (!/^sha256-[A-Za-z0-9+/]{43}=$/.test(hash)) throw new Error("Invalid CSP script hash");
      return `'${hash}'`;
    }),
  ];
  const csp = [
    "default-src 'self'",
    [
      "script-src 'self'",
      ...inlineSources,
      "'unsafe-eval' 'wasm-unsafe-eval' blob: https://grok.com https://www.googletagmanager.com https://www.google-analytics.com https://googleads.g.doubleclick.net",
    ].join(" "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.google.com https://www.google.de https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.googletagmanager.com https://*.google-analytics.com",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "connect-src 'self' ws: wss: blob: https://grok.com https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.googletagmanager.com https://*.google.com https://*.doubleclick.net",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-src 'self' https://www.google.com https://maps.google.com https://www.openstreetmap.org https://td.doubleclick.net",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    mode.allowFraming ? "frame-ancestors *" : "frame-ancestors 'self'",
  ].join("; ");

  const headers: [string, string][] = [
    ["Content-Security-Policy", csp],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["X-Content-Type-Options", "nosniff"],
    ["X-XSS-Protection", "0"],
    [
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    ],
    ["X-DNS-Prefetch-Control", "off"],
  ];
  if (!mode.allowFraming) {
    // Keep the existing trial's narrower external/evaluation permissions.
    // Both policies allow the same request nonce or static document hashes.
    const trial = csp
      .replace(" 'unsafe-eval' 'wasm-unsafe-eval' blob: https://grok.com", "")
      .replace("connect-src 'self' ws: wss: blob: https://grok.com", "connect-src 'self'")
      .replace(
        "https://*.google.com https://*.doubleclick.net",
        "https://www.google.com https://www.google.de https://region1.google-analytics.com https://googleads.g.doubleclick.net",
      );
    headers.push(["Content-Security-Policy-Report-Only", trial]);
  }
  if (!mode.allowFraming) {
    headers.push(["X-Frame-Options", "SAMEORIGIN"]);
    headers.push(["Cross-Origin-Opener-Policy", "same-origin"]);
  }
  if (mode.hsts) {
    headers.push(["Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload"]);
  }
  return headers;
}

export function applySecurityHeaders(
  set: (name: string, value: string) => void,
  mode: SecurityHeaderMode,
) {
  for (const [name, value] of securityHeaderEntries(mode)) {
    set(name, value);
  }
}
