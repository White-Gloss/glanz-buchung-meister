import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { CompareSlider } from "@/components/compare-slider";
import { HeroMedia, Shot } from "@/components/media";
import { ctaGhost, ctaPrimary } from "@/components/ui";
import { cityJsonLd, whatsappForCity } from "@/lib/city-seo";
import {
  packages,
  packageServiceSlug,
  pickupKeramikNote,
  pickupPriceText,
  pickupTierSummary,
  services,
  site,
  type City,
} from "@/data/site";
import { money } from "@/lib/utils";
import { IconMessage } from "@/components/icons";

const steps = [
  {
    n: "01.",
    title: "Zustand zeigen",
    text: "Schicken Sie uns das Formular oder eine Nachricht per WhatsApp mit ein, zwei Fotos. Wir sagen, was sinnvoll ist – und was sich nicht lohnt.",
  },
  {
    n: "02.",
    title: "Abholen oder bringen",
    text: "Hol- und Bringservice nach Staffel, oder Sie fahren selbst nach Horb. Die Arbeit bleibt in der Werkstatt.",
  },
  {
    n: "03.",
    title: "Zurück mit Ergebnis",
    text: "Kontrolle unter Licht, Übergabe zum abgesprochenen Umfang. Kein Waschstraßenprogramm.",
  },
];

