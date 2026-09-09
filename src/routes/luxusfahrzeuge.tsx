import { createFileRoute } from "@tanstack/react-router";
import { PhotoNote, Shot } from "@/components/media";
import { PageHero } from "@/components/page-hero";
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
      <PageHero
        shot="hero"
        alt="Eigenes Fahrzeug von White Gloss in Horb am Neckar, Kennzeichen entfernt"
        kicker="Luxusfahrzeuge"
        title="Fahrzeuge ab etwa 80.000 €"
        lead="Wir besprechen Ihre Wünsche am Telefon und erstellen nach der Begutachtung ein individuelles Angebot."
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Luxusfahrzeuge" },
        ]}
        actions={
          <a href={site.phoneHref} className={ctaPrimary}>
            Persönlich anrufen
          </a>
        }
      />
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <ol className="space-y-12">
          {[
            [
              "Anrufen",
              "Am Telefon besprechen wir Ihr Fahrzeug, seine Nutzung und Ihre Wünsche. Die Aufbereitung von Luxusfahrzeugen können Sie ausschließlich persönlich anfragen.",
            ],
            [
              "Fahrzeug begutachten",
              "Lack, Karosserie, Leder und die empfindlichen Stellen schauen wir uns gemeinsam in der Werkstatt in Horb an. Erst dann ist klar, was wirklich nötig ist.",
            ],
            [
              "Umfang festlegen",
              "Nach der Begutachtung besprechen wir die geeigneten Verfahren, den Schutz und den Zeitrahmen. Sie erhalten ein individuelles Angebot mit dem vereinbarten Leistungsumfang.",
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
          <li>Begutachtung des Fahrzeugs in unserer Werkstatt in Horb</li>
          <li>Leistungsumfang und Preis nach der Begutachtung</li>
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
              alt="Eigenes Fahrzeug von White Gloss in Horb am Neckar, Kennzeichen entfernt"
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
            Persönliche Beratung · {site.phoneDisplay}
          </a>
        </div>
      </section>
    </main>
  );
}
