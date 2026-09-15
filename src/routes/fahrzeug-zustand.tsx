import { createFileRoute, Link } from "@tanstack/react-router";
import { PhotoInquiry } from "@/components/photo-inquiry";
import { PageHero } from "@/components/page-hero";
import { ctaPrimary } from "@/components/ui";
import { parseBookingSelection } from "@/lib/booking-selection";
import { cities, services, site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/fahrzeug-zustand")({
  validateSearch: parseBookingSelection,
  component: ZustandPage,
  head: () =>
    pageHead({
      title: `Fahrzeugzustand prüfen lassen | ${site.name}`,
      description:
        "Fotos senden und ehrlich erfahren, welche Aufbereitung sinnvoll ist. Kostenlos und unverbindlich. Horb am Neckar.",
      path: "/fahrzeug-zustand",
      preloadShot: "atelier",
    }),
});

function ZustandPage() {
  const { leistung, ort } = Route.useSearch();
  const service = services.find((s) => s.slug === leistung);
  const city = cities.find((c) => c.slug === ort);
  const context = [service?.nav, city ? `Abholung aus ${city.name}` : undefined]
    .filter(Boolean)
    .join(" · ");
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="atelier"
        alt="Werkstatt von White Gloss in Horb am Neckar"
        kicker="Ersteinschätzung"
        title="Zustand prüfen lassen."
        lead="Wir geben Ihnen eine kostenlose, unverbindliche Ersteinschätzung. Benötigte Fotos stimmen wir mit Ihnen ab."
        crumbs={[{ label: "Startseite", to: "/" }, { label: "Zustand prüfen" }]}
        actions={
          <Link to="/" hash="buchung" className={ctaPrimary}>
            Termin anfragen
          </Link>
        }
      />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
          <li>Das ganze Fahrzeug von schräg vorn und schräg hinten</li>
          <li>Nahaufnahmen von Kratzern, matten Stellen oder Flecken</li>
          <li>Innenraum: Sitze, Fußräume, Armaturenbrett</li>
          <li>Am besten bei Tageslicht</li>
        </ul>
        <div id="buchung" className="mt-12">
          <PhotoInquiry
            title={context ? `${context} anfragen` : "Ersteinschätzung anfragen"}
            hint="Beschreiben Sie den Zustand Ihres Fahrzeugs oder wählen Sie Aufnahmen zur späteren Zuordnung aus."
          />
        </div>
      </div>
    </main>
  );
}
