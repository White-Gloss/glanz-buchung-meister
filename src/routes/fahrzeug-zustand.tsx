import { createFileRoute, Link } from "@tanstack/react-router";
import { PhotoInquiry } from "@/components/photo-inquiry";
import { PageHero } from "@/components/page-hero";
import { ctaPrimary } from "@/components/ui";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/fahrzeug-zustand")({
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
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="atelier"
        alt="Werkstatt von White Gloss in Horb am Neckar"
        kicker="Ersteinschätzung"
        title="Zustand prüfen lassen."
        lead="Fotos reichen. Wir sagen, was sinnvoll ist – kostenlos und unverbindlich."
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Zustand prüfen" },
        ]}
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
        <div className="mt-12">
          <PhotoInquiry
            title="Zustandsfotos senden"
            hint="Mindestens eine Aufnahme oder eine kurze Beschreibung. Dateien bleiben auf Ihrem Gerät. Es werden nur Dateinamen zur Zuordnung übertragen, nicht die Fotos selbst."
          />
        </div>
      </div>
    </main>
  );
}
