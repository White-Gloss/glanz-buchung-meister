import { createFileRoute } from "@tanstack/react-router";
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
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-16 sm:px-6" tabIndex={-1}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Antworten vorab</p>
      <h1 className="mt-3 font-display text-5xl">Häufige Fragen</h1>
      <p className="mt-4 text-muted">
        Was eine Keramikversiegelung in Horb kostet, wie lange eine Aufbereitung
        dauert und was bei der Innenraumreinigung wirklich passiert – die
        Antworten, die uns am häufigsten gestellt werden.
      </p>
      {groups.map((g) => (
        <section key={g} className="mt-12">
          <h2 className="font-display text-2xl">{g}</h2>
          <div className="mt-4 divide-y divide-line border-y border-line">
            {all
              .filter((f) => f.group === g)
              .map((f) => (
                <details key={f.q} className="py-4">
                  <summary className="flex min-h-11 cursor-pointer items-center text-left font-medium">
                    {f.q}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
          </div>
        </section>
      ))}
      <p className="mt-10 text-sm text-muted">
        Ihre Frage war nicht dabei? Persönlich:{" "}
        <a href={site.phoneHref} className="underline hover:text-fg">
          {site.phoneDisplay}
        </a>
        .
      </p>
    </main>
  );
}
