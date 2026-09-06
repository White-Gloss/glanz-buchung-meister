import { createFileRoute } from "@tanstack/react-router";
import staticXml from "@/data/sitemap-static.xml?raw";
import { site } from "@/data/site";
import { createSitemapResponder, loadPublishedSitemapBlogs } from "@/lib/sitemap.server";

const respond = createSitemapResponder({
  staticXml,
  origin: site.origin,
  loadPublished: async () => {
    const { getSql } = await import("@/lib/db");
    return loadPublishedSitemapBlogs(await getSql());
  },
  onFallback: () => console.warn("[sitemap] CMS unavailable; serving the static sitemap."),
});

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => respond(),
      HEAD: async () => {
        const response = await respond();
        return new Response(null, { status: response.status, headers: response.headers });
      },
    },
  },
});
