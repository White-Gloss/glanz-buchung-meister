import { serializeJsonLd } from "@/lib/json-ld";
import { createFileRoute, Link } from "@tanstack/react-router";
import { IconArrowRight } from "@/components/icons";
import { LazyGoogleReviews } from "@/components/lazy-google-reviews";
import { LazyConfigurator } from "@/components/lazy-configurator";
import { Shot } from "@/components/media";
import { pickupKeramikNote, pickupTierSummary, processSteps, site } from "@/data/site";
import { localBusinessJsonLd, pageHead } from "@/lib/seo";
import { parseBookingSelection } from "@/lib/booking-selection";
import { scrollFilmPreloads } from "@/data/scroll-film";
import { ScrollFilmHero } from "@/components/scroll-film-hero";
import { HomePolish } from "@/components/home-polish";
import { PackageShowcase } from "@/components/package-showcase";
import { ResultsTeaser } from "@/components/results-teaser";

export const Route = createFileRoute("/")({
  validateSearch: parseBookingSelection,
  component: Home,
  head: () => {
    const head = pageHead({
      title: `Fahrzeugaufbereitung ${site.city} | ${site.name}`,
      description:
        "Fahrzeugaufbereitung in Horb am Neckar: Innenraumreinigung, Lackkorrektur, Keramikversiegelung. Startpreise ab 149 €, Hol- und Bringservice in 13 Städten.",
      path: "/",
    });
    return { ...head, links: [...head.links, ...scrollFilmPreloads] };
  },
});

