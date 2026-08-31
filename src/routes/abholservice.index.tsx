import { createFileRoute, Link } from "@tanstack/react-router";
import { PickupNote } from "@/components/configurator";
import { cities, pickupTierSummary, site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/abholservice/")({
  component: AbholIndex,
  head: () =>
    pageHead({
      title: `Hol- & Bringservice 13 Städte | ${site.name}`,
      description:
        "Abholung und Rückgabe in Horb, Tübingen, Nagold, Freudenstadt, Böblingen, Sindelfingen und weiteren Städten. Ausführung in Horb am Neckar.",
      path: "/abholservice",
    }),
});

function AbholIndex() {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-5xl">Hol- & Bringservice</h1>
      <p className="mt-4 max-w-2xl text-muted">
        Wir holen Ihr Auto ab und bringen es wieder. Die Arbeit selbst läuft
        immer in der Werkstatt in {site.city} – {pickupTierSummary()}. Im Paket
        Keramik ist die Abholung bis 60 km enthalten.
      </p>
      <ul className="mt-10 divide-y divide-line border-y border-line">
        {cities.map((c) => (
          <li key={c.slug}>
            <Link
              to="/abholservice/$city"
              params={{ city: c.slug }}
              className="flex min-h-14 items-center justify-between gap-4 py-3"
            >
              <span>
                <span className="block font-medium">{c.name}</span>
                <span className="text-sm text-muted">
                  ca. {c.km} km · ca. {c.minutes} Min.
                </span>
              </span>
              <span className="text-sm text-muted">
                <PickupNote km={c.km} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
