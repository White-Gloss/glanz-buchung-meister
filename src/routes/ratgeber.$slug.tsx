import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { CalendarDays, Clock3, ListTree, User } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ConversionBand } from "@/components/ConversionBand";
import { FaqSection } from "@/components/FaqSection";
import { getPublishedBlogPost } from "@/lib/blog.functions";
import { imageAttributes, renderArticle } from "@/lib/blogContent";
import {
  blogPostUrl,
  buildBlogPostingJsonLd,
  effectiveMetaDescription,
  effectiveMetaTitle,
  effectiveOgImage,
} from "@/lib/blogSeo";
import { OG_IMAGE_ALT } from "@/lib/seo";
import { trackArticleView } from "@/lib/metaPixel";

/**
 * RATGEBER-ARTIKEL
 * -----------------
 * Enthält alles, was Google und die sozialen Netzwerke für eine
 * vollständige Darstellung brauchen:
 *
 *   - semantisches HTML (<article>, <header>, H1–H3, <time>)
 *   - Inhaltsverzeichnis mit Ankern (Grundlage für Sitelinks)
 *   - BlogPosting-, BreadcrumbList- und FAQPage-Auszeichnung
 *   - vollständige Open-Graph-Tags für Facebook/Instagram
 *   - Bilder mit festen Maßen und verzögertem Laden (CLS/LCP)
 *
 * Der Markdown-Text wird serverseitig im Loader zu HTML gerendert, damit
 * der fertige Inhalt bereits in der ersten Antwort steht — Crawler sehen
 * ihn ohne JavaScript.
 */

