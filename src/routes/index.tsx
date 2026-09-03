import { createFileRoute, Link } from "@tanstack/react-router";
import { IconArrowRight } from "@/components/icons";
import { LazyConfigurator } from "@/components/lazy-configurator";
import { WorkshopMap } from "@/components/workshop-map";
import { HeroMedia, PhotoNote, Shot } from "@/components/media";
import { ctaGhost, ctaPrimary } from "@/components/ui";
import {
  packageServiceSlug,
  packages,
  parsePackageSearch,
  pickupKeramikNote,
  pickupPricing,
  pickupTierSummary,
  processSteps,
  services,
  site,
  cities,
  openingHours,
  type PackageId,
} from "@/data/site";
import { localBusinessJsonLd, pageHead } from "@/lib/seo";
import { money } from "@/lib/utils";

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>): { paket?: PackageId } => {
    const paket = parsePackageSearch(raw.paket);
    return paket ? { paket } : {};
  },
  component: Home,
  head: () =>
    pageHead({
      title: `Fahrzeugaufbereitung ${site.city} | ${site.name}`,
      description:
        "Fahrzeugaufbereitung in Horb am Neckar: Innenraumreinigung, Lackkorrektur, Keramikversiegelung. Startpreise ab 149 €, Hol- und Bringservice in 13 Städten.",
      path: "/",
      preloadHero: true,
    }),
});

