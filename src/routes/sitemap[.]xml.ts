import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { pickupCitiesByDistance } from "@/lib/pickupLocations";
import { servicePages } from "@/lib/servicePages";
import { listPublishedCustomServices } from "@/lib/customServices.functions";
import { listPublishedBlogPosts } from "@/lib/blog.functions";
import { SITE_URL } from "@/lib/seo";

const BASE_URL = SITE_URL;

interface SitemapEntry {
  path: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        /*
          EINE UNVOLLSTÄNDIGE SITEMAP IST SCHÄDLICHER ALS GAR KEINE.

          Früher wurden Datenbankfehler hier verschluckt: Die Sitemap kam
          dann mit Status 200 heraus, nur ohne Ratgeber-Beiträge und ohne
          eigene Leistungen. Für Google ist das keine Störung, sondern eine
          Aussage — „diese Adressen gehören nicht mehr dazu".

          Mit einer 503-Antwort behält Google stattdessen die zuletzt
          gelesene Fassung und versucht es später erneut. Die fest im Code
          stehenden Seiten allein auszuliefern, wäre der schlechtere Weg.
        */
        let customServiceEntries: SitemapEntry[] = [];
        let blogEntries: SitemapEntry[] = [];
        try {
          const rows = await listPublishedCustomServices();
          customServiceEntries = rows.map((row) => ({
            path: `/leistungen/${row.slug}`,
          }));

          // Ratgeber-Beiträge: nur veröffentlichte, geplante bleiben außen
          // vor (das übernimmt bereits die Abfrage selbst).
          const posts = await listPublishedBlogPosts();
          blogEntries = posts.map((post) => ({ path: `/ratgeber/${post.slug}` }));
        } catch (error) {
          console.error("[sitemap] Inhalte nicht abrufbar — 503 statt Kürzung", error);
          return new Response("Sitemap derzeit nicht verfügbar", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "3600" },
          });
        }

        const entries: SitemapEntry[] = [
          { path: "/" },
          { path: "/leistungen" },
          { path: "/luxusfahrzeuge" },
          { path: "/preise" },
          { path: "/qualitaet" },
          { path: "/abholservice" },
          { path: "/faq" },
          { path: "/ratgeber" },
          { path: "/fahrzeug-zustand" },
          { path: "/dellen-hagelschaden" },
          // Einzige indexierbare Rechtsseite — siehe Begründung in
          // impressum.tsx. Datenschutz, AGB und Widerruf stehen auf noindex
          // und gehören deshalb auch nicht in die Sitemap.
          { path: "/impressum" },
          ...blogEntries,
          ...servicePages.map<SitemapEntry>((service) => ({
            path: `/leistungen/${service.slug}`,
          })),
          ...customServiceEntries,
          ...pickupCitiesByDistance.map<SitemapEntry>((c) => ({
            path: `/abholservice/${c.slug}`,
          })),
        ];

        const urls = entries.map((entry) =>
          [`  <url>`, `    <loc>${BASE_URL}${entry.path}</loc>`, `  </url>`].join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