function Home() {
  const jsonLd = localBusinessJsonLd();
  const { paket, ort } = Route.useSearch();

  return (
    <main id="main-content" tabIndex={-1} data-home="polish">
      <HomePolish />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <ScrollFilmHero />

      <section
        id="nach-dem-film"
        aria-label="Auf einen Blick"
        className="hero-follow border-b border-line"
        data-stagger
      >
        <ul className="gd-stats mx-auto max-w-7xl">
          <li
            className="ga-s1 border-b border-r border-line px-4 py-7 sm:px-6 sm:py-8"
            data-stagger-item
          >
            <p
              className="font-display text-xl tracking-tight sm:text-2xl"
              data-count="13"
              data-count-prefix=""
              data-count-suffix=" Städte"
            >
              13 Städte
            </p>
            <p className="mt-1 text-xs text-subtle">Hol- und Bringservice</p>
          </li>
          <li
            className="ga-s2 border-b border-r border-line px-4 py-7 sm:px-6 sm:py-8"
            data-stagger-item
          >
            <p className="font-display text-xl tracking-tight sm:text-2xl">
              {site.hoursLabel.replace(" Uhr", "")}
            </p>
            <p className="mt-1 text-xs text-subtle">Werkstatt geöffnet</p>
          </li>
          <li
            className="ga-s3 border-b border-r border-line px-4 py-7 sm:px-6 sm:py-8"
            data-stagger-item
          >
            <p
              className="font-display text-xl tracking-tight sm:text-2xl"
              data-count="149"
              data-count-prefix="ab "
              data-count-suffix={"\u00a0€"}
            >
              ab 149&nbsp;€
            </p>
            <p className="mt-1 text-xs text-subtle">Kompaktklasse inkl. MwSt.</p>
          </li>
          <li
            className="ga-s4 border-b border-r border-line px-4 py-7 sm:px-6 sm:py-8"
            data-stagger-item
          >
            <p className="font-display text-xl tracking-tight sm:text-2xl">Lackprüfung</p>
            <p className="mt-1 text-xs text-subtle">Mit Lackdickenmessung</p>
          </li>
        </ul>
      </section>
      <div className="home-intro mx-auto max-w-7xl px-4 sm:px-6">
        <p className="mx-auto max-w-2xl py-12 text-center text-sm leading-relaxed text-muted sm:text-base">
          Für den täglichen Weg zur Arbeit, Ihren Liebhaberwagen oder die Leasingrückgabe: Wir
          prüfen Ihr Fahrzeug persönlich und stimmen Pflege, Preis und Termin mit Ihnen ab.
        </p>
        <nav className="home-jump-links" aria-label="Auf der Startseite">
          <a href="#pakete">Pakete & Preise</a>
          <a href="#kundenergebnisse">Ergebnisse</a>
          <a href="#buchung">Termin anfragen</a>
        </nav>
      </div>
      <PackageShowcase />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <ResultsTeaser />
        <LazyGoogleReviews id="bewertungen" compact />
      </div>

      <section className="film-chapter workshop-personal" aria-labelledby="workshop-title">
        <div className="film-chapter-media" data-parallax>
          <Shot
            name="atelier"
            alt="Aufbereitetes Kundenfahrzeug vor der Werkstatt von White Gloss in Horb am Neckar"
            className="size-full"
            sizes="100vw"
            framed={false}
          />
        </div>
        <div className="film-chapter-veil" />
        <div className="film-chapter-copy" data-reveal>
          <p className="kicker">Persönlich in Horb am Neckar</p>
          <h2 id="workshop-title" className="heading-2 mt-5">Ihr Fahrzeug.<br />In guten Händen.</h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Wir stimmen die Pflege von Lack, Leder und Felgen auf den Zustand Ihres Fahrzeugs ab.
            Alle Arbeiten führen wir in unserer Werkstatt in Horb am Neckar aus.
          </p>
          <div className="workshop-owner"><span>{site.owner}</span><p>Inhaber · White Gloss Detailing</p></div>
          <Link to="/qualitaet" className="atelier-text-link">So arbeiten wir <IconArrowRight aria-hidden /></Link>
        </div>
      </section>

      <section
        className="home-craft mx-auto max-w-7xl px-4 sm:px-6"
        aria-labelledby="craft-heading"
      >
        <header>
          <p className="kicker">Prozess</p>
          <h2 id="craft-heading" className="heading-2 mt-4">
            So läuft’s bei uns.
          </h2>
          <Link to="/qualitaet" className="atelier-text-link">
            Unser Ablauf im Detail <IconArrowRight aria-hidden />
          </Link>
        </header>
        <ol className="home-process">
          {processSteps.map((step) => (
            <li key={step.n}>
              <span>{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
      <nav
        className="home-specialties mx-auto max-w-7xl px-4 sm:px-6"
        aria-label="Weitere Leistungen"
      >
        <Link to="/dellen-hagelschaden">
          <span className="kicker">01</span>
          <span>Dellen- und Hagelschäden</span>
          <IconArrowRight aria-hidden />
        </Link>
        <Link to="/luxusfahrzeuge">
          <span className="kicker">02</span>
          <span>Luxusfahrzeuge</span>
          <IconArrowRight aria-hidden />
        </Link>
        <Link to="/b2b">
          <span className="kicker">03</span>
          <span>Firmen, Flotten, Autohäuser</span>
          <IconArrowRight aria-hidden />
        </Link>
      </nav>

      <section
        id="buchung"
        className="section booking-section mx-auto max-w-7xl px-4 sm:px-6"
        aria-labelledby="buchung-heading"
      >
        <p className="kicker">Fahrzeug · Paket · Feinschliff</p>
        <h2 id="buchung-heading" className="heading-2 mt-3">
          Ihre Aufbereitung.
        </h2>
        <p className="booking-intro text-muted">
          Wählen Sie Fahrzeug, Paket und Zusatzleistungen. Sie sehen direkt den voraussichtlichen
          Preis. Ihre Terminanfrage ist unverbindlich.
        </p>
        <LazyConfigurator eager={Boolean(paket || ort)} initialPackage={paket} initialCity={ort} />
      </section>
      <section className="home-location" aria-labelledby="standort-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div>
            <p className="kicker">Persönlich vor Ort</p>
            <h2 id="standort-heading" className="heading-2 mt-4">
              Werkstatt in {site.city}
            </h2>
            <p>
              {site.street}, {site.postalCode} {site.city}
              <br />
              {site.hoursLabel}
            </p>
            <Link to="/kontakt" className="atelier-text-link">
              Kontakt & Anfahrt <IconArrowRight aria-hidden />
            </Link>
          </div>
          <div>
            <p className="kicker">Hol- und Bringservice · 13 Städte</p>
            <h3>Wir holen Ihr Fahrzeug ab und bringen es zurück.</h3>
            <p>
              {pickupTierSummary()}. {pickupKeramikNote()}. Alle Beträge {site.vatNote}
            </p>
            <Link to="/abholservice" className="atelier-text-link">
              Abholorte & Konditionen <IconArrowRight aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