function Home() {
  const jsonLd = localBusinessJsonLd();
  const { paket } = Route.useSearch();

  return (
    <main id="main-content" tabIndex={-1}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="hero-stage">
        <div className="hero-stage-media" data-parallax>
          <HeroMedia
            priority
            alt="Weißes Atelierfahrzeug von White Gloss in Horb am Neckar, Kennzeichen entfernt"
            className="absolute inset-0 h-full w-full object-cover object-[70%_center] sm:object-[62%_center]"
          />
        </div>
        <div className="hero-stage-veil" />
        <div className="hero-stage-copy flex min-h-svh flex-col items-center justify-center px-6 pb-24 pt-20 text-center">
          <p className="kicker hero-in" style={{ ["--d" as string]: 0 }}>
            {site.city}
          </p>
          <h1 className="hero-in mt-7 max-w-5xl" style={{ ["--d" as string]: 1 }}>
            <span className="heading-brand block">White Gloss.</span>
          </h1>
          <span className="hero-rule hero-in" aria-hidden style={{ ["--d" as string]: 2 }} />
          <p className="heading-tagline hero-in mt-7" style={{ ["--d" as string]: 3 }}>
            No compromise.
          </p>
          <p className="heading-tagline hero-in mt-1" style={{ ["--d" as string]: 4 }}>
            Only results.
          </p>
          <Link
            to="/"
            hash="buchung"
            className={`${ctaPrimary} hero-in mt-10`}
            style={{ ["--d" as string]: 5 }}
          >
            Termin anfragen
            <IconArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="scroll-hint" aria-hidden>
          <span />
        </div>
      </section>

      <section aria-label="Auf einen Blick" className="border-b border-line" data-reveal>
        <ul className="gd-stats mx-auto max-w-7xl">
          {[
            ["13 Städte", "Hol- & Bringservice"],
            [site.hoursLabel.replace(" Uhr", ""), "Werkstatt geöffnet"],
            ["ab 149 €", "Kompaktklasse inkl. MwSt."],
            ["je nach Produkt", "Keramikschutz"],
          ].map(([n, l], i) => (
            <li key={n} className={`ga-s${i + 1} border-b border-r border-line px-4 py-7 sm:px-6 sm:py-8`}>
              <p className="font-display text-xl tracking-tight sm:text-2xl">{n}</p>
              <p className="mt-1 text-xs text-subtle">{l}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="film-chapter">
        <div className="film-chapter-media" data-parallax>
          <Shot
            name="atelier"
            alt="Werkstatt von White Gloss in Horb am Neckar – ein Auto nach dem anderen"
            className="size-full"
            sizes="100vw"
            framed={false}
          />
        </div>
        <div className="film-chapter-veil" />
        <div className="film-chapter-copy" data-reveal>
          <p className="kicker">Werkstatt Horb</p>
          <p className="mt-5 max-w-3xl font-display text-4xl leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
            Kein Waschstraßenprogramm.
            <br />
            Ein Auto nach dem anderen.
          </p>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Wir nehmen uns jedes Auto einzeln vor: Lack, Leder und Felgen so
            gründlich wie nötig, so schonend wie möglich. Die Arbeit läuft in der
            Werkstatt in Horb, nicht draußen an der Straße.
          </p>
        </div>
      </section>

      <section className="cv-auto border-t border-line">
        <div className="section mx-auto max-w-7xl px-4 sm:px-6" data-reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="kicker">Pakete</p>
              <h2 className="heading-2 mt-4 max-w-xl">
                Drei Pakete für die Fahrzeugaufbereitung.
              </h2>
            </div>
            <Link
              to="/preise"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-fg"
            >
              Alle Preise & Extras
              <IconArrowRight className="link-arrow size-4" aria-hidden />
            </Link>
          </div>
          <ol className="mt-14 divide-y divide-line border-y border-line">
            {packages.map((p, i) => (
              <li key={p.id}>
                <Link
                  to="/leistungen/$slug"
                  params={{ slug: packageServiceSlug[p.id] }}
                  aria-label={`${p.searchLabel} in ${site.city}, Paket ${p.name} ab ${p.price} Euro`}
                  className="lift group gd-pack py-8"
                >
                  <span className="ga-num font-display text-sm text-subtle tabular-nums">
                    {String(i + 1).padStart(2, "0")}.
                  </span>
                  <span className="ga-pack-copy">
                    <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span className="font-display text-3xl tracking-tight sm:text-4xl">
                        {p.name}
                      </span>
                      {p.featured ? (
                        <span className="kicker">Bestseller</span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs uppercase tracking-[0.16em] text-subtle">
                      {p.searchLabel}
                    </span>
                    <span className="mt-2 block max-w-lg text-sm leading-relaxed text-muted">
                      {p.kicker}
                    </span>
                  </span>
                  <span className="ga-price">
                    <span className="flex items-baseline gap-2 sm:justify-end">
                      <span className="text-[0.65rem] uppercase tracking-[0.2em] text-subtle">ab </span>
                      <span className="font-display text-3xl leading-none tracking-wide tabular-nums">
                        {money(p.price)}
                      </span>
                      <span className="text-sm text-muted"> €</span>
                    </span>
                    <span className="mt-1 block text-xs text-subtle">
                      {site.vatNote} · {p.duration}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="cv-auto border-t border-line">
        <div className="section gd-split mx-auto max-w-7xl px-4 sm:px-6">
          <div className="ga-copy" data-reveal>
            <p className="kicker">Prozess</p>
            <h2 className="heading-2 mt-4">
              So läuft’s bei uns.
            </h2>
            <p className="mt-5 max-w-xl text-muted">
              Bevor etwas angefasst wird, schauen wir uns das Auto an. Der Ablauf
              richtet sich nach dem Zustand – nicht nach einem festen Programm.
            </p>
            <ol className="gd-tiles mt-12">
              {processSteps.map((s) => (
                <li key={s.n} className="border-t border-line pt-5">
                  <p className="font-display text-3xl tracking-tight text-subtle/80">
                    {s.n}
                  </p>
                  <h3 className="heading-3 mt-3">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
            <Link
              to="/qualitaet"
              className="mt-10 inline-flex min-h-11 items-center gap-2 text-sm hover:underline"
            >
              Unser Ablauf
              <IconArrowRight className="link-arrow size-4" aria-hidden />
            </Link>
          </div>
          <Shot
            name="finish"
            alt="Lack unter Prüflicht nach der Politur"
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="ga-media aspect-[4/5] w-full lg:aspect-[4/5]"
          />
        </div>
      </section>

      <section className="cv-auto border-t border-line bg-surface">
        <div className="section gd-split gd-split--media mx-auto max-w-7xl px-4 sm:px-6">
          <Shot
            name="dellen"
            alt="Parkdelle unter Streiflicht, bevor wir ausbeulen"
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="ga-media aspect-[4/3] w-full"
          />
          <div className="ga-copy" data-reveal>
            <p className="kicker">Geht auch extra</p>
            <h2 className="heading-2 mt-4">
              Dellenentfernung & Hagelschaden
            </h2>
            <p className="mt-5 max-w-md text-muted leading-relaxed">
              Ob Parkdelle oder Hagel: Schicken Sie uns ein paar Fotos, und wir
              sagen Ihnen ehrlich, ob sich die Arbeit lohnt. Den Preis machen wir
              erst, wenn wir uns den Schaden angeschaut haben.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/dellen-hagelschaden" className={ctaPrimary}>
                Begutachtung anfragen
              </Link>
              <Link to="/fahrzeug-zustand" className={ctaGhost}>
                Zustand prüfen lassen
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="cv-auto section mx-auto max-w-7xl px-4 sm:px-6" data-reveal>
        <p className="kicker">Aus der Werkstatt</p>
        <h2 className="heading-2 mt-4 max-w-2xl">
          So sieht die Arbeit aus.
        </h2>
        <p className="mt-5 max-w-xl text-muted">
          Politur, Keramik, Leder und Felgen – ein paar Einblicke aus der
          Werkstatt, ohne Kundenfahrzeuge und ohne Kennzeichen.
        </p>
        <div className="gd-gallery mt-12">
          <Shot
            name="lack"
            alt="Poliermaschine auf dem Lack"
            className="ga-hero aspect-[16/9] w-full min-h-[16rem] lg:min-h-[28rem]"
            sizes="(min-width: 1024px) 66vw, 100vw"
          />
          <Shot
            name="keramik"
            alt="Keramikversiegelung von Hand auf dem Lack"
            className="ga-cera aspect-[4/3] w-full"
          />
          <Shot
            name="felgen"
            alt="Felge nach der Keramikbeschichtung"
            className="ga-felg aspect-[4/3] w-full"
          />
          <Shot
            name="leder"
            alt="Leder nach der Innenraumreinigung"
            className="ga-lede aspect-[4/3] w-full"
          />
          <Shot
            name="finish"
            alt="Lack unter Prüflicht"
            className="ga-fini aspect-[4/3] w-full lg:min-h-[14rem]"
            sizes="(min-width: 1024px) 66vw, 100vw"
          />
        </div>
        <PhotoNote className="mt-4" />
        <Link
          to="/galerie"
          className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm text-fg"
        >
          Mehr aus der Werkstatt
          <IconArrowRight className="link-arrow size-4" aria-hidden />
        </Link>
      </section>

      <section className="cv-auto gd-split gd-split--duo border-y border-line">
        <Link
          to="/luxusfahrzeuge"
          className="ga-lux group relative block min-h-[28rem] overflow-hidden sm:min-h-[36rem]"
        >
          <Shot
            name="private"
            alt="Atelierfahrzeug von White Gloss – für Fahrzeuge ab 80.000 € extra Zeit"
            className="absolute inset-0 h-full w-full"
            sizes="(min-width: 1024px) 50vw, 100vw"
            framed={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-8 sm:p-12">
            <p className="kicker">Private Client</p>
            <h2 className="heading-2 mt-4 max-w-md">
              Fahrzeuge ab 80.000 €
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted sm:text-base">
              Nicht über den Rechner. Wir sprechen zuerst, schauen uns das Auto
              an und bauen den Umfang extra für dieses Fahrzeug.
            </p>
            <span className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-fg">
              Individuelles Angebot
              <IconArrowRight className="link-arrow size-4" aria-hidden />
            </span>
          </div>
        </Link>
        <Link
          to="/b2b"
          className="ga-b2b group relative block min-h-[28rem] overflow-hidden border-t border-line sm:min-h-[36rem] lg:border-t-0 lg:border-l"
        >
          <Shot
            name="atelier"
            alt="Werkstatt von White Gloss in Horb – Aufbereitung für Firmen und Flotten"
            className="b2b-image absolute inset-0 h-full w-full"
            sizes="(min-width: 1024px) 50vw, 100vw"
            framed={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-8 sm:p-12">
            <p className="kicker">Geschäftskunden</p>
            <h2 className="heading-2 mt-4 max-w-md">
              Firmen, Flotten, Autohäuser
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted sm:text-base">
              Leasingrückläufer, Fuhrpark, Verkaufsvorbereitung. Den Preis
              rechnen wir am Umfang, nicht an einer Pauschale.
            </p>
            <span className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-fg">
              B2B-Anfrage
              <IconArrowRight className="link-arrow size-4" aria-hidden />
            </span>
          </div>
        </Link>
      </section>

      <section className="cv-auto border-t border-line bg-surface">
        <div className="section mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="heading-2">Leistungen & Abholung</h2>
          <div className="gd-split mt-12">
            <div className="ga-copy">
              <p className="kicker">Leistungen</p>
              <ul className="mt-5 divide-y divide-line border-y border-line">
                {services.map((s) => (
                  <li key={s.slug}>
                    <Link
                      to="/leistungen/$slug"
                      params={{ slug: s.slug }}
                      className="flex min-h-11 items-center justify-between py-3 text-sm text-muted hover:text-fg"
                    >
                      {s.nav}
                      <IconArrowRight className="link-arrow size-3.5 shrink-0 opacity-50" aria-hidden />
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    to="/ratgeber"
                    className="flex min-h-11 items-center justify-between py-3 text-sm text-muted hover:text-fg"
                  >
                    Ratgeber
                    <IconArrowRight className="link-arrow size-3.5 shrink-0 opacity-50" aria-hidden />
                  </Link>
                </li>
              </ul>
            </div>
            <div className="ga-media">
              <p className="kicker">Hol- & Bringservice · 13 Städte</p>
              <h3 className="heading-3 mt-4">Abholung mit klarer Staffel</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                {pickupTierSummary()}. {pickupKeramikNote()}.
                Geöffnet {openingHours.daysLabel}, {openingHours.opens}–
                {openingHours.closes} Uhr.
              </p>
              <ul className="gd-tiles gd-tiles-3 mt-6">
                {pickupPricing.tiers.map((t) => (
                  <li key={t.id} className="border border-line px-4 py-4">
                    <p className="font-display text-2xl tracking-wide">
                      {t.amount === 0 ? "0 €" : `${t.amount} €`}
                    </p>
                    <p className="mt-1 text-xs text-subtle">{t.label}</p>
                  </li>
                ))}
              </ul>
              <ul className="mt-6 columns-2 gap-x-8 text-sm">
                {cities.map((c) => (
                  <li key={c.slug} className="break-inside-avoid">
                    <Link
                      to="/abholservice/$city"
                      params={{ city: c.slug }}
                      className="inline-flex min-h-11 items-center text-muted hover:text-fg"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="cv-auto border-t border-line" aria-labelledby="standort-heading">
        <div className="section mx-auto max-w-7xl px-4 sm:px-6">
          <p className="kicker">Standort</p>
          <h2 id="standort-heading" className="heading-2 mt-4">
            Werkstatt in {site.city}
          </h2>
          <p className="mt-5 max-w-xl text-muted">
            {site.street}, {site.postalCode} {site.city}. Die Arbeit läuft hier –
            den Hol- und Bringservice gibt es in 13 Städten. Die Karte ist
            interaktiv, auch auf dem Handy.
          </p>
          <WorkshopMap className="mt-10" />
        </div>
      </section>

      <section className="film-chapter" aria-labelledby="fahrzeugaufbereitung-heading">
        <div className="film-chapter-media" data-parallax>
          <Shot
            name="finish"
            alt={`Fahrzeugaufbereitung in ${site.city} – Lack nach der Politur in der Werkstatt, Kennzeichen entfernt`}
            className="size-full"
            sizes="100vw"
            framed={false}
          />
        </div>
        <div className="film-chapter-veil" />
        <div className="film-chapter-copy" data-reveal>
          <p className="kicker">White Gloss Detailing</p>
          <h2 id="fahrzeugaufbereitung-heading" className="heading-2 mt-4">
            Fahrzeugaufbereitung in {site.city}
          </h2>
          <p className="mt-5 max-w-xl text-muted leading-relaxed">
            Fahrzeugaufbereitung heißt bei uns: Innenraum, Lack und Keramik in
            der Werkstatt – nicht an der Straße. White Gloss Detailing in{" "}
            {site.city}, mit Hol- und Bringservice in der Region.
          </p>
        </div>
      </section>

      <section
        id="buchung"
        className="section mx-auto max-w-7xl px-4 sm:px-6"
        aria-labelledby="buchung-heading"
      >
        <p className="kicker">Online anfragen</p>
        <h2 id="buchung-heading" className="heading-2 mt-4">
          Termin anfragen, Preis sofort sehen.
        </h2>
        <p className="mt-5 mb-12 max-w-xl text-muted">
          Wählen Sie Fahrzeugklasse, Paket und Extras – den Preis sehen Sie
          sofort. Die Anfrage ist unverbindlich, wir melden uns mit einem
          Terminvorschlag.
        </p>
        <LazyConfigurator eager={Boolean(paket)} initialPackage={paket} />
      </section>
    </main>
  );
}
