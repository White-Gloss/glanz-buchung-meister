import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const WEEK_IN_SECONDS = 60 * 60 * 24 * 7;
const YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
const STATIC_CACHE_CONTROL = `public, max-age=${WEEK_IN_SECONDS}`;
const IMMUTABLE_CACHE = `public, max-age=${YEAR_IN_SECONDS}, immutable`;

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      server: { entry: "server" },
    }),
    ...(command === "build"
      ? [
          nitro({
            preset: "node-server",
            compressPublicAssets: { gzip: true, brotli: true },
            routeRules: {
              /** ════════════════════════════════════════
               *  GLOBALE SECURITY HEADERS
               *  ════════════════════════════════════════ */
              "/**": {
                headers: {
                  "X-Content-Type-Options": "nosniff",
                  "X-Frame-Options": "SAMEORIGIN",
                  "Referrer-Policy": "strict-origin-when-cross-origin",
                  "X-DNS-Prefetch-Control": "on",
                  "X-XSS-Protection": "0", // Veraltet, absichtlich deaktiviert
                  "Permissions-Policy":
                    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
                },
              },
              "/wgd-logo-**": { headers: { "cache-control": STATIC_CACHE_CONTROL } },
              "/favicon.ico": { headers: { "cache-control": STATIC_CACHE_CONTROL } },
              "/favicon-**": { headers: { "cache-control": STATIC_CACHE_CONTROL } },
              "/apple-touch-icon.png": {
                headers: { "cache-control": STATIC_CACHE_CONTROL },
              },
              "/site.webmanifest": { headers: { "cache-control": STATIC_CACHE_CONTROL } },
              "/_build/**": { headers: { "cache-control": IMMUTABLE_CACHE } },
              "/assets/**": { headers: { "cache-control": IMMUTABLE_CACHE } },
            },
          }),
        ]
      : []),
    react(),
  ],
  css: { transformer: "lightningcss" },
  resolve: {
    tsconfigPaths: true,
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    ignoreOutdatedRequests: true,
  },
  server: {
    port: 5000,
    host: "0.0.0.0",
    strictPort: true,
    watch: {
      awaitWriteFinish: {
        stabilityThreshold: 1_000,
        pollInterval: 100,
      },
    },
  },
}));
