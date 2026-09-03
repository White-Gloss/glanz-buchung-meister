import { createFileRoute, Link } from "@tanstack/react-router";
import { PhotoNote, Shot } from "@/components/media";
import { ctaPrimary } from "@/components/ui";
import { site } from "@/data/site";
import { absUrl, pageHead } from "@/lib/seo";

const DESCRIPTION =
  "Aufbereitung für Luxus-, Sport- und Sammlerfahrzeuge ab ca. 80.000 € in Horb am Neckar. Erst anrufen, dann anschauen – nicht über den Online-Konfigurator.";

export const Route = createFileRoute("/luxusfahrzeuge")({
  component: LuxuryPage,
  head: () =>
    pageHead({
      title: `Luxusfahrzeug-Aufbereitung ab 80.000 € | ${site.name}`,
      description: DESCRIPTION,
      path: "/luxusfahrzeuge",
      preloadHero: true,
    }),
});

function LuxuryPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Individuelle Aufbereitung für Luxusfahrzeuge",
    description: DESCRIPTION,
    url: absUrl("/luxusfahrzeuge"),
    areaServed: "Baden-Württemberg",
    image: absUrl("/media/hero-1080.webp"),
    provider: {
      "@type": "AutomotiveBusiness",
      name: site.legalName,
      telephone: site.phoneHref.replace("tel:", ""),
      url: site.origin,
      sameAs: [site.instagram],
    },
  };

  return (
    <main id="main-content" tabIndex={-1}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="film-chapter">
        <div className="film-chapter-media" data-parallax>
          <Shot
            name="hero"
            alt="Atelierfahrzeug von White Gloss in Horb am Neckar, Kennzeichen entfernt"
            className="size-full"
            sizes="100vw"
            priority
            framed={false}
          />
        </div>
        <div className="film-chapter-veil" />
        <div className="film-chapter-copy" data-reveal>
          <p className="kicker">Private Client</p>
          <h1 className="heading-display mt-4 max-w-3xl">
            Fahrzeuge ab etwa 80.000 €
          </h1>
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <nav aria-label="Brotkrumen" className="text-xs text-subtle">
          <Link to="/" className="hover:text-fg">
            Startseite
          </Link>
          <span className="px-2">/</span>
          <span>Private Client</span>
        </nav>
        <p className="mt-8 text-lg leading-relaxed text-muted">
          Hier gibt es keinen Schnellklick und kein Paket von der Stange. Wir
          reden zuerst, schauen uns das Auto in Horb in Ruhe an und bauen den
          Umfang genau um dieses Fahrzeug herum.
        </p>
        <ol className="mt-16 space-y-12">
          {[
            [
              "Anrufen",
              "Am Telefon klären wir in Ruhe, um welches Auto es geht, wie es genutzt wird und was Sie sich wünschen. Über die Website lässt sich in diesem Bereich nicht buchen – das wäre zu grob.",
            ],
            [
              "Auto zeigen",
              "Lack, Karosserie, Leder und die empfindlichen Stellen schauen wir uns gemeinsam in der Werkstatt in Horb an. Erst dann ist klar, was wirklich nötig ist.",
            ],
            [
              "Konzept",
              "Verfahren, Schutz und Zeitrahmen entstehen erst danach. Nachvollziehbar, ohne Standardpaket, und so, dass Sie den Umfang verstehen.",
            ],
            [
              "Umsetzen",
              "Jede Maßnahme richtet sich nach Material und Werterhalt. Premium-Wachse wie Swissvax nehmen wir nur, wenn sie wirklich zum Lack passen.",
            ],
          ].map(([t, d], i) => (
            <li key={t} className="border-t border-line pt-8">
              <p className="font-display text-4xl text-subtle/80">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-4 font-display text-3xl tracking-tight">{t}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">{d}</p>
            </li>
          ))}
        </ol>
        <ul className="mt-14 space-y-3 text-sm text-muted">
          <li>Erstgespräch nur am Telefon</li>
          <li>Das Auto muss bei uns in Horb vorgefahren werden</li>
          <li>Umfang und Preis erst nach dem Anschauen</li>
          <li>Keine Online-Buchung, kein Standardpaket</li>
        </ul>
        <p className="mt-8 text-xs text-subtle">
          Swissvax nennen wir als mögliche Produktwahl, nicht als Partnerschaft.
        </p>
        <a href={site.phoneHref} className={`${ctaPrimary} mt-10`}>
          Persönlich anrufen · {site.phoneDisplay}
        </a>
      </div>

      <section className="border-t border-line">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <p className="kicker">Aus der Werkstatt</p>
          <h2 className="mt-4 max-w-2xl font-display text-4xl tracking-tight sm:text-5xl">
            So sieht die Arbeit aus.
          </h2>
          <p className="mt-5 max-w-xl text-muted">
            Das ist unser eigenes Auto aus der Werkstatt – keine Kundenreferenz,
            Kennzeichen entfernt. So bleibt nachvollziehbar, was Sie sehen.
          </p>
          <figure className="mt-12">
            <Shot
              name="hero"
              alt="Atelierfahrzeug von White Gloss in Horb am Neckar, Kennzeichen entfernt"
              className="aspect-[2/1] w-full"
              sizes="100vw"
            />
          </figure>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <figure>
              <Shot
                name="lack"
                alt="Poliermaschine auf dem Lack"
                className="aspect-[4/3] w-full"
                sizes="(min-width: 640px) 50vw, 100vw"
              />
            </figure>
            <figure>
              <Shot
                name="leder"
                alt="Leder nach der Pflege"
                className="aspect-[4/3] w-full"
                sizes="(min-width: 640px) 50vw, 100vw"
              />
            </figure>
          </div>
          <PhotoNote className="mt-4" />
          <a href={site.phoneHref} className={`${ctaPrimary} mt-8`}>
            Private Client anrufen · {site.phoneDisplay}
          </a>
        </div>
      </section>
    </main>
  );
}
