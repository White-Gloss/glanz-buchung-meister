import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck,
  Car,
  CheckCircle2,
  MapPin,
  Route as RouteIcon,
  Timer,
} from "lucide-react";
import { ConversionBand } from "@/components/ConversionBand";
import { Button } from "@/components/ui/button";
import { PickupCityGrid } from "@/components/PickupCityGrid";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  buildCityFaqItems,
  buildCityJsonLd,
  buildCityMeta,
  getNeighbourCities,
  getPickupCity,
  homeBase,
} from "@/lib/pickupLocations";

import {
  company,
  pickupPricing,
  pickupPriceText,
  currency,
  pickupTierSummary,
  servicePackages,
  vatNoticeShort,
} from "@/lib/servicesConfig";
import { OG_IMAGE, OG_IMAGE_ALT } from "@/lib/seo";
import { servicePages } from "@/lib/servicePages";

export const Route = createFileRoute("/abholservice/$city")({
  loader: ({ params }) => {
    const city = getPickupCity(params.city);
    if (!city) throw notFound();
    return { city, meta: buildCityMeta(city), jsonLd: buildCityJsonLd(city) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Seite nicht gefunden" }, { name: "robots", content: "noindex" }],
      };
    }
    const { meta } = loaderData;
    return {
      meta: [
        { title: meta.title },
        { name: "description", content: meta.description },
        { property: "og:title", content: meta.title },
        { property: "og:description", content: meta.description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: meta.canonical },
        { property: "og:image", content: OG_IMAGE },
        { property: "og:image:alt", content: OG_IMAGE_ALT },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: meta.title },
        { name: "twitter:description", content: meta.description },
        { name: "twitter:image", content: OG_IMAGE },
      ],
      links: [
        { rel: "canonical", href: meta.canonical },
        { rel: "alternate", hrefLang: "de-DE", href: meta.canonical },
      ],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(loaderData.jsonLd) }],
    };
  },
  notFoundComponent: CityNotFound,
  component: CityPage,
});

function CityNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-32 text-center">
      <h1 className="display-page">Stadt nicht im Abholgebiet</h1>
      <p className="mt-4 text-muted-foreground">
        Diese Seite existiert nicht. Hier finden Sie alle Städte, die wir anfahren.
      </p>
      <Button asChild className="mt-8">
        <Link to="/abholservice">Zur Übersicht</Link>
      </Button>
    </div>
  );
}

