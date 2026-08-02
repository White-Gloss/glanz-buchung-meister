import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { pickupCitiesByDistance } from "@/lib/pickupLocations";
import { servicePages } from "@/lib/servicePages";
import { allServiceCityCombos, serviceCityPath } from "@/lib/serviceCityPages";
import { SITE_URL } from "@/lib/seo";

const BASE_URL = SITE_URL;

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // Ein Deploy-Datum für alle Einträge: ehrlicher als ein erfundenes
        // Einzeldatum pro Seite und für Crawler ausreichend.
        const lastmod = new Date().toISOString().slice(0, 10);
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/leistungen", changefreq: "monthly", priority: "0.9" },
          { path: "/preise", changefreq: "monthly", priority: "0.9" },
          { path: "/qualitaet", changefreq: "monthly", priority: "0.8" },
          { path: "/abholservice", changefreq: "monthly", priority: "0.9" },
          ...servicePages.map<SitemapEntry>((service) => ({
            path: `/leistungen/${service.slug}`,
            changefreq: "monthly",
            priority: "0.9",
          })),
          ...pickupCitiesByDistance.map<SitemapEntry>((c) => ({
            path: `/abholservice/${c.slug}`,
            changefreq: "monthly",
            priority: "0.8",
          })),
          // Local-SEO-Matrix: jede Kombination aus Leistung und Stadt
          ...allServiceCityCombos().map<SitemapEntry>(({ service, city }) => ({
            path: serviceCityPath(service.slug, city.slug),
            changefreq: "monthly",
            priority: "0.7",
          })),
        ];

        const urls = entries.map((entry) => ({ lastmod, ...entry })).map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
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
