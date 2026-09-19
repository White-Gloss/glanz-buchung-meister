import { createFileRoute, Link } from "@tanstack/react-router";
import { CustomerPhotoGallery } from "@/components/customer-photo-gallery";
import { PageHero } from "@/components/page-hero";
import { ctaPrimary } from "@/components/ui";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";
import { CustomerVideoGallery } from "@/components/customer-video-gallery";
import { customerVideos } from "@/components/results-teaser";

export const Route = createFileRoute("/galerie")({
  component: GaleriePage,
  head: () =>
    pageHead({
      title: `Echte Ergebnisse | ${site.name}`,
      description:
        "Einblicke in die Werkstatt von White Gloss in Horb am Neckar: Politur, Lackfinish, Innenraum- und Felgenpflege an einem freigegebenen Kundenfahrzeug.",
      path: "/galerie",
      preloadShot: "lack",
    }),
});

function GaleriePage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="lack"
        alt="Frontpartie und Felge eines echten Kundenfahrzeugs nach der Aufbereitung"
        kicker="Echte Kundenbeispiele"
        title="Echte Ergebnisse."
        lead="Einblicke in Lackfinish, Innenraum- und Felgenpflege an einem freigegebenen Kundenfahrzeug. Das Kennzeichen ist in den veröffentlichten Motiven nicht sichtbar."
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Ergebnisse" },
        ]}
        actions={
          <Link to="/" hash="buchung" className={ctaPrimary}>
            Termin anfragen
          </Link>
        }
      />
      <section id="kundenbilder" className="section mx-auto max-w-7xl px-4 sm:px-6" aria-labelledby="kundenbilder-heading">
        <p className="kicker">Aus echten Kundenaufträgen</p>
        <h2 id="kundenbilder-heading" className="heading-2 mt-4">Unsere Arbeit in Bildern.</h2>
        <p className="mt-5 max-w-2xl text-muted">Originalaufnahmen von Fahrzeugwäsche, Lackdetails, Innenraum und fertigem Fahrzeug. Mit Zustimmung veröffentlicht; sichtbare Kennzeichen wurden unkenntlich gemacht.</p>
        <CustomerPhotoGallery />
      </section>
      <section id="kundenbeispiele" className="border-t border-line bg-surface">
        <div className="section mx-auto max-w-7xl px-4 sm:px-6">
          <p className="kicker">Kundenbeispiele in Bewegung</p>
          <h2 className="heading-2 mt-4 max-w-2xl">Details, die auf Fotos kaum sichtbar werden.</h2>
          <p className="mt-5 max-w-xl leading-relaxed text-muted">
            Vier kurze, freigegebene Einblicke in das Ergebnis der Aufbereitung. Die Videos sind
            ohne Ton und zeigen keine sichtbaren Kennzeichen.
          </p>
          <div className="mt-12"><CustomerVideoGallery videos={customerVideos} /></div>
        </div>
      </section>
    </main>
  );
}
