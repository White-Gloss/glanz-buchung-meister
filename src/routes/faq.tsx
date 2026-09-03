import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { ctaGhost, ctaPrimary } from "@/components/ui";
import { faqs, site } from "@/data/site";
import { listPublishedCms } from "@/lib/cms.functions";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/faq")({
  loader: async () => {
    try {
      return { extra: await listPublishedCms({ data: { kind: "faq" } }) };
    } catch {
      return { extra: [] as Awaited<ReturnType<typeof listPublishedCms>> };
    }
  },
  component: FaqPage,
  head: () =>
    pageHead({
      title: `Häufige Fragen zur Fahrzeugaufbereitung | ${site.name}`,
      description:
        "Antworten zu Keramikversiegelung, Innenraumreinigung, Lackkorrektur, Kosten und Dauer der Fahrzeugaufbereitung in Horb am Neckar.",
      path: "/faq",
      preloadShot: "atelier",
    }),
});

function FaqPage() {
  const { extra } = Route.useLoaderData();
  const extraFaqs = extra.map((row) => {
    let group = "Aktuell";
    try {
      group = (JSON.parse(row.extra) as { note?: string }).note || group;
    } catch {
      /* ignore */
    }
    return { group, q: row.title, a: row.body };
  });
  const all = [...faqs, ...extraFaqs];
  const groups = [...new Set(all.map((f) => f.group))];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: all.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main id="main-content" tabIndex={-1}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageHero
        shot="atelier"
        alt="Werkstatt von White Gloss in Horb am Neckar"
        kicker="Antworten vorab"
        title="Häufige Fragen."
        lead="Kosten, Dauer, Keramik, Innenraum – kurz beantwortet."
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Häufige Fragen" },
        ]}
        actions={
          <>
            <Link to="/" hash="buchung" className={ctaPrimary}>
              Termin anfragen
            </Link>
            <a href={site.phoneHref} className={ctaGhost}>
              {site.phoneDisplay}
            </a>
          </>
        }
      />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        {groups.map((g) => (
          <section key={g} className="mt-4 first:mt-0">
            <h2 className="kicker">{g}</h2>
            <div className="mt-5 divide-y divide-line border-y border-line">
              {all
                .filter((f) => f.group === g)
                .map((f) => (
                  <details key={f.q} className="group py-5">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 text-left font-display text-xl tracking-tight">
                      {f.q}
                      <span
                        className="shrink-0 text-subtle transition-transform duration-200 group-open:rotate-45"
                        aria-hidden
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
                      {f.a}
                    </p>
                  </details>
                ))}
            </div>
          </section>
        ))}
        <p className="mt-12 text-sm text-muted">
          Ihre Frage war nicht dabei? Persönlich:{" "}
          <a href={site.phoneHref} className="underline hover:text-fg">
            {site.phoneDisplay}
          </a>
          .
        </p>
      </div>
    </main>
  );
}
