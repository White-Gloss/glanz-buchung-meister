import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const WEEK_IN_SECONDS = 60 * 60 * 24 * 7;
const YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
const STATIC_CACHE_CONTROL = `public, max-age=${WEEK_IN_SECONDS}`;
// Vite gibt Build-Chunks und Assets stets mit einem Inhalts-Hash im
// Dateinamen aus. Ändert sich der Inhalt, ändert sich der Hash – die URL
// wird also nie wiederverwendet. Deshalb darf der Browser sie dauerhaft
// zwischenspeichern (immutable), was bei wiederkehrenden Besuchern und nach
// Klicks auf andere Seiten die Netzwerklast komplett eliminiert.
const IMMUTABLE_CACHE_CONTROL = `public, max-age=${YEAR_IN_SECONDS}, immutable`;

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
              // Vite-Build-Chunks (JS, CSS, Fonts) – immer mit Hash im Namen,
              // daher sicher für dauerhaftes Browser-Caching geeignet.
              "/_build/**": { headers: { "cache-control": IMMUTABLE_CACHE_CONTROL } },
              "/wgd-logo-**": { headers: { "cache-control": STATIC_CACHE_CONTROL } },
              "/favicon.ico": { headers: { "cache-control": STATIC_CACHE_CONTROL } },
              "/favicon-**": { headers: { "cache-control": STATIC_CACHE_CONTROL } },
              "/apple-touch-icon.png": {
                headers: { "cache-control": STATIC_CACHE_CONTROL },
              },
              "/site.webmanifest": { headers: { "cache-control": STATIC_CACHE_CONTROL } },
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
