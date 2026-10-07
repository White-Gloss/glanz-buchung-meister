import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { ctaPrimary } from "@/components/ui";
import { cities, pickupPriceText, pickupTierSummary, pickupKeramikNote, site } from "@/data/site";
import { pageHead } from "@/lib/seo";
import { cityJourneyText, citySeoCopy } from "@/lib/city-copy";

export const Route = createFileRoute("/abholservice/")({
  component: AbholIndex,
  head: () =>
    pageHead({
      title: `Hol- & Bringservice: ${cities.length} Abholorte | ${site.name}`,
      description:
        "Abholung und Rückgabe in Horb, Tübingen, Nagold, Freudenstadt, Böblingen, Sindelfingen und weiteren Städten. Ausführung in Horb am Neckar.",
      path: "/abholservice",
      preloadShot: "atelier",
    }),
});

function AbholIndex() {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="atelier"
        alt={`Werkstatt von White Gloss in ${site.city}`}
        kicker={`${cities.length} Abholorte`}
        title="Hol- und Bringservice."
        lead="Sparen Sie sich die Fahrt zur Werkstatt: Wir stimmen Abholung und Rückgabe mit Ihnen ab und bereiten Ihr Fahrzeug in Horb am Neckar auf."
        crumbs={[{ label: "Startseite", to: "/" }, { label: "Hol- und Bringservice" }]}
        actions={
          <Link to="/" hash="buchung" className={ctaPrimary}>
            Termin anfragen
          </Link>
        }
      />
      <section className="section mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="heading-2">Abholorte und Kosten</h2>
        <p className="mt-5 mb-8 max-w-2xl text-muted">
          {pickupTierSummary()}. Alle Beträge {site.vatNote} {pickupKeramikNote()}. Entfernungen und
          Fahrzeiten sind Richtwerte ab Horb. Den genauen Abholort, Preis und die Übergabezeiten
          bestätigen wir persönlich.
        </p>
        <ul className="divide-y divide-line border-y border-line">
          {cities.map((c) => (
            <li key={c.slug}>
              <Link
                to="/abholservice/$city"
                params={{ city: c.slug }}
                aria-label={`${citySeoCopy(c).linkLabel}, ${cityJourneyText(c)}, Abholung ${pickupPriceText(c.km)}`}
                className="flex min-h-16 flex-col items-start gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span>
                  <span className="block font-display text-2xl tracking-tight">
                    {citySeoCopy(c).linkLabel}
                  </span>
                  <span className="mt-1 block text-sm text-muted">
                    {cityJourneyText(c)}
                  </span>
                </span>
                <span className="text-sm text-muted">{pickupPriceText(c.km)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
