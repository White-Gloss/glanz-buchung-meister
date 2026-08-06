import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { ConversionBand } from "@/components/ConversionBand";
import { FaqSection } from "@/components/FaqSection";
import { listPublishedFaqs, type FaqRow } from "@/lib/faqs.functions";
import { buildFaqPageWithBreadcrumbJsonLd, FAQ_PAGE_URL } from "@/lib/blogSeo";
import { OG_IMAGE, OG_IMAGE_ALT } from "@/lib/seo";
import { slugifyHeading } from "@/lib/blogContent";

/**
 * FAQ-SEITE
 * ----------
 * Alle im Admin-Panel gepflegten Fragen, nach Kategorie gruppiert. Jede
 * Kategorie bekommt eine eigene Sprungmarke, damit Google einzelne
 * Abschnitte als Sitelink anbieten kann.
 */

const META_TITLE = "Häufige Fragen zur Fahrzeugaufbereitung | White Gloss Detailing";
const META_DESCRIPTION =
  "Antworten zu Keramikversiegelung, Innenraumreinigung, Lackkorrektur, Kosten und Dauer der Fahrzeugaufbereitung in Horb am Neckar.";

export const Route = createFileRoute("/faq")({
  loader: async () => {
    let faqs: FaqRow[] = [];
    try {
      faqs = await listPublishedFaqs();
    } catch {
      // Die Seite bleibt auch ohne Datenbankverbindung erreichbar.
    }
    return { faqs, jsonLd: buildFaqPageWithBreadcrumbJsonLd(faqs) };
  },
  // FAQs ändern sich selten – eine Minute Cache spart Abfragen bei jeder Navigation.
  staleTime: 60_000,

  head: ({ loaderData }) => ({
    meta: [
      { title: META_TITLE },
      { name: "description", content: META_DESCRIPTION },
      { property: "og:title", content: META_TITLE },
      { property: "og:description", content: META_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: FAQ_PAGE_URL },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:alt", content: OG_IMAGE_ALT },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: META_TITLE },
      { name: "twitter:description", content: META_DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "canonical", href: FAQ_PAGE_URL },
      { rel: "alternate", hrefLang: "de-DE", href: FAQ_PAGE_URL },
    ],
    // Nur auszeichnen, wenn tatsächlich Fragen vorliegen — eine leere
    // FAQPage wertet Google als fehlerhaftes Rich Result.
    scripts: loaderData?.faqs.length
      ? [{ type: "application/ld+json", children: JSON.stringify(loaderData.jsonLd) }]
      : [],
  }),
  component: FaqPage,
});

/** Gruppiert die Fragen nach Kategorie und behält deren Sortierung bei. */
function groupByCategory(faqs: FaqRow[]): { category: string; id: string; items: FaqRow[] }[] {
  const groups = new Map<string, FaqRow[]>();
  for (const faq of faqs) {
    const key = faq.category || "Allgemein";
    const bucket = groups.get(key);
    if (bucket) bucket.push(faq);
    else groups.set(key, [faq]);
  }
  return [...groups.entries()].map(([category, items]) => ({
    category,
    id: slugifyHeading(category),
    items,
  }));
}

function FaqPage() {
  const { faqs } = Route.useLoaderData();
  const groups = groupByCategory(faqs);

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="main-content">
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="grid-lines absolute inset-0 opacity-30" aria-hidden />
          <div className="relative mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
            <nav aria-label="Brotkrumen" className="text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground">
                Startseite
              </Link>
              <span className="px-2">/</span>
              <span className="text-foreground">Häufige Fragen</span>
            </nav>

            <p className="eyebrow mt-7">Antworten vorab</p>
            <h1 className="text-gradient display-page mt-3">Häufige Fragen</h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Was eine Keramikversiegelung kostet, wie lange eine Aufbereitung dauert und worauf es
              bei der Innenraumreinigung ankommt — hier stehen die Antworten, die uns am häufigsten
              erreichen.
            </p>
          </div>
        </section>

        {faqs.length === 0 ? (
          <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <p className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Aktuell sind keine Fragen hinterlegt. Rufen Sie uns gern direkt an — wir beantworten
              alles persönlich.
            </p>
          </section>
        ) : (
          <>
            {/* Sprungmarken: Google bietet solche Anker als Sitelinks an. */}
            {groups.length > 1 && (
              <nav aria-label="Themen" className="mx-auto max-w-4xl px-4 pt-12 sm:px-6">
                <ul className="flex flex-wrap gap-2">
                  {groups.map((group) => (
                    <li key={group.id}>
                      <a
                        href={`#${group.id}`}
                        className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                      >
                        {group.category}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
              {groups.map((group) => (
                <section key={group.id} className="mt-12 first:mt-0">
                  <h2
                    id={group.id}
                    className="display-section scroll-mt-24 uppercase text-foreground"
                  >
                    {group.category}
                  </h2>
                  <div className="mt-6">
                    <FaqSection
                      faqs={group.items}
                      headingId={group.id}
                      trackingSource={`faq:${group.id}`}
                    />
                  </div>
                </section>
              ))}
            </div>
          </>
        )}

        <ConversionBand
          eyebrow="Noch offen?"
          title="Wir beraten Sie unverbindlich."
          text="Fahrzeugklasse und Wunschleistung auswählen, Preisübersicht sehen und Termin anfragen."
        />
      </main>
      <SiteFooter />
    </div>
  );
}
