import { createFileRoute, Link } from "@tanstack/react-router";
import { PhotoNote, Shot, type ShotName } from "@/components/media";
import { ctaPrimary } from "@/components/ui";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";

const shots: { name: ShotName; alt: string; title: string }[] = [
  { name: "lack", title: "Lackkorrektur", alt: "Poliermaschine auf dem Lack in der Werkstatt Horb" },
  { name: "keramik", title: "Keramik", alt: "Keramikversiegelung von Hand auf dem Lack" },
  { name: "atelier", title: "Werkstatt", alt: "Werkstatt von White Gloss in Horb am Neckar" },
  { name: "felgen", title: "Felgen", alt: "Felge nach der Keramikbeschichtung" },
  { name: "leder", title: "Innenraum", alt: "Leder nach der Innenraumreinigung" },
  { name: "finish", title: "Prüflicht", alt: "Lack unter Prüflicht nach der Politur" },
  { name: "dellen", title: "Dellen", alt: "Parkdelle unter Streiflicht vor der Ausbeularbeit" },
  { name: "private", title: "Atelier", alt: "Atelierfahrzeug von White Gloss, Kennzeichen entfernt" },
];

export const Route = createFileRoute("/galerie")({
  component: GaleriePage,
  head: () =>
    pageHead({
      title: `Werkstattgalerie | ${site.name}`,
      description:
        "Einblicke in die Werkstatt von White Gloss in Horb am Neckar: Politur, Keramik, Leder und Felgen – ohne Kundenfahrzeuge, ohne Kennzeichen.",
      path: "/galerie",
    }),
});

function GaleriePage() {
  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-16 pb-28 sm:px-6 lg:pb-16" tabIndex={-1}>
      <p className="kicker">Aus der Werkstatt</p>
      <h1 className="heading-1 mt-4">So sieht die Arbeit aus.</h1>
      <p className="mt-5 max-w-xl text-muted leading-relaxed">
        Politur, Keramik, Leder und Felgen – Werkstattfotos ohne Kundenautos und
        ohne Kennzeichen. Vorher/Nachher echter Aufträge zeigen wir nur mit
        Freigabe.
      </p>
      <ul className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
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
      <Link to="/" hash="buchung" className={`${ctaPrimary} mt-10`}>
        Termin anfragen
      </Link>
    </main>
  );
}
