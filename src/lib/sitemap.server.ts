import { appendBlogSitemap, type SitemapBlogRow } from "./sitemap.ts";
import type { Sql } from "./db.ts";

export async function loadPublishedSitemapBlogs(sql: Sql): Promise<SitemapBlogRow[]> {
  // Match listPublishedCms and the first matching row in /ratgeber/$slug.
  return sql<SitemapBlogRow>`
    select slug, created_at, updated_at
    from cms_items
    where shop_id = ${"white-gloss"} and kind = ${"blog"} and published = true
    order by sort asc, id desc
  `;
}

export function createSitemapResponder({
  staticXml,
  origin,
  loadPublished,
  timeoutMs = 2_000,
  onFallback = () => undefined,
}: {
  staticXml: string;
  origin: string;
  loadPublished: () => Promise<SitemapBlogRow[]>;
  timeoutMs?: number;
  onFallback?: () => void;
}) {
  let pending: Promise<SitemapBlogRow[]> | null = null;
  const reported = new WeakSet<Promise<SitemapBlogRow[]>>();

  return async function sitemapResponse(): Promise<Response> {
    if (!pending) {
      const operation = Promise.resolve().then(loadPublished);
      pending = operation;
      const clear = () => {
        if (pending === operation) pending = null;
      };
      // A timeout cannot cancel the current SQL adapter. Keep sharing that
      // operation until it settles instead of creating an unbounded query queue.
      void operation.then(clear, clear);
    }
    const operation = pending;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const rows = await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Sitemap CMS timeout")), timeoutMs);
        }),
      ]);
      return new Response(appendBlogSitemap(staticXml, rows, origin), {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, no-cache",
        },
      });
    } catch {
      if (!reported.has(operation)) {
        reported.add(operation);
        onFallback();
      }
      return new Response(staticXml, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}