function CityPage() {
  const { city } = Route.useLoaderData();
  const neighbours = getNeighbourCities(city.slug);
  const isHome = city.distanceKm === 0;

  const facts: [typeof MapPin, string, string][] = [
    [MapPin, "Werkstatt", homeBase.city],
    [RouteIcon, "Entfernung", isHome ? "Standort vor Ort" : `ca. ${city.distanceKm} km`],
    [Timer, "Fahrzeit", `ca. ${city.driveMinutes} Min.`],
    [Car, "Region", city.district],
  ];

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="main-content">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="grid-lines absolute inset-0 opacity-30" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
            <nav aria-label="Brotkrumen" className="text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground">
                Startseite
              </Link>
              <span className="px-2">/</span>
              <Link to="/abholservice" className="hover:text-foreground">
                Abholservice
              </Link>
              <span className="px-2">/</span>
              <span className="text-foreground">{city.name}</span>
            </nav>

            <p className="eyebrow mt-6">Abholservice {city.short}</p>
            <h1 className="text-gradient display-page mt-3 max-w-4xl">
              {city.focusKeyword} – mit Hol- und Bringservice
            </h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              {city.intro}
            </p>
            <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary">
              <span className="display-card uppercase">
                Abholung {pickupPriceText(city.distanceKm)}
              </span>
              <span className="text-foreground/80">
                {isHome ? "Werkstatt vor Ort" : `ca. ${city.distanceKm} km bis zur Werkstatt`} ·{" "}
                {pickupTierSummary()} · bei High-End Keramik bis {pickupPricing.freeUpToKm} km
                inklusive
              </span>
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="glow-ring">
                <Link to="/" hash="buchung">
                  Abholtermin für {city.short} anfragen
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a
                  href={`mailto:${company.email}?subject=${encodeURIComponent(`Fahrzeugaufbereitung ${city.name}`)}`}
                >
                  Frage per E-Mail
                </a>
              </Button>
            </div>

            <dl className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {facts.map(([Icon, label, value]) => (
                <div
                  key={label}
                  className="hairline-gold rounded-2xl bg-card/70 p-4 backdrop-blur-xl"
                >
                  <dt className="flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
                    <Icon className="size-3.5 text-primary" />
                    {label}
                  </dt>
                  <dd className="display-card mt-2 uppercase text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ABLAUF + REGIONALER CONTENT */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="display-section uppercase">So läuft die Abholung in {city.name} ab</h2>
              <ol className="mt-8 space-y-6">
                {[
                  [
                    "Anfrage stellen",
                    `Sie konfigurieren Ihr Wunschpaket online und geben ${city.name} als Abholort an.`,
                  ],
                  [
                    "Termin bestätigen",
                    `Wir bestätigen Zeitfenster und Abholadresse – die Anfahrt erfolgt ${city.route}.`,
                  ],
                  [
                    "Aufbereitung in Horb",
                    `Alle Arbeiten finden in unserer Halle in ${homeBase.city} unter Prüfbeleuchtung statt.`,
                  ],
                  [
                    "Rückgabe vor Ort",
                    `Ihr Fahrzeug kommt fertig veredelt nach ${city.short} zurück – inklusive Endkontrolle und transparenter Leistungsübersicht.`,
                  ],
                ].map(([title, text], i) => (
                  <li key={title} className="flex gap-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/40 display-card tabular-nums text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="display-card uppercase">{title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <h2 className="mt-14 display-section uppercase">
                Was Fahrzeuge aus {city.short} besonders beansprucht
              </h2>
              <p className="mt-4 text-muted-foreground">{city.demand}</p>
              <p className="mt-4 text-muted-foreground">{city.localBenefit}</p>

              <h3 className="display-sub mt-10 uppercase">Abholgebiet in und um {city.name}</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Neben der Kernstadt ({city.postalCodes}) fahren wir unter anderem folgende Ortsteile
                und Nachbarorte an:
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {city.districts.map((d: string) => (
                  <li
                    key={d}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                  >
                    {d}
                  </li>
                ))}
              </ul>

              {/* Direkte Wege zu den Leistungsübersichten. */}
              <h3 className="display-sub mt-10 uppercase">
                Leistungen mit Abholung in {city.name}
              </h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Wählen Sie die passende Leistung; Abholung und Rückgabe für {city.short} stimmen wir
                anschließend mit Ihnen ab.
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {servicePages.map((service) => (
                  <li key={service.slug}>
                    <Link
                      to="/leistungen/$service"
                      params={{ service: service.slug }}
                      className="glass flex items-center rounded-xl px-4 py-3 text-sm transition-colors hover:text-primary"
                    >
                      <span className="truncate">{service.shortName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pakete */}
            <aside className="space-y-3">
              <h2 className="display-sub uppercase">Pakete für Kundschaft aus {city.short}</h2>
              {servicePackages.map((p) => (
                <article
                  key={p.id}
                  className="hairline-gold rounded-2xl bg-card/70 p-5 backdrop-blur-xl"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="display-card uppercase">{p.name}</h3>
                    <span className="display-price text-base text-primary">
                      ab {currency(p.basePrice)}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {vatNoticeShort()}
                      </span>
                    </span>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                    {p.tagline} · {p.duration}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {p.features.slice(0, 4).map((f) => (
                      <li key={f} className="flex gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
              <Button asChild className="w-full" size="lg">
                <Link to="/" hash="buchung">
                  <CalendarCheck className="size-4" />
                  Termin für {city.short} buchen
                </Link>
              </Button>
            </aside>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-border/60 bg-card/20">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <h2 className="display-section uppercase">Häufige Fragen aus {city.name}</h2>
            <dl className="mt-8 space-y-6">
              {buildCityFaqItems(city).map(([q, a]) => (
                <div key={q} className="hairline-gold rounded-2xl bg-card/60 p-5">
                  <dt className="display-card uppercase">{q}</dt>
                  <dd className="mt-2 text-sm text-muted-foreground">{a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Interne Verlinkung */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="display-sub uppercase">Weitere Städte im Abholgebiet</h2>
          <div className="mt-6">
            <PickupCityGrid cities={neighbours} compact />
          </div>
          <Link
            to="/abholservice"
            className="mt-6 inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            Alle Abholservice-Städte ansehen
            <ArrowRight className="size-4" />
          </Link>
        </section>
        <ConversionBand
          eyebrow={`Abholservice ${city.short}`}
          title={`Fahrzeug in ${city.short} abholen lassen.`}
          text="Paket und Hol- & Bringservice auswählen, Wunschtermin senden und die Übergabe direkt mit uns abstimmen."
        />
      </main>
      <SiteFooter />
    </div>
  );
}
