export type SitemapBlogRow = {
  slug: string | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
};

export type SitemapPageRow = {
  path: string;
  updated_at: string | Date | null;
};

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
    };
    return entities[character];
  });
}

function unescapeXml(value: string) {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (_, entity: string) => {
    const entities: Record<string, string> = {
      amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
    };
    return entities[entity];
  });
}

/** Keep the existing article slug and the URL semantics of its canonical. */
export function blogSitemapUrl(slug: string | null, origin: string): string | null {
  if (!slug || slug.length > 80 || slug !== slug.trim() || /^\.{1,2}$/.test(slug)) return null;
  // These values cannot use the detail page's unescaped canonical path safely.
  // eslint-disable-next-line no-control-regex
  if (/[/%?#\\\x00-\x1f\x7f]/.test(slug)) return null;
  try {
    // Reject lone surrogates rather than publishing a replacement-character URL.
    encodeURIComponent(slug);
    return new URL(`/ratgeber/${slug}`, origin).href;
  } catch {
    return null;
  }
}

function sitemapDate(value: string | Date | null): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

/** Rows must have the same publication filter and order as the article loader. */
export function appendBlogSitemap(
  staticXml: string,
  rows: readonly SitemapBlogRow[],
  origin: string,
): string {
  if (!/<urlset\b/.test(staticXml) || !/<\/urlset>\s*$/.test(staticXml)) {
    throw new Error("The static sitemap must contain a complete urlset.");
  }
  const knownUrls = new Set(
    [...staticXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => unescapeXml(match[1].trim())),
  );
  const added: string[] = [];
  for (const row of rows) {
    const url = blogSitemapUrl(row.slug, origin);
    if (!url || knownUrls.has(url)) continue;
    knownUrls.add(url);
    const lastmod = sitemapDate(row.updated_at) ?? sitemapDate(row.created_at);
    added.push(`  <url><loc>${escapeXml(url)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`);
  }
  if (added.length === 0) return staticXml;
  return staticXml.replace(/<\/urlset>\s*$/, `${added.join("\n")}\n</urlset>\n`);
}

/** About is the only new editorial route. Its URL follows the live publication
 * state even if it is accidentally added to the static inventory later. */
export function appendPublishedPageSitemap(
  staticXml: string,
  rows: readonly SitemapPageRow[],
  origin: string,
): string {
  const aboutUrl = new URL("/ueber-uns", origin).href;
  const base = staticXml.replace(/\s*<url>\s*[\s\S]*?<\/url>/g, (entry) => {
    const location = /<loc>([^<]+)<\/loc>/.exec(entry)?.[1];
    return location && unescapeXml(location.trim()) === aboutUrl ? "" : entry;
  });
  const about = rows.find((row) => row.path === "/ueber-uns");
  if (!about) return base;
  const lastmod = sitemapDate(about.updated_at);
  const entry = `  <url><loc>${escapeXml(aboutUrl)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
  return base.replace(/<\/urlset>\s*$/, `${entry}\n</urlset>\n`);
}

