import { createFileRoute, Link } from "@tanstack/react-router";
import { CustomerPhotoGallery } from "@/components/customer-photo-gallery";
import { CustomerProjectStory } from "@/components/customer-project-story";
import { Shot } from "@/components/media";
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
      preloadShot: "atelier",
    }),
});

function GaleriePage() {
  return (
    <main id="main-content" tabIndex={-1} data-gallery="curated">
      <section className="gallery-intro mx-auto max-w-7xl px-4 sm:px-6">
        <nav aria-label="Brotkrumen" className="gallery-crumbs"><Link to="/">Startseite</Link><span aria-hidden>/</span><span aria-current="page">Ergebnisse</span></nav>
        <div className="gallery-intro-heading">
          <div><p className="kicker">White Gloss · Kundenauftrag</p><h1 className="heading-page">Echte Ergebnisse aus unserer Werkstatt.</h1></div>
          <div><p>Lack, Leder, Felgen. Entdecken Sie unsere Arbeit an einem echten Kundenfahrzeug – in Bildern und kurzen Filmen.</p><Link to="/" hash="buchung" className={ctaPrimary}>Termin anfragen</Link></div>
        </div>
        <figure className="gallery-cover">
          <Shot name="atelier" alt="Aufbereiteter schwarzer BMW im Seitenprofil vor der Werkstatt" priority framed={false} sizes="(min-width: 1280px) 1200px, 95vw" />
          <figcaption><span>BMW · Außenaufbereitung</span><span>White Gloss · Horb am Neckar</span></figcaption>
        </figure>
      </section>
      <CustomerProjectStory />
      <section id="kundenbilder" className="section mx-auto max-w-7xl px-4 sm:px-6" aria-labelledby="kundenbilder-heading">
        <p className="kicker">Aus echten Kundenaufträgen</p>
        <h2 id="kundenbilder-heading" className="heading-2 mt-4">Unsere Arbeit in Bildern.</h2>
        <p className="mt-5 max-w-2xl text-muted">Ausgewählte Perspektiven auf Lackfinish, Innenraum und das fertige Fahrzeug.</p>
        <CustomerPhotoGallery />
        <p className="gallery-permission-note">Originalaufnahmen, mit Zustimmung veröffentlicht. Sichtbare Kennzeichen wurden unkenntlich gemacht.</p>
      </section>
      <section id="kundenbeispiele" className="border-t border-line bg-surface">
        <div className="section mx-auto max-w-7xl px-4 sm:px-6">
          <p className="kicker">Kundenbeispiele in Bewegung</p>
          <h2 className="heading-2 mt-4 max-w-2xl">Details, die auf Fotos kaum sichtbar werden.</h2>
          <p className="mt-5 max-w-xl leading-relaxed text-muted">
            Wasser auf versiegeltem Glas, geschützter Lack und ein Blick in den Innenraum.
            Vier kurze Filme zeigen das Ergebnis in Bewegung.
          </p>
          <div className="mt-12"><CustomerVideoGallery videos={customerVideos} /></div>
          <p className="gallery-permission-note">Freigegebene Originalvideos. Ohne Ton und ohne sichtbare Kennzeichen.</p>
        </div>
      </section>
    </main>
  );
}
