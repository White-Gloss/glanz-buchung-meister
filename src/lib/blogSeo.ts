import { SITE_URL, absUrl, OG_IMAGE } from "./seo";
import type { FaqRow } from "./faqs.functions";
import type { BlogPostRow, BlogPostSummary } from "./blog.functions";
import { excerptFrom } from "./blogContent";

/**
 * STRUKTURIERTE DATEN FÜR RATGEBER UND FAQ
 * -----------------------------------------
 * Erzeugt das JSON-LD, das Google für Rich Results auswertet:
 *
 *   FAQPage        Aufklappbare Fragen direkt im Suchergebnis
 *   BlogPosting    Artikel-Darstellung mit Datum, Autor und Bild
 *   BreadcrumbList Pfadanzeige statt nackter URL im Treffer
 *
 * Alle URLs sind absolut — relative Angaben ignoriert Google hier.
 * Die Knoten verweisen über @id auf die bereits auf der Startseite
 * definierten Knoten (#business, #website), damit Google eine einzige
 * zusammenhängende Beschreibung des Unternehmens sieht.
 */

/** Kanonische URL eines Beitrags. */
export function blogPostUrl(slug: string): string {
  return absUrl(`/ratgeber/${slug}`);
}

export const BLOG_INDEX_URL = absUrl("/ratgeber");
export const FAQ_PAGE_URL = absUrl("/faq");

/** Meta-Titel mit Rückfall auf den Beitragstitel. */
export function effectiveMetaTitle(post: { title: string; meta_title: string }): string {
  return post.meta_title || `${post.title} | White Gloss Detailing`;
}

/**
 * Meta-Beschreibung mit doppeltem Rückfall: eigene Angabe, sonst
 * Kurzfassung, sonst automatisch aus dem Fließtext gekürzt. Ein leeres
 * description-Tag wäre schlechter als gar keines.
 */
export function effectiveMetaDescription(
  post: { meta_description: string; excerpt: string },
  plainText = "",
): string {
  return post.meta_description || post.excerpt || excerptFrom(plainText, 160);
}

/** Bild für Social-Vorschau: eigenes OG-Bild, sonst Beitragsbild, sonst Standard. */
export function effectiveOgImage(post: {
  og_image_url: string | null;
  featured_image_url: string | null;
}): string {
  return post.og_image_url || post.featured_image_url || OG_IMAGE;
}

/**
 * FAQPage-Knoten. Google verlangt für jede Frage genau eine Antwort im
 * Klartext — deshalb wird der Antworttext unverändert übernommen und
 * nicht etwa das gerenderte HTML.
 */
export function buildFaqPageJsonLd(faqs: FaqRow[], pageUrl: string) {
  return {
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    url: pageUrl,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

/** Brotkrumen-Pfad. `trail` enthält die Zwischenstufen ohne Startseite. */
function buildBreadcrumbJsonLd(trail: { name: string; url: string }[], pageUrl: string) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Startseite", item: SITE_URL },
      ...trail.map((entry, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name: entry.name,
        item: entry.url,
      })),
    ],
  };
}

/**
 * Vollständiges Schema für eine Artikelseite: BlogPosting, Brotkrumen und
 * — sofern dem Beitrag FAQs zugeordnet sind — zusätzlich FAQPage.
 */
export function buildBlogPostingJsonLd(
  post: BlogPostRow,
  options: { faqs: FaqRow[]; plainText: string; wordCount?: number },
) {
  const canonical = blogPostUrl(post.slug);
  const description = effectiveMetaDescription(post, options.plainText);
  const image = effectiveOgImage(post);

  const graph: Record<string, unknown>[] = [
    {
      "@type": "BlogPosting",
      "@id": `${canonical}#article`,
      headline: post.title,
      description,
      url: canonical,
      mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
      image: [image],
      // datePublished ist für die Artikel-Darstellung verpflichtend;
      // dateModified zeigt Google, dass der Inhalt gepflegt wird.
      datePublished: post.published_at ?? post.created_at,
      dateModified: post.updated_at,
      author: {
        "@type": "Organization",
        name: post.author || "White Gloss Detailing",
        url: SITE_URL,
      },
      publisher: { "@id": `${SITE_URL}/#business` },
      inLanguage: "de-DE",
      isPartOf: { "@id": `${BLOG_INDEX_URL}#blog` },
      ...(post.focus_keywords.length > 0 ? { keywords: post.focus_keywords.join(", ") } : {}),
      ...(options.wordCount ? { wordCount: options.wordCount } : {}),
    },
    buildBreadcrumbJsonLd(
      [
        { name: "Ratgeber", url: BLOG_INDEX_URL },
        { name: post.title, url: canonical },
      ],
      canonical,
    ),
  ];

  if (options.faqs.length > 0) {
    graph.push(buildFaqPageJsonLd(options.faqs, canonical));
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

/** Schema für die Ratgeber-Übersicht: Blog-Knoten plus Brotkrumen. */
export function buildBlogIndexJsonLd(posts: BlogPostSummary[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": `${BLOG_INDEX_URL}#blog`,
        url: BLOG_INDEX_URL,
        name: "Ratgeber Fahrzeugpflege | White Gloss Detailing",
        description:
          "Fachbeiträge zu Keramikversiegelung, Lackkorrektur, Innenraumreinigung und Werterhalt.",
        inLanguage: "de-DE",
        publisher: { "@id": `${SITE_URL}/#business` },
        blogPost: posts.slice(0, 20).map((post) => ({
          "@type": "BlogPosting",
          "@id": `${blogPostUrl(post.slug)}#article`,
          headline: post.title,
          url: blogPostUrl(post.slug),
          datePublished: post.published_at ?? post.created_at,
          dateModified: post.updated_at,
        })),
      },
      buildBreadcrumbJsonLd([{ name: "Ratgeber", url: BLOG_INDEX_URL }], BLOG_INDEX_URL),
    ],
  };
}

/** Schema für die FAQ-Seite. */
export function buildFaqPageWithBreadcrumbJsonLd(faqs: FaqRow[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildFaqPageJsonLd(faqs, FAQ_PAGE_URL),
      buildBreadcrumbJsonLd([{ name: "Häufige Fragen", url: FAQ_PAGE_URL }], FAQ_PAGE_URL),
    ],
  };
}
