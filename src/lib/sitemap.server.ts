import { appendBlogSitemap, appendPublishedPageSitemap, type SitemapBlogRow, type SitemapPageRow } from "./sitemap.ts";
import type { Sql } from "./db.ts";
import { isCmsSchemaUnavailable } from "./cms.store.ts";
import { cmsEnabled } from "./cms.availability.ts";
import { isIsolatedGithubCi } from "../../scripts/hosting-policy.mjs";

export async function loadPublishedSitemapBlogs(sql: Sql): Promise<SitemapBlogRow[]> {
  // Match listPublishedCms and the first matching row in /ratgeber/$slug.
  return sql<SitemapBlogRow>`
    select slug, created_at, updated_at
    from cms_items
    where shop_id = ${"white-gloss"} and kind = ${"blog"} and published = true
    order by sort asc, id desc
  `;
}

export async function loadPublishedSitemapPages(sql: Sql, config = {
  enabled: process.env.WEBSITE_STUDIO_ENABLED,
  isolatedCi: isIsolatedGithubCi(),
}): Promise<SitemapPageRow[]> {
  // Match the public document loader, including the production rollback switch.
  // Legacy blog discovery stays independent of this optional Studio feature.
  if (!cmsEnabled(config)) return [];
  try {
    return await sql<SitemapPageRow>`
      select '/ueber-uns' as path, r.created_at as updated_at
      from cms_items i
      join cms_revisions r on r.shop_id = i.shop_id and r.item_id = i.id and r.id = i.published_revision_id
      where i.shop_id = ${"white-gloss"} and i.studio_key = ${"about"}
        and i.published = true and i.archived_at is null
    `;
  } catch (error) {
    // An optional Studio migration must not remove existing article URLs.
    if (isCmsSchemaUnavailable(error)) return [];
    throw error;
  }
}

export function createSitemapResponder({
  staticXml,
  origin,
  loadPublished,
  loadPublishedPages = async () => [],
  timeoutMs = 2_000,
  onFallback = () => undefined,
}: {
  staticXml: string;
  origin: string;
  loadPublished: () => Promise<SitemapBlogRow[]>;
  loadPublishedPages?: () => Promise<SitemapPageRow[]>;
  timeoutMs?: number;
  onFallback?: () => void;
}) {
  const fallbackXml = appendPublishedPageSitemap(staticXml, [], origin);
  type Entries = { blogs: SitemapBlogRow[]; pages: SitemapPageRow[] };
  let pending: Promise<Entries> | null = null;
  const reported = new WeakSet<Promise<Entries>>();

  return async function sitemapResponse(): Promise<Response> {
    if (!pending) {
      const operation = Promise.resolve().then(async () => {
        const [blogs, pages] = await Promise.all([loadPublished(), loadPublishedPages()]);
        return { blogs, pages };
      });
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
      const xml = appendPublishedPageSitemap(appendBlogSitemap(fallbackXml, rows.blogs, origin), rows.pages, origin);
      return new Response(xml, {
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
      return new Response(fallbackXml, {
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

