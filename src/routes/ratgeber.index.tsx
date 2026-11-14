import { serializeJsonLd } from "@/lib/json-ld";
import { createFileRoute, Link } from "@tanstack/react-router";
import { IconArrowRight } from "@/components/icons";
import { MediaTile, PageHero } from "@/components/page-hero";
import { ctaPrimary } from "@/components/ui";
import { articles } from "@/data/ratgeber";
import { listPublishedCms } from "@/lib/cms.functions";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/ratgeber/")({
  loader: async () => {
    try {
      return { extra: await listPublishedCms({ data: { kind: "blog" } }) };
    } catch {
      return { extra: [] as Awaited<ReturnType<typeof listPublishedCms>> };
    }
  },
  component: RatgeberIndex,
  head: () =>
    pageHead({
      title: `Ratgeber Fahrzeugpflege & Detailing | ${site.name}`,
      description:
        "Fachbeiträge zu Keramikversiegelung, Lackkorrektur, Innenraumreinigung und Hol- und Bringservice – aus der Werkstatt in Horb am Neckar.",
      path: "/ratgeber",
      preloadShot: "keramik",
    }),
});

function RatgeberIndex() {
  const { extra } = Route.useLoaderData();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        name: "Ratgeber Fahrzeugpflege | White Gloss",
        url: `${site.origin}/ratgeber`,
        blogPost: [
          ...articles.map((article) => ({ "@id": `${site.origin}/ratgeber/${article.slug}#article` })),
          ...extra
            .filter((row) => row.slug)
            .map((row) => ({ "@id": `${site.origin}/ratgeber/${row.slug}#article` })),
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Startseite", item: site.origin },
          { "@type": "ListItem", position: 2, name: "Ratgeber", item: `${site.origin}/ratgeber` },
        ],
      },
    ],
  };

  return (
    <main id="main-content" tabIndex={-1} data-ratgeber="index">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <PageHero
        shot="keramik"
        alt="Keramikversiegelung von Hand auf dem Lack"
        kicker="Wissen aus der Werkstatt"
        title="Ratgeber Fahrzeugpflege."
        lead="Tipps und Erläuterungen zu Reinigung, Lackpflege und Versiegelung."
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Ratgeber" },
        ]}
        actions={
          <Link to="/" hash="buchung" className={ctaPrimary}>
            Termin anfragen
          </Link>
        }
      />
      <section className="ratgeber-list">
        <div className="ratgeber-grid">
          {articles.map((a) => (
            <article key={a.slug} className="ratgeber-card group relative">
              <MediaTile
                src={a.image}
                alt={`Titelbild: ${a.title}`}
                className="ratgeber-card-media"
              >
                <p className="ratgeber-meta">
                  {new Date(a.date).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  · {a.minutes} Min.
                </p>
                <h2 className="ratgeber-card-title">
                  <Link
                    to="/ratgeber/$slug"
                    params={{ slug: a.slug }}
                    className="ratgeber-card-link after:absolute after:inset-0"
                  >
                    {a.title}
                  </Link>
                </h2>
                <p className="ratgeber-card-excerpt">{a.excerpt}</p>
                <span className="ratgeber-read" aria-hidden="true">
                  Lesen
                  <IconArrowRight className="link-arrow size-4" />
                </span>
              </MediaTile>
            </article>
          ))}
          {extra
            .filter((r) => r.slug)
            .map((r) => {
              let excerpt = r.body.slice(0, 160);
              try {
                excerpt = (JSON.parse(r.extra) as { note?: string }).note || excerpt;
              } catch {
                /* ignore */
              }
              return (
                <article key={r.id} className="ratgeber-card ratgeber-card--text group relative">
                  <p className="ratgeber-meta">Aktuell</p>
                  <h2 className="ratgeber-card-title">
                    <Link
                      to="/ratgeber/$slug"
                      params={{ slug: r.slug as string }}
                      className="ratgeber-card-link after:absolute after:inset-0"
                    >
                      {r.title}
                    </Link>
                  </h2>
                  <p className="ratgeber-card-excerpt">{excerpt}</p>
                  <span className="ratgeber-read" aria-hidden="true">
                    Lesen
                    <IconArrowRight className="link-arrow size-4" />
                  </span>
                </article>
              );
            })}
        </div>
      </section>
    </main>
  );
}
