import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { ctaGhost, ctaPrimary } from "@/components/ui";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/b2b")({
  component: B2bPage,
  head: () =>
    pageHead({
      title: `B2B Fahrzeugaufbereitung Flotten | ${site.name}`,
      description:
        "Leasingrückläufer, Fuhrpark, Autohäuser: individuelle Kalkulation statt Pauschalpreis. White Gloss in Horb am Neckar.",
      path: "/b2b",
      preloadShot: "atelier",
    }),
});

function B2bPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="atelier"
        alt="Werkstatt mit LED-Licht"
        kicker="Geschäftskunden"
        title="Firmenkunden, Flotten, Autohäuser."
        lead="Gepflegte Autos gehören zum Auftritt eines Betriebs. Für Unternehmen, Autohäuser und Fuhrparks rechnen wir deshalb am tatsächlichen Umfang, nicht an einer Pauschale."
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "B2B" },
        ]}
        actions={
          <>
            <a href={site.phoneHref} className={ctaPrimary}>
              {site.phoneDisplay}
            </a>
            <a href={site.whatsapp} className={ctaGhost} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </>
        }
      />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-lg text-muted">
        Wie viele Fahrzeuge, in welchem Zustand, in welchem Rhythmus und mit
        welcher Logistik – das bestimmt den Preis. Am schnellsten klären wir das
        am Telefon oder per WhatsApp.
      </p>
      <div className="mt-10 grid gap-4">
        {[
          ["Leasingrückläufer", "Vor der Rückgabe holen wir die Stellen, die Gutachter sehen, im Umfang, über den wir uns einig sind."],
          ["Flotten- & Fuhrparkreinigung", "Einmal oder in einem Rhythmus, der zu Ihrem Betrieb passt."],
          ["Autohäuser & Fahrzeughandel", "Aufbereitung für Verkauf, Standfläche und Auslieferung."],
          ["Firmen- & Poolfahrzeuge", "Innen und außen so, dass die Autos im Alltag wieder anständig aussehen."],
        ].map(([t, d]) => (
          <section key={t} className="border border-line bg-surface p-6">
            <h2 className="font-display text-2xl tracking-tight">{t}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
          </section>
        ))}
      </div>
      </div>
    </main>
  );
}
