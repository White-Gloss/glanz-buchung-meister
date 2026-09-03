import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { ctaPrimary } from "@/components/ui";
import { articles, getArticle, type Article } from "@/data/ratgeber";
import { listPublishedCms } from "@/lib/cms.functions";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";

async function loadArticle(slug: string): Promise<Article> {
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
    date: String(row.created_at).slice(0, 10),
    image: "/media/hero.webp",
    minutes: 4,
    sections: [{ heading: row.title, paragraphs: [row.body] }],
  };
}

export const Route = createFileRoute("/ratgeber/$slug")({
  loader: async ({ params }) => loadArticle(params.slug),
  head: ({ loaderData }) =>
    pageHead({
      title: `${loaderData?.title ?? "Ratgeber"} | ${site.name}`,
      description: loaderData?.excerpt ?? "",
      path: `/ratgeber/${loaderData?.slug ?? ""}`,
    }),
  component: ArticlePage,
});

function ArticlePage() {
  const a = Route.useLoaderData();
  const others = articles.filter((x) => x.slug !== a.slug).slice(0, 3);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    datePublished: a.date,
    author: { "@type": "Organization", name: site.legalName },
    publisher: { "@type": "Organization", name: site.legalName },
    image: `${site.origin}${a.image}`,
    description: a.excerpt,
  };

  return (
    <main id="main-content">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
          <Link to="/" hash="buchung" className={ctaPrimary}>
            Termin anfragen
          </Link>
        }
      />
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        {a.sections.map((s) => (
          <section key={s.heading} className="mt-10">
            <h2 className="font-display text-2xl">{s.heading}</h2>
            {s.paragraphs.map((p) => (
              <p key={p} className="mt-3 leading-relaxed text-muted">
                {p}
              </p>
            ))}
          </section>
        ))}
        <Link
          to="/"
          hash="buchung"
          className="mt-12 inline-flex min-h-11 items-center rounded-sm bg-accent px-5 text-sm font-medium text-accent-fg"
        >
          Termin anfragen
        </Link>
        <h2 className="mt-16 font-display text-2xl">Weitere Beiträge</h2>
        <ul className="mt-4 space-y-2">
          {others.map((o) => (
            <li key={o.slug}>
              <Link
                to="/ratgeber/$slug"
                params={{ slug: o.slug }}
                className="text-sm text-muted hover:text-fg"
              >
                {o.title}
              </Link>
            </li>
          ))}
        </ul>
      </article>
    </main>
  );
}
