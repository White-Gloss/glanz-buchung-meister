import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { applySecurityHeaders } from "../server/security-headers";

// The installed Start entry hook preserves its normal request/context handling.
// Apply CSP to the renderer's response headers, including SSR 404 responses:
// h3 does not merge separately staged response headers into non-2xx responses.
const fetch = createStartHandler((context) => {
  applySecurityHeaders((name, value) => context.responseHeaders.set(name, value), {
    allowFraming: !import.meta.env.PROD,
    hsts: import.meta.env.PROD,
    nonce: context.router.options.ssr?.nonce,
  });
  return defaultStreamHandler(context);
});

export default { fetch };
