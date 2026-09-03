import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { MediaTile, PageHero } from "@/components/page-hero";
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
    }),
});

function RatgeberIndex() {
  const { extra } = Route.useLoaderData();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Ratgeber Fahrzeugpflege | White Gloss",
    url: `${site.origin}/ratgeber`,
    blogPost: [
      ...articles.map((a) => ({
        "@type": "BlogPosting",
        headline: a.title,
        datePublished: a.date,
        url: `${site.origin}/ratgeber/${a.slug}`,
      })),
      ...extra
        .filter((r) => r.slug)
        .map((r) => ({
          "@type": "BlogPosting",
          headline: r.title,
          datePublished: String(r.created_at).slice(0, 10),
          url: `${site.origin}/ratgeber/${r.slug}`,
        })),
    ],
  };

  return (
    <main id="main-content" tabIndex={-1}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageHero
        shot="keramik"
        alt="Keramikversiegelung von Hand auf dem Lack"
        kicker="Wissen aus der Werkstatt"
        title="Ratgeber Fahrzeugpflege."
        lead="Was bei Lack, Innenraum und Werterhalt wirklich zählt – aus der Werkstatt in Horb am Neckar, ohne große Versprechen."
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Ratgeber" },
        ]}
      />
      <section className="border-t border-line">
        <div className="gd-split gd-split--duo">
          {articles.map((a) => (
            <Link
              key={a.slug}
              to="/ratgeber/$slug"
              params={{ slug: a.slug }}
              className="block border-b border-line lg:odd:border-r"
            >
              <MediaTile src={a.image} alt="">
                <p className="kicker">
                  {new Date(a.date).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  · {a.minutes} Min.
                </p>
                <h2 className="heading-2 mt-3 max-w-md">{a.title}</h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">{a.excerpt}</p>
                <span className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-fg">
                  Lesen
                  <ArrowRight className="link-arrow size-4" aria-hidden />
                </span>
              </MediaTile>
            </Link>
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
                <Link
                  key={r.id}
                  to="/ratgeber/$slug"
                  params={{ slug: r.slug as string }}
                  className="block border-b border-line p-8 lg:odd:border-r"
                >
                  <p className="kicker">Aktuell</p>
                  <h2 className="heading-2 mt-3">{r.title}</h2>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{excerpt}</p>
                </Link>
              );
            })}
        </div>
      </section>
    </main>
  );
}
