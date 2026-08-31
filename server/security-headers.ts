export type SecurityHeaderMode = {
  /** Preview is framed by Grok — never send SAMEORIGIN there. */
  allowFraming: boolean;
  hsts: boolean;
};

export function securityHeaderEntries(mode: SecurityHeaderMode): [string, string][] {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss: blob:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-src 'self' https://www.google.com https://maps.google.com https://www.openstreetmap.org",
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
    headers.push(["X-Frame-Options", "SAMEORIGIN"]);
  }
  if (mode.hsts) {
    headers.push(["Strict-Transport-Security", "max-age=15552000; includeSubDomains"]);
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
