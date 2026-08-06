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
        let customServiceEntries: SitemapEntry[] = [];
        try {
          const rows = await listPublishedCustomServices();
          customServiceEntries = rows.map((row) => ({
            path: `/leistungen/${row.slug}`,
          }));
        } catch {
          // Sitemap bleibt ohne eigene Leistungen funktionsfähig, falls die
          // Datenbank kurzzeitig nicht erreichbar ist.
        }

        // Ratgeber-Beiträge: nur veröffentlichte, geplante bleiben außen vor
        // (das übernimmt bereits die Abfrage selbst).
        let blogEntries: SitemapEntry[] = [];
        try {
          const posts = await listPublishedBlogPosts();
          blogEntries = posts.map((post) => ({ path: `/ratgeber/${post.slug}` }));
        } catch {
          // Auch ohne Beiträge bleibt die Sitemap gültig.
        }

        const entries: SitemapEntry[] = [
          { path: "/" },
          { path: "/leistungen" },
          { path: "/preise" },
          { path: "/qualitaet" },
          { path: "/abholservice" },
          { path: "/faq" },
          { path: "/ratgeber" },
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
