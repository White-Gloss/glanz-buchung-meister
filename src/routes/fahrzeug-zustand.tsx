import { createFileRoute, Link } from "@tanstack/react-router";
import { PhotoInquiry } from "@/components/photo-inquiry";
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
    }),
});

function ZustandPage() {
  return (
    <main id="main-content" className="page-doc mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <nav aria-label="Brotkrumen" className="text-xs text-subtle">
        <Link to="/" className="hover:text-fg">
          Startseite
        </Link>
        <span className="px-2">/</span>
        <span>Zustand prüfen</span>
      </nav>
      <h1 className="mt-6 font-display text-5xl">Zustand prüfen lassen</h1>
      <p className="mt-4 text-muted leading-relaxed">
        Schicken Sie Fotos und eine kurze Beschreibung. Wir sagen Ihnen ehrlich,
        was sinnvoll ist — kostenlos und unverbindlich. Keine Fachbegriffe nötig.
      </p>
      <ul className="mt-8 list-disc space-y-2 pl-5 text-sm text-muted">
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
    </main>
  );
}
