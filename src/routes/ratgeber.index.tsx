import { createFileRoute, Link } from "@tanstack/react-router";
import { FluidImg } from "@/components/media";
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
    <main id="main-content">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-xs uppercase tracking-[0.16em] text-subtle">Wissen aus der Werkstatt</p>
        <h1 className="mt-3 font-display text-5xl">Ratgeber Fahrzeugpflege</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Was bei Lack, Innenraum und Werterhalt wirklich zählt – aus der
          Werkstatt in Horb am Neckar, ohne große Versprechen.
        </p>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <li key={a.slug} className="overflow-hidden rounded-lg border border-line bg-surface">
              <FluidImg
                src={a.image}
                alt=""
                className="aspect-video w-full object-cover"
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              />
              <div className="p-5">
                <p className="text-xs text-subtle">
                  {new Date(a.date).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  · {a.minutes} Min.
                </p>
                <h2 className="mt-2 font-display text-2xl">
                  <Link
                    to="/ratgeber/$slug"
                    params={{ slug: a.slug }}
                    className="hover:text-muted"
                  >
                    {a.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{a.excerpt}</p>
              </div>
            </li>
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
                <li key={r.id} className="overflow-hidden rounded-lg border border-line bg-surface">
                  <div className="p-5">
                    <p className="text-xs text-subtle">Aktuell</p>
                    <h2 className="mt-2 font-display text-2xl">
                      <Link
                        to="/ratgeber/$slug"
                        params={{ slug: r.slug as string }}
                        className="hover:text-muted"
                      >
                        {r.title}
                      </Link>
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{excerpt}</p>
                  </div>
                </li>
              );
            })}
        </ul>
      </section>
    </main>
  );
}
