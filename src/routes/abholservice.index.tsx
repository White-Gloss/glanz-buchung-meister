import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { ctaPrimary } from "@/components/ui";
import { cities, pickupPriceText, site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/abholservice/")({
  component: AbholIndex,
  head: () =>
    pageHead({
      title: `Hol- & Bringservice 13 Städte | ${site.name}`,
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
        kicker="13 Städte"
        title="Hol- und Bringservice."
        lead="Wir holen das Auto ab und bringen es wieder. Die Arbeit bleibt in Horb."
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Hol- und Bringservice" },
        ]}
        actions={
          <Link to="/" hash="buchung" className={ctaPrimary}>
            Termin anfragen
          </Link>
        }
      />
      <section className="section mx-auto max-w-7xl px-4 sm:px-6">
        <ul className="divide-y divide-line border-y border-line">
          {cities.map((c) => (
            <li key={c.slug}>
              <Link
                to="/abholservice/$city"
                params={{ city: c.slug }}
                aria-label={`${c.name}, ca. ${c.km} Kilometer, ca. ${c.minutes} Minuten, Abholung ${pickupPriceText(c.km)}`}
                className="flex min-h-16 items-center justify-between gap-4 py-4"
              >
                <span>
                  <span className="block font-display text-2xl tracking-tight">{c.name}</span>
                  <span className="mt-1 block text-sm text-muted">
                    ca. {c.km} km · ca. {c.minutes} Min.
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