export const Route = createFileRoute("/ratgeber/$slug")({
  loader: async ({ params }) => {
    const post = await getPublishedBlogPost({ data: { slug: params.slug } });
    if (!post) throw notFound();

    const article = renderArticle(post.content);
    return {
      post,
      article,
      jsonLd: buildBlogPostingJsonLd(post, {
        faqs: post.faqs,
        plainText: article.plainText,
        wordCount: article.plainText ? article.plainText.split(" ").length : undefined,
      }),
    };
  },

  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Beitrag nicht gefunden" }, { name: "robots", content: "noindex" }],
      };
    }

    const { post, article, jsonLd } = loaderData;
    const canonical = blogPostUrl(post.slug);
    const title = effectiveMetaTitle(post);
    const description = effectiveMetaDescription(post, article.plainText);
    const image = effectiveOgImage(post);

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "author", content: post.author },

        // Open Graph: Grundlage der Vorschau in Facebook, Instagram und
        // WhatsApp. og:type="article" schaltet die Artikel-Darstellung frei.
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonical },
        { property: "og:image", content: image },
        { property: "og:image:alt", content: post.title || OG_IMAGE_ALT },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:site_name", content: "White Gloss Detailing" },
        { property: "og:locale", content: "de_DE" },
        ...(post.published_at
          ? [{ property: "article:published_time", content: post.published_at }]
          : []),
        { property: "article:modified_time", content: post.updated_at },
        { property: "article:author", content: post.author },
        { property: "article:section", content: "Fahrzeugpflege" },
        ...post.focus_keywords.map((keyword) => ({
          property: "article:tag",
          content: keyword,
        })),

        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
      links: [
        { rel: "canonical", href: canonical },
        { rel: "alternate", hrefLang: "de-DE", href: canonical },
      ],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
    };
  },

  component: BlogPostPage,
});

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function BlogPostPage() {
  const { post, article } = Route.useLoaderData();
  const heroImage = post.featured_image_url;
  const heroDimensions = heroImage ? imageAttributes(heroImage) : null;

  /**
   * ViewContent an Meta melden — einmal je aufgerufenem Beitrag. Die
   * Funktion prüft selbst, ob eine Einwilligung vorliegt; ohne
   * Zustimmung wird nichts geladen und nichts gesendet.
   */
  useEffect(() => {
    trackArticleView({ slug: post.slug, title: post.title });
  }, [post.slug, post.title]);

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="main-content">
        <article>
          <header className="relative overflow-hidden border-b border-border/60">
            <div className="grid-lines absolute inset-0 opacity-30" aria-hidden />
            <div className="relative mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
              <nav aria-label="Brotkrumen" className="text-xs text-muted-foreground">
                <Link to="/" className="hover:text-foreground">
                  Startseite
                </Link>
                <span className="px-2">/</span>
                <Link to="/ratgeber" className="hover:text-foreground">
                  Ratgeber
                </Link>
                <span className="px-2">/</span>
                <span className="text-foreground">{post.title}</span>
              </nav>

              <p className="eyebrow mt-7">Ratgeber</p>
              <h1 className="text-gradient display-page mt-3">{post.title}</h1>

              {post.excerpt && (
                <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
                  {post.excerpt}
                </p>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {post.published_at && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays aria-hidden className="size-3.5" />
                    <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <User aria-hidden className="size-3.5" />
                  {post.author}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 aria-hidden className="size-3.5" />
                  {article.readingMinutes} Min. Lesezeit
                </span>
              </div>
            </div>
          </header>

          {heroImage && heroDimensions && (
            <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
              <img
                src={heroImage}
                alt={post.title}
                width={heroDimensions.width}
                height={heroDimensions.height}
                /*
                 * Das Beitragsbild ist in der Regel das LCP-Element:
                 * sofort laden und hoch priorisieren statt verzögern.
                 */
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="h-auto w-full rounded-3xl border border-border/60 object-cover"
              />
            </div>
          )}

          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
            {article.headings.length > 1 && <TableOfContents headings={article.headings} />}

            {/*
             * Der HTML-Text stammt aus dem eigenen Markdown-Renderer
             * (src/lib/blogContent.ts). Dort wird jeder Eingabetext zuerst
             * vollständig escaped, erst danach entstehen Tags — es kann
             * also kein Markup aus der Datenbank durchschlagen.
             */}
            <div className="mt-10 text-base" dangerouslySetInnerHTML={{ __html: article.html }} />

            {post.focus_keywords.length > 0 && (
              <ul className="mt-12 flex flex-wrap gap-2" aria-label="Themen dieses Beitrags">
                {post.focus_keywords.map((keyword) => (
                  <li
                    key={keyword}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {post.faqs.length > 0 && (
            <section className="border-t border-border/60 bg-card/20">
              <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
                <p className="eyebrow">Antworten vorab</p>
                <h2 id="haeufige-fragen" className="display-section mt-3 scroll-mt-24 uppercase">
                  Häufige Fragen zu diesem Thema
                </h2>
                <div className="mt-8">
                  <FaqSection
                    faqs={post.faqs}
                    headingId="haeufige-fragen"
                    trackingSource={`ratgeber:${post.slug}`}
                  />
                </div>
              </div>
            </section>
          )}
        </article>

        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <Link
            to="/ratgeber"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            Alle Ratgeber-Beiträge
          </Link>
        </section>

        <ConversionBand
          eyebrow="Passend zum Thema"
          title="Zustand prüfen lassen und Termin sichern."
          text="Fahrzeugklasse und Umfang auswählen, Preisübersicht sehen und unverbindlich anfragen."
        />
      </main>
      <SiteFooter />
    </div>
  );
}

/**
 * Inhaltsverzeichnis aus den H2/H3-Überschriften des Beitrags.
 * Die Anker-Links sind für Google die Grundlage, einzelne Abschnitte als
 * Sitelinks direkt im Suchergebnis anzubieten.
 */
function TableOfContents({ headings }: { headings: { id: string; text: string; level: 2 | 3 }[] }) {
  return (
    <nav aria-labelledby="inhaltsverzeichnis" className="glass rounded-2xl p-5">
      <p
        id="inhaltsverzeichnis"
        className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground"
      >
        <ListTree aria-hidden className="size-3.5 text-primary" />
        Inhalt
      </p>
      <ol className="mt-3 space-y-1.5">
        {headings.map((heading) => (
          <li key={heading.id} className={heading.level === 3 ? "pl-4" : ""}>
            <a
              href={`#${heading.id}`}
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
