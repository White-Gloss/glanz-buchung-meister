import { serializeJsonLd } from "@/lib/json-ld";
import { createFileRoute, Link } from "@tanstack/react-router";
import { IconArrowRight } from "@/components/icons";
import { LazyGoogleReviews } from "@/components/lazy-google-reviews";
import { LazyConfigurator } from "@/components/lazy-configurator";
import { Shot } from "@/components/media";
import {
  cities,
  pickupKeramikNote,
  cityPickupPriceText,
  pickupTierSummary,
  services,
  site,
} from "@/data/site";
import { cityJourneyText, pickupDistanceLabel, pickupStatus } from "@/lib/city-copy";
import { localBusinessJsonLd, pageHead } from "@/lib/seo";
import { parseBookingSelection } from "@/lib/booking-selection";
import { scrollFilmPreloads } from "@/data/scroll-film";
import { conciergeAtmosphere } from "@/data/atmosphere-media";
import { ScrollFilmHero } from "@/components/scroll-film-hero";
import { HomePolish } from "@/components/home-polish";
import { PackageShowcase } from "@/components/package-showcase";
import { ResultsTeaser } from "@/components/results-teaser";
import { HomeProcess } from "@/components/home-process";
import { AutomotiveJourney } from "@/components/automotive-journey";
import { RevealLines } from "@/components/reveal-lines";
import { WebsiteStudioContent } from "@/components/website-studio-content";
import { loadPublicStudioDocument } from "@/lib/studio-public.functions";
import { studioHero, studioMetadata } from "@/lib/studio-public";

export const Route = createFileRoute("/")({
  validateSearch: parseBookingSelection,
  component: Home,
  loader: async () => {
    const [document, about] = await Promise.all([
      loadPublicStudioDocument("home"),
      loadPublicStudioDocument("about"),
    ]);
    return { document, aboutPublished: Boolean(about) };
  },
  head: ({ loaderData }) => {
    const hero = studioHero(loaderData?.document);
    const head = pageHead({
      ...studioMetadata(loaderData?.document, {
      title: `Fahrzeugaufbereitung ${site.city} | ${site.name}`,
      description:
        `Autoaufbereitung und Fahrzeugpflege in Horb am Neckar: Innenraumreinigung, Lackkorrektur, Keramikversiegelung. Ab 149 €, Hol- und Bringservice für ${cities.length} Orte.`,
      }),
      path: "/",
      ...(hero ? { preloadImage: hero.src, image: hero.src } : {}),
    });
    return { ...head, links: [...head.links, ...(hero ? [] : scrollFilmPreloads)] };
  },
});

