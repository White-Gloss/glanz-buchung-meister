import { serializeJsonLd } from "@/lib/json-ld";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { IconArrowRight } from "@/components/icons";
import { ctaPrimary } from "@/components/ui";
import { articles, getArticle, type Article } from "@/data/ratgeber";
import { listPublishedCms } from "@/lib/cms.functions";
import { cmsPublishedDate } from "@/lib/cms-date";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";
import { articleBookingSelection, articleNavigation } from "@/lib/article-navigation";
import { services } from "@/data/site";

async function loadArticle(slug: string): Promise<Omit<Article, "date"> & { date?: string }> {
  const staticArticle = getArticle(slug);
  if (staticArticle) return staticArticle;
  const rows = await listPublishedCms({ data: { kind: "blog" } });
  const row = rows.find((r) => r.slug === slug);
  if (!row) throw notFound();
  let excerpt = row.body.slice(0, 160);
  try {
    excerpt = (JSON.parse(row.extra) as { note?: string }).note || excerpt;
  } catch {
    /* ignore */
  }
  return {
    slug: row.slug ?? slug,
    title: row.title,
    excerpt,
    date: cmsPublishedDate(row.created_at),
    image: "/media/hero.webp",
    minutes: 4,
    sections: [{ heading: row.title, paragraphs: [row.body] }],
  };
}

export const Route = createFileRoute("/ratgeber/$slug")({
  loader: async ({ params }) => loadArticle(params.slug),
  head: ({ loaderData }) =>
    pageHead({
      title:
        articleNavigation[loaderData?.slug ?? ""]?.title ??
        `${loaderData?.title ?? "Ratgeber"} | ${site.name}`,
      description: loaderData?.excerpt ?? "",
      path: `/ratgeber/${loaderData?.slug ?? ""}`,
      image: loaderData?.image,
    }),
  component: ArticlePage,
});

function ArticlePage() {
  const a = Route.useLoaderData();
  const guide = articleNavigation[a.slug];
  const request = articleBookingSelection(a.slug);
  const service = services.find((s) => s.slug === guide?.service);
  const others = guide
    ? guide.related.flatMap((slug) => articles.filter((x) => x.slug === slug))
    : articles.filter((x) => x.slug !== a.slug).slice(0, 3);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${site.origin}/ratgeber/${a.slug}#article`,
        mainEntityOfPage: `${site.origin}/ratgeber/${a.slug}`,
        inLanguage: "de-DE",
        headline: a.title,
        datePublished: a.date,
        author: {
          "@type": "Organization",
          "@id": `${site.origin}/#betrieb`,
          name: site.legalName,
          url: site.origin,
        },
        publisher: {
          "@type": "Organization",
          "@id": `${site.origin}/#betrieb`,
          name: site.legalName,
          url: site.origin,
        },
        image: `${site.origin}${a.image}`,
        description: a.excerpt,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Startseite", item: site.origin },
          { "@type": "ListItem", position: 2, name: "Ratgeber", item: `${site.origin}/ratgeber` },
          {
            "@type": "ListItem",
            position: 3,
            name: a.title,
            item: `${site.origin}/ratgeber/${a.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <main id="main-content" tabIndex={-1} data-ratgeber="article">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <PageHero
        src={a.image}
        alt={a.title}
        kicker="Ratgeber"
        title={a.title}
        lead={a.excerpt}
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Ratgeber", to: "/ratgeber" },
          { label: a.title },
        ]}
        actions={
          <Link
            to={request.leistung ? "/fahrzeug-zustand" : "/"}
            search={request}
            hash="buchung"
            className={ctaPrimary}
          >
            Termin anfragen
          </Link>
        }
      />
      <div className="ratgeber-reading-layout">
        <nav className="ratgeber-contents" aria-label="Inhaltsverzeichnis">
          <p className="ratgeber-meta">In diesem Beitrag</p>
          <ol>
            {a.sections.map((s, index) => (
              <li key={s.heading}>
                <a href={`#abschnitt-${index + 1}`}>
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <span>{s.heading}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="ratgeber-article-body">
          {guide ? <p className="ratgeber-question">{guide.question}</p> : null}
          <p className="ratgeber-price-note">
            Alle genannten Einstiegspreise gelten für die Kompaktklasse und verstehen sich{" "}
            {site.vatNote} Fahrzeuggröße und Zustand bestimmen den Aufwand; den verbindlichen Preis
            stimmen wir vor Beginn mit Ihnen ab.
          </p>
          {a.sections.map((s, index) => (
            <section
              key={s.heading}
              id={`abschnitt-${index + 1}`}
              className="ratgeber-article-section"
            >
              <h2 className="ratgeber-section-title">{s.heading}</h2>
              {s.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </section>
          ))}
          {service ? (
            <p className="ratgeber-service-note">
              Leistungsumfang und Grenzen finden Sie unter{" "}
              <Link
                to="/leistungen/$slug"
                params={{ slug: service.slug }}
                className="underline underline-offset-4"
              >
                {service.nav}
              </Link>
              .{" "}
              {request.paket || request.leistung
                ? "Die Anfrage übernimmt das zugehörige Paket oder Ihr Interesse an dieser individuellen Leistung."
                : "Wählen Sie in der Anfrage das passende Paket und Ihren Abholort aus."}
            </p>
          ) : null}
          <Link
            to={request.leistung ? "/fahrzeug-zustand" : "/"}
            search={request}
            hash="buchung"
            className={`${ctaPrimary} ratgeber-request`}
          >
            Termin anfragen
          </Link>
          <div className="ratgeber-related">
            <h2 className="ratgeber-section-title">Weitere Beiträge</h2>
            <ul>
              {others.map((o) => (
                <li key={o.slug}>
                  <Link
                    to="/ratgeber/$slug"
                    params={{ slug: o.slug }}
                    className="ratgeber-related-link"
                  >
                    <span>{o.title}</span>
                    <IconArrowRight className="size-5 shrink-0" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>
    </main>
  );
}
