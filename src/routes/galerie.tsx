import { createFileRoute, Link } from "@tanstack/react-router";
import { PhotoNote, Shot, type ShotName } from "@/components/media";
import { PageHero } from "@/components/page-hero";
import { ctaPrimary } from "@/components/ui";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";
import { CustomerVideoGallery } from "@/components/customer-video-gallery";
import { customerVideos } from "@/components/results-teaser";

const shots: { name: ShotName; alt: string; title: string }[] = [
  { name: "keramik", title: "Lackfinish", alt: "Spiegelnde Motorhaube nach der Aufbereitung" },
  { name: "atelier", title: "Kundenfahrzeug", alt: "Schwarzer BMW nach der Aufbereitung bei White Gloss" },
  { name: "felgen", title: "Felgen", alt: "Felge nach der Keramikbeschichtung" },
  { name: "leder", title: "Innenraum", alt: "Gepflegter BMW-Innenraum mit Leder und Mittelkonsole" },
  { name: "finish", title: "Finish", alt: "Schwarzer BMW mit tiefem Lackglanz nach der Aufbereitung" },
  { name: "dellen", title: "Dellen", alt: "Parkdelle unter Streiflicht vor der Ausbeularbeit" },
  { name: "private", title: "Kundenfahrzeug", alt: "Freigegebenes Kundenfahrzeug nach der Aufbereitung" },
];

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
        alt="Poliermaschine auf dem Lack in der Werkstatt Horb"
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
      <section className="section mx-auto max-w-7xl px-4 sm:px-6">
        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {shots.map((shot) => (
            <li key={shot.name} className="min-w-0">
              <Shot
                name={shot.name}
                alt={shot.alt}
                className="aspect-[4/3] w-full"
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              />
              <p className="mt-3 text-xs uppercase tracking-[0.16em] text-subtle">{shot.title}</p>
            </li>
          ))}
        </ul>
        <PhotoNote className="mt-6" />
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
