import { createFileRoute, Link } from "@tanstack/react-router";
import { PhotoNote, Shot } from "@/components/media";
import { PageHero } from "@/components/page-hero";
import { processSteps, site } from "@/data/site";
import { pageHead } from "@/lib/seo";

const STEP_SHOT = ["atelier", "lack", "keramik", "finish"] as const;

export const Route = createFileRoute("/qualitaet")({
  component: QualityPage,
  head: () =>
    pageHead({
      title: `Qualitätsanspruch & Ablauf | ${site.name}`,
      description:
        "Ablauf der Fahrzeugaufbereitung in Horb: anschauen, vorbereiten, arbeiten, abgeben. So viel wie nötig, so schonend wie möglich.",
      path: "/qualitaet",
      preloadShot: "finish",
    }),
});

function QualityPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="finish"
        alt="Lack unter Prüflicht"
        kicker="Ablauf"
        title="Wie wir arbeiten."
        lead="Sorgfalt ist bei uns kein Extra, das man dazubucht. Ein gutes Ergebnis kommt von sauberer Vorbereitung, dem passenden Verfahren und einer ehrlichen Kontrolle, bevor das Auto rausgeht."
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Qualitätsanspruch" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <ol className="mt-16 space-y-16">
          {processSteps.map((s, i) => (
            <li key={s.n} className="border-t border-line pt-8">
              <p className="font-display text-5xl tracking-tight text-subtle/80">{s.n}</p>
              <h2 className="mt-4 font-display text-3xl tracking-tight">{s.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">{s.text}</p>
              <Shot
                name={STEP_SHOT[i]}
                alt={`Schritt ${s.title} bei der Fahrzeugaufbereitung`}
                className="mt-8 aspect-[16/9] w-full"
                sizes="(min-width: 768px) 48rem, 100vw"
              />
            </li>
          ))}
        </ol>
        <PhotoNote className="mt-4" />
        <h2 className="mt-20 font-display text-4xl tracking-tight">Was Sie erwarten dürfen</h2>
        <ul className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
          <li>
            <strong className="text-fg">Ehrlich anschauen.</strong> Material, Schmutz
            und Schäden bestimmen, was sinnvoll ist – nicht ein Katalog, der für
            jedes Auto gleich aussieht.
          </li>
          <li>
            <strong className="text-fg">Passendes Verfahren.</strong> Werkzeug und
            Chemie richten sich nach Lack und Leder, nicht danach, was am
            schärfsten wäre.
          </li>
          <li>
            <strong className="text-fg">Keine Showroom-Märchen.</strong> Grenzen
            sagen wir vorher, bevor unnötig Lack abgetragen wird.
          </li>
          <li>
            <strong className="text-fg">Kontrolle vor der Übergabe.</strong> Die
            kritischen Stellen gehen wir noch einmal durch, damit nichts
            durchrutscht.
          </li>
        </ul>
        <blockquote className="mt-14 max-w-xl font-display text-3xl leading-snug tracking-tight">
          So viel wie nötig. So schonend wie möglich.
        </blockquote>
        <Link
          to="/"
          hash="buchung"
          className="mt-10 inline-flex min-h-11 items-center rounded-sm bg-accent px-5 text-sm font-medium text-accent-fg"
        >
          Fahrzeug anfragen
        </Link>
      </div>
    </main>
  );
}
