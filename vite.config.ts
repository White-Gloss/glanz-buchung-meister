// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Routen einzeln aufteilen. Ohne diese Option importiert routeTree.gen.ts
    // ALLE Routen statisch – dadurch lag der Auth-Code des Admin-Bereichs
    // (~35 KB) im Startgraph jeder öffentlichen Seite.
    router: { autoCodeSplitting: true },
  },
  // Die Seite läuft auf Hostinger in einer Node-Umgebung, nicht auf Cloudflare
  // Workers. Ohne diese Festlegung baut Nitro gegen "cloudflare-module": das
  // erzeugt eine wrangler.json und eine Worker-Umgebung, in der die direkte
  // Postgres-Verbindung (pg über TCP) nicht funktioniert.
  // Innerhalb der Lovable-Umgebung wird dieser Wert automatisch ignoriert.
  nitro: {
    preset: "node-server",
  },
  vite: {
    server: {
      port: 5000,
      host: "0.0.0.0",
      strictPort: true,
    },
  },
});