function Home() {
  const jsonLd = localBusinessJsonLd();
  const { paket, ort } = Route.useSearch();
  const { document, aboutPublished } = Route.useLoaderData();

  return (
    <main id="main-content" tabIndex={-1} data-home="polish">
      <HomePolish />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <ScrollFilmHero
        title={document?.content.title.trim() || undefined}
        lead={document?.content.lead.trim() || undefined}
        heroImage={studioHero(document)}
      />

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
              data-count={cities.length}
              data-count-prefix=""
              data-count-suffix=" Abholorte"
            >
              {cities.length} Abholorte
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
        <p className="mx-auto max-w-2xl whitespace-pre-line py-12 text-center text-sm leading-relaxed text-muted sm:text-base">
          {document?.content.body.trim() || "Für den täglichen Weg zur Arbeit, Ihren Liebhaberwagen oder die Leasingrückgabe: Wir prüfen Ihr Fahrzeug persönlich und stimmen Pflege, Preis und Termin mit Ihnen ab."}
        </p>
        <nav className="home-jump-links" aria-label="Auf der Startseite">
          <a href="#pakete">Pakete & Preise</a>
          <a href="#kundenergebnisse">Ergebnisse</a>
          <a href="#buchung">Termin anfragen</a>
        </nav>
      </div>
      {document && (document.content.sections.length > 0 || document.content.faqs.length > 0 || document.content.images.some((image) => image.assetId !== document.content.heroAssetId)) && (
        <section className="section mx-auto max-w-7xl px-4 sm:px-6" aria-label="Aus unserer Werkstatt">
          <WebsiteStudioContent content={document.content} assets={document.assets} headingLevel={1} showIntro={false} showHero={false} showBody={false} />
        </section>
      )}
      <section className="film-chapter workshop-personal" aria-labelledby="workshop-title">
        <div className="film-chapter-media" data-parallax-frame>
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
          <h2 id="workshop-title" className="heading-2 mt-5" data-lines>
            <RevealLines lines={["Ihr Fahrzeug.", "In guten Händen."]} />
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Wir stimmen die Pflege von Lack, Leder und Felgen auf den Zustand Ihres Fahrzeugs ab.
            Alle Arbeiten führen wir in unserer Werkstatt in Horb am Neckar aus.
          </p>
          <blockquote className="workshop-quote">
            „Ich behandle jedes Fahrzeug so, als müsste ich es Ihnen unter perfektem Licht zurückgeben – weil ich genau das tue.“
          </blockquote>
          <div className="workshop-owner"><span>{site.owner}</span><p>Inhaber · White-Gloss Detailing</p></div>
          <Link to="/qualitaet" className="atelier-text-link">So arbeiten wir <IconArrowRight aria-hidden /></Link>
          {aboutPublished && <Link to="/ueber-uns" className="atelier-text-link mt-4">Über White-Gloss <IconArrowRight aria-hidden /></Link>}
        </div>
      </section>

      <PackageShowcase />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <ResultsTeaser />
        <LazyGoogleReviews id="bewertungen" compact />
      </div>

      <HomeProcess />

      <AutomotiveJourney />

      <section className="concierge-service" aria-labelledby="concierge-heading">
        <header>
          <p className="kicker">Hol- und Bringservice · digitale Übergabe</p>
          <h2 id="concierge-heading" className="heading-2" data-lines>
            <RevealLines lines={["Sie geben uns den Schlüssel.", "Wir kümmern uns um den Rest."]} />
          </h2>
          <p>Sie müssen dafür nicht vor Ort sein. Auf Wunsch stimmen wir eine sichere Schlüsselhinterlegung mit Ihnen ab.</p>
          <div className="concierge-media" aria-hidden="true">
            {conciergeAtmosphere.map((photo) => (
              <div className="concierge-frame" key={photo.id}>
                <img
                  className="concierge-media-backdrop"
                  src={photo.backdrop}
                  width={384}
                  height={216}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <img
                  className="concierge-media-sharp"
                  src={photo.src}
                  srcSet={photo.srcSet}
                  sizes="(min-width: 960px) 33vh, 72vw"
                  width={photo.width}
                  height={photo.height}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ))}
          </div>
        </header>
        <ol>
          <li><span>01</span><h3>Wir holen ab</h3><p>Zum vereinbarten Zeitpunkt – persönlich oder mit abgestimmter Schlüsselhinterlegung.</p></li>
          <li><span>02</span><h3>Wir bereiten auf</h3><p>Ihr Fahrzeug ist in unserer Werkstatt in guten Händen. Umfang und Preis werden vorher mit Ihnen abgestimmt.</p></li>
          <li><span>03</span><h3>Wir bringen zurück</h3><p>Stressfrei und ohne Wartezeit. Die digitale Übergabe dokumentiert das Ergebnis für Sie.</p></li>
        </ol>
      </section>

      <section
        id="buchung"
        className="section booking-section mx-auto max-w-7xl px-4 sm:px-6"
        aria-labelledby="buchung-heading"
      >
        <p className="kicker">Fahrzeug → Wunschergebnis → Termin und Übergabe</p>
        <h2 id="buchung-heading" className="heading-2 mt-3" tabIndex={-1} data-lines>
          <RevealLines lines={["Ihre Aufbereitung."]} />
        </h2>
        <p className="booking-intro text-muted">
          Wählen Sie Fahrzeug, Paket und Zusatzleistungen. Preis und Zeitaufwand bleiben transparent.
          Danach stimmen wir Termin, Abholung und digitale Übergabe mit Ihnen ab – unverbindlich.
        </p>
        <LazyConfigurator eager={Boolean(paket || ort)} initialPackage={paket} initialCity={ort} />
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
        className="home-directory mx-auto max-w-7xl px-4 sm:px-6"
        aria-labelledby="fahrzeugaufbereitung-heading"
      >
        <header>
          <p className="kicker">White-Gloss Detailing</p>
          <h2 id="fahrzeugaufbereitung-heading" className="heading-2 mt-4">
            Fahrzeugaufbereitung in {site.city}
          </h2>
          <p>
            Innenraumreinigung, Lackkorrektur und Keramikversiegelung: Wir beraten Sie zur passenden
            Autoaufbereitung in unserer Werkstatt in {site.city}. In der Region bieten wir einen Hol-
            und Bringservice an.
          </p>
        </header>
        <nav aria-label="Leistungen">
          <ul className="home-directory-links">
            {services.map((s) => (
              <li key={s.slug}>
                <Link to="/leistungen/$slug" params={{ slug: s.slug }}>
                  {s.nav}
                  <IconArrowRight aria-hidden />
                </Link>
              </li>
            ))}
            <li>
              <Link to="/ratgeber">
                Ratgeber
                <IconArrowRight aria-hidden />
              </Link>
            </li>
          </ul>
        </nav>
      </section>
      <section className="home-location" aria-labelledby="standort-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div>
            <p className="kicker">Persönlich vor Ort</p>
            <h2 id="standort-heading" className="heading-2 mt-4" data-lines>
              <RevealLines lines={[`Werkstatt in ${site.city}`]} />
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
            <p className="kicker">Hol- und Bringservice · {cities.length} Abholorte</p>
            <h3>Wir holen Ihr Fahrzeug ab und bringen es zurück.</h3>
            <p>
              {pickupTierSummary()}. {pickupKeramikNote()}. Alle Beträge {site.vatNote}
            </p>
            {/* Chips: Name, Entfernung, Abholpreis. Der zugängliche Name beginnt mit dem
                sichtbaren Ortsnamen (WCAG 2.5.3) und nennt die Plaketten ausgeschrieben. */}
            <ul className="home-city-links city-chips" aria-label="Abholorte">
              {cities.map((c) => (
                <li key={c.slug}>
                  <Link
                    to="/abholservice/$city"
                    params={{ city: c.slug }}
                    className="city-chip"
                    aria-label={`${c.name}, ${cityJourneyText(c)}, Abholung ${cityPickupPriceText(c)}`}
                  >
                    <span className="city-chip-name">{c.name}</span>
                    <span className="city-chip-meta" aria-hidden="true">
                      <span>{pickupDistanceLabel(c)}</span>
                      <span className="city-chip-status" data-status={pickupStatus(c.km)}>
                        {cityPickupPriceText(c)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/abholservice" className="atelier-text-link">
              Abholorte & Konditionen <IconArrowRight aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

