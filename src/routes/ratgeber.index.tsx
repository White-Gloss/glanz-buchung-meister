import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ConversionBand } from "@/components/ConversionBand";
import { listPublishedBlogPosts, type BlogPostSummary } from "@/lib/blog.functions";
import { buildBlogIndexJsonLd, BLOG_INDEX_URL } from "@/lib/blogSeo";
import { imageAttributes } from "@/lib/blogContent";
import { OG_IMAGE, OG_IMAGE_ALT } from "@/lib/seo";

/**
 * RATGEBER-ÜBERSICHT
 * -------------------
 * Listet alle veröffentlichten Beiträge, neueste zuerst. Vorschaubilder
 * werden verzögert geladen und tragen feste Maße — beides zusammen hält
 * Ladezeit (LCP) und Layoutstabilität (CLS) im grünen Bereich.
 */

const META_TITLE = "Ratgeber Fahrzeugpflege & Detailing | White Gloss";
const META_DESCRIPTION =
  "Fachbeiträge rund um Keramikversiegelung, Lackkorrektur, Innenraumreinigung und Werterhalt — verständlich erklärt von White Gloss Detailing.";

export const Route = createFileRoute("/ratgeber/")({
  loader: async () => {
    let posts: BlogPostSummary[] = [];
    try {
      posts = await listPublishedBlogPosts();
    } catch {
      // Die Seite bleibt auch ohne Datenbankverbindung erreichbar.
    }
    return { posts, jsonLd: buildBlogIndexJsonLd(posts) };
  },
  staleTime: 60_000,

  head: ({ loaderData }) => ({
    meta: [
      { title: META_TITLE },
      { name: "description", content: META_DESCRIPTION },
      { property: "og:title", content: META_TITLE },
      { property: "og:description", content: META_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: BLOG_INDEX_URL },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:alt", content: OG_IMAGE_ALT },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: META_TITLE },
      { name: "twitter:description", content: META_DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "canonical", href: BLOG_INDEX_URL },
      { rel: "alternate", hrefLang: "de-DE", href: BLOG_INDEX_URL },
    ],
    scripts: loaderData?.posts.length
      ? [{ type: "application/ld+json", children: JSON.stringify(loaderData.jsonLd) }]
      : [],
  }),
  component: BlogIndexPage,
});

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function BlogIndexPage() {
  const { posts } = Route.useLoaderData();

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="main-content">
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="grid-lines absolute inset-0 opacity-30" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
            <nav aria-label="Brotkrumen" className="text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground">
                Startseite
              </Link>
              <span className="px-2">/</span>
              <span className="text-foreground">Ratgeber</span>
            </nav>

            <p className="eyebrow mt-7">Wissen aus der Werkstatt</p>
            <h1 className="text-gradient display-page mt-3 max-w-4xl">Ratgeber Fahrzeugpflege</h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Was wirklich zählt bei Lack, Innenraum und Werterhalt — ohne Marketingversprechen,
              dafür aus der täglichen Arbeit am Fahrzeug.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          {posts.length === 0 ? (
            <p className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Aktuell sind keine Beiträge veröffentlicht. Schauen Sie bald wieder vorbei.
            </p>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <li key={post.id}>
                  <BlogPostCard post={post} isAboveTheFold={index < 3} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <ConversionBand
          eyebrow="Konkrete Frage?"
          title="Wir schauen uns Ihr Fahrzeug an."
          text="Zustand schildern, Einschätzung erhalten und unverbindlich einen Termin anfragen."
        />
      </main>
      <SiteFooter />
    </div>
  );
}

function BlogPostCard({
  post,
  isAboveTheFold,
}: {
  post: BlogPostSummary;
  isAboveTheFold: boolean;
}) {
  const image = post.featured_image_url;
  const dimensions = image ? imageAttributes(image) : null;

  return (
    <article className="glass flex h-full flex-col overflow-hidden rounded-2xl transition-colors hover:border-primary/40">
      {image && dimensions && (
        <div className="aspect-video bg-secondary/30">
          <img
            src={image}
            alt=""
            width={dimensions.width}
            height={dimensions.height}
            /*
             * Die ersten Karten stehen beim Aufruf sichtbar im Bild und
             * werden sofort geladen — verzögertes Laden würde hier den
             * LCP-Wert verschlechtern statt ihn zu verbessern.
             */
            loading={isAboveTheFold ? "eager" : "lazy"}
            fetchPriority={isAboveTheFold ? "high" : "auto"}
            decoding="async"
            className="size-full object-cover"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        {post.published_at && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays aria-hidden className="size-3.5" />
            <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
          </p>
        )}

        <h2 className="display-card mt-2 uppercase text-foreground">
          <Link
            to="/ratgeber/$slug"
            params={{ slug: post.slug }}
            className="transition-colors hover:text-primary"
          >
            {post.title}
          </Link>
        </h2>

        {post.excerpt && (
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
            {post.excerpt}
          </p>
        )}

        <Link
          to="/ratgeber/$slug"
          params={{ slug: post.slug }}
          className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm text-primary transition-colors hover:text-primary/80"
        >
          Beitrag lesen
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}