export function CityLanding({ city }: { city: City }) {
  const jsonLd = cityJsonLd(city);
  const wa = whatsappForCity(city.name);
  const pickup = pickupPriceText(city.km);

  useEffect(() => {
    document.body.dataset.cityWa = "1";
    return () => {
      delete document.body.dataset.cityWa;
    };
  }, []);

  return (
    <main id="main-content" className="pb-28 lg:pb-0" tabIndex={-1}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="film-chapter">
        <div className="film-chapter-media" data-parallax>
          <HeroMedia
            priority
            alt={`Werkstattfahrzeug von White Gloss – Fahrzeugaufbereitung für Kunden aus ${city.name}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <div className="film-chapter-veil" />
        <div className="film-chapter-copy" data-reveal>
          <p className="kicker">Fahrzeugaufbereitung · {city.name}</p>
          <h1 className="heading-display mt-4 max-w-4xl">
            Fahrzeugaufbereitung in {city.name}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            {city.blurb} Die Ausführung bleibt in der Werkstatt in {site.city}, nicht an der
            Straße. Abholung: {pickup}.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/" hash="buchung" search={{ paket: "premium" }} className={ctaPrimary}>
              Termin in {city.name} anfragen
            </Link>
            <a href={wa} className={ctaGhost} target="_blank" rel="noopener noreferrer">
              <IconMessage className="size-4" aria-hidden />
              Fotos per WhatsApp
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs uppercase tracking-[0.14em] text-subtle">
            <li>Endpreise inkl. MwSt.</li>
            <li>Hol- & Bringservice {pickup}</li>
            <li>Werkstatt {site.city}</li>
          </ul>
        </div>
      </section>

      <section className="cv-auto section mx-auto max-w-7xl px-4 sm:px-6">
        <p className="kicker">Blick in die Arbeit</p>
        <h2 className="heading-2 mt-4 max-w-2xl">
          Vorher und nachher, ohne Showroom-Trick.
        </h2>
        <p className="mt-4 max-w-xl text-muted">
          Zwei Werkstattfotos zum Vergleichen. Das ist kein Kundenauto aus{" "}
          {city.name} – sondern die Art der Arbeit, die bei uns in Horb passiert.
        </p>
        <div className="mt-10 max-w-4xl">
          <CompareSlider
            city={city.name}
            beforeAlt={`Lackschaden vor der Aufbereitung, Beispiel aus der Werkstatt – Seite für ${city.name}`}
            afterAlt={`Lack nach Politur in der Werkstatt Horb, Beispiel für Kunden aus ${city.name}`}
          />
        </div>
      </section>

      <section className="cv-auto border-t border-line">
        <div className="section mx-auto max-w-7xl px-4 sm:px-6">
          <p className="kicker">Leasing & Verkauf</p>
          <h2 className="heading-2 mt-4 max-w-3xl">
            Leasingrückgabe oder Verkauf in {city.name}
          </h2>
          <p className="mt-5 max-w-2xl text-muted leading-relaxed">
            Gutachter sehen Innenraum, Felgen und tiefe Kratzer – nicht jedes
            Instagram-Ideal. Wir priorisieren die Stellen, die Nachforderungen
            auslösen, und sagen vorher, was bleibt. Den Umfang rechnen wir am
            Zustand, nicht an einer Garantie.
          </p>
          <ul className="mt-8 max-w-2xl space-y-3 text-sm text-muted">
            <li className="border-l border-line pl-4">
              Vor dem Verkauf: Innenraum und Lack so, dass das Auto wieder
              klar wirkt – ohne unnötige Keramik, wenn das Auto danach weg ist.
            </li>
            <li className="border-l border-line pl-4">
              Werterhalt: Keramik nur, wenn das Fahrzeug bleibt. Die Standzeit
              steht auf dem Produkt, nicht in der Werbung.
            </li>
          </ul>
          <Link
            to="/leistungen/$slug/$city"
            params={{ slug: "leasingrueckgabe", city: city.slug }}
            className="mt-8 inline-flex min-h-11 items-center text-sm hover:underline"
          >
            Leasingrückgabe mit Abholung in {city.name}
          </Link>
        </div>
      </section>

      <section className="cv-auto border-t border-line bg-surface">
        <div className="section mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="heading-2">Pakete für {city.name}</h2>
          <p className="mt-4 max-w-xl text-muted">
            Dieselben drei Pakete wie in Horb. Abholung {pickup}. {pickupKeramikNote()}.
          </p>
          <ol className="mt-12 divide-y divide-line border-y border-line">
            {packages.map((p, i) => (
              <li key={p.id} className="gd-pack py-8">
                <p className="ga-num font-display text-sm text-subtle tabular-nums">
                  {String(i + 1).padStart(2, "0")}.
                </p>
                <div className="ga-pack-copy">
                  <p className="kicker">{p.name}</p>
                  <h3 className="heading-3 mt-2">{p.searchLabel}</h3>
                  <p className="mt-2 max-w-lg text-sm text-muted">{p.kicker}</p>
                </div>
                <p className="ga-price">
                  <span className="font-display text-3xl tabular-nums">{money(p.price)} €</span>
                  <span className="mt-1 block text-xs text-subtle">{site.vatNote}</span>
                  <Link
                    to="/leistungen/$slug/$city"
                    params={{ slug: packageServiceSlug[p.id], city: city.slug }}
                    className="mt-3 inline-flex min-h-11 items-center text-sm text-fg hover:underline"
                  >
                    {p.searchLabel} in {city.name}
                  </Link>
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="cv-auto border-t border-line">
        <div className="section mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="heading-2">Warum die Fahrt nach Horb</h2>
          <p className="mt-5 max-w-2xl text-muted leading-relaxed">
            Aus {city.name} sind es ca. {city.km} km / {city.minutes} Minuten.
            Politur und Keramik brauchen gleichmäßiges Licht und sauberes Wasser –
            das gibt es in der Werkstatt, nicht vor der Haustür. Deshalb holen wir
            ab: {pickupTierSummary()}.
          </p>
          <dl className="gd-tiles gd-tiles-3 mt-10">
            <div className="border border-line p-5">
              <dt className="text-xs uppercase tracking-[0.16em] text-subtle">Entfernung</dt>
              <dd className="mt-2 font-display text-3xl">ca. {city.km} km</dd>
            </div>
            <div className="border border-line p-5">
              <dt className="text-xs uppercase tracking-[0.16em] text-subtle">Fahrzeit</dt>
              <dd className="mt-2 font-display text-3xl">ca. {city.minutes} Min.</dd>
            </div>
            <div className="border border-line p-5">
              <dt className="text-xs uppercase tracking-[0.16em] text-subtle">Abholung</dt>
              <dd className="mt-2 font-display text-3xl">{pickup}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="cv-auto border-t border-line bg-surface">
        <div className="section mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="heading-2">In drei Schritten</h2>
          <ol className="gd-tiles gd-tiles-3 mt-12">
            {steps.map((s) => (
              <li key={s.n} className="border-t border-line pt-5">
                <p className="font-display text-3xl text-subtle/80">{s.n}</p>
                <h3 className="heading-3 mt-3">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="cv-auto border-t border-line">
        <div className="section mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="heading-2">Leistungen mit Abholung in {city.name}</h2>
          <ul className="mt-8 columns-1 gap-x-10 sm:columns-2">
            {services.map((s) => (
              <li key={s.slug} className="break-inside-avoid">
                <Link
                  to="/leistungen/$slug/$city"
                  params={{ slug: s.slug, city: city.slug }}
                  className="flex min-h-11 items-center text-sm text-muted hover:text-fg"
                >
                  {s.nav} in {city.name}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-12 flex flex-wrap gap-3">
            <Link to="/" hash="buchung" search={{ paket: "premium" }} className={ctaPrimary}>
              Termin anfragen
            </Link>
            <Link to="/abholservice" className={ctaGhost}>
              Alle Abholorte
            </Link>
          </div>
        </div>
      </section>

      <Shot
        name="atelier"
        alt={`Werkstatt in ${site.city} – Ausführung für Fahrzeuge aus ${city.name}`}
        className="h-48 w-full sm:h-64"
        sizes="100vw"
        framed={false}
      />

      <a
        href={wa}
        className="fixed inset-x-3 bottom-[max(0.65rem,env(safe-area-inset-bottom))] z-40 flex min-h-14 items-center justify-between gap-3 rounded-full border border-white/15 bg-elevated px-5 text-left shadow-[0_16px_40px_rgb(0_0_0_/_0.45)] lg:hidden"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>
          <span className="block text-sm font-medium text-fg">
            Preisschätzung per WhatsApp
          </span>
          <span className="block text-xs text-subtle">
            Foto schicken – Aufwand für {city.name}
          </span>
        </span>
        <IconMessage className="size-5 shrink-0" aria-hidden />
      </a>
    </main>
  );
}
