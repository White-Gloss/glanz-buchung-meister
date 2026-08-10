import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, Car, MapPin, Route as RouteIcon, Timer } from "lucide-react";
import { ConversionBand } from "@/components/ConversionBand";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  buildCityFaqItems,
  buildCityJsonLd,
  buildCityMeta,
  distanceRank,
  neighbourComparison,
  pickupFigures,
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
  const nachbarn = neighbourComparison(city.slug);
  const zahlen = pickupFigures(city);
  const rang = distanceRank(city);
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

              {/*
                ABHOLUNG IN ZAHLEN – der Abschnitt, der diese Seite von den
                zwölf anderen Stadtseiten unterscheidet. Alle Werte sind aus
                Entfernung und Preisstaffel berechnet, nichts ist erfunden.
              */}
              {!isHome && (
                <>
                  <h2 className="mt-14 display-section uppercase">
                    Abholung aus {city.short} in Zahlen
                  </h2>
                  <p className="mt-4 text-muted-foreground">
                    Für eine Aufbereitung legen wir zweimal die Strecke zurück – einmal zur Abholung
                    in {city.name}, einmal zur Rückgabe. Das sind rund{" "}
                    <strong className="text-foreground">{zahlen.roundTripKm} km</strong> und etwa{" "}
                    {Math.round(zahlen.roundTripMinutes / 60) >= 1
                      ? `${(zahlen.roundTripMinutes / 60).toFixed(1).replace(".", ",")} Stunden`
                      : `${zahlen.roundTripMinutes} Minuten`}{" "}
                    reine Fahrzeit, die Sie sich sparen.
                  </p>
                  <p className="mt-4 text-muted-foreground">
                    {city.name} ist damit die {rang.rank}. von {rang.total} Städten in unserem
                    Abholgebiet – gemessen an der Entfernung zur Werkstatt.{" "}
                    {zahlen.price === null
                      ? `Die Strecke liegt außerhalb der festen Preisstaffel; wir kalkulieren die Abholung hier individuell auf Anfrage.`
                      : zahlen.price === 0
                        ? `Für diese Entfernung ist die Abholung kostenlos.`
                        : `Die Abholung kostet ${zahlen.priceText}.`}
                    {zahlen.freeWithPackage &&
                      ` Im Paket High-End Keramik ist sie bis ${pickupPricing.freeUpToKm} km ohnehin enthalten – für ${city.short} also inklusive.`}
                  </p>
                </>
              )}

              <h2 className="mt-14 display-section uppercase">
                Was Fahrzeuge aus {city.short} besonders beansprucht
              </h2>
              <p className="mt-4 text-muted-foreground">{city.demand}</p>
              <p className="mt-4 text-muted-foreground">{city.localBenefit}</p>

              {/*
                Echte Belege aus dem Betrieb. Steht in `localProof` nichts,
                entfällt der Abschnitt – lieber gar kein Absatz als ein
                erfundener.
              */}
              {city.localProof && (
                <>
                  <h3 className="display-sub mt-10 uppercase">Aus unserer Arbeit in {city.name}</h3>
                  <p className="mt-3 text-muted-foreground">{city.localProof}</p>
                </>
              )}

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
              {/*
                Bewusst nur Name, Preis und Dauer – ohne die vollständigen
                Leistungslisten. Die standen zuvor wortgleich auf allen
                dreizehn Stadtseiten und waren damit der größte Einzelblock
                doppelten Textes. Die Beschreibung gehört auf die Preisseite,
                die dafür die eine, gebündelte Adresse ist; hier zählt die
                Frage „was kostet das für mich in dieser Stadt".
              */}
              <ul className="space-y-2">
                {servicePackages.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/preise"
                      className="hairline-gold flex items-baseline justify-between gap-3 rounded-2xl bg-card/70 px-5 py-4 backdrop-blur-xl transition-colors hover:text-primary"
                    >
                      <span>
                        <span className="display-card uppercase">{p.name}</span>
                        <span className="mt-0.5 block text-xs uppercase tracking-widest text-muted-foreground">
                          {p.duration}
                        </span>
                      </span>
                      <span className="display-price shrink-0 text-base text-primary">
                        ab {currency(p.basePrice)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                {vatNoticeShort()} Alle enthaltenen Leistungen im Detail auf der{" "}
                <Link to="/preise" className="text-primary hover:underline">
                  Preisübersicht
                </Link>
                .
              </p>
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
          <h2 className="display-sub uppercase">
            {city.short} im Vergleich zum übrigen Abholgebiet
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Entfernung und Abholpreis der Orte, die {city.short} am nächsten liegen. So sehen Sie
            auf einen Blick, wo Sie stehen – und finden den richtigen Ort, falls Ihr Fahrzeug
            woanders steht.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <caption className="sr-only">
                Entfernung und Abholpreis für {city.name} und die nächstgelegenen Orte
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <th scope="col" className="py-3 pr-4 font-medium">
                    Ort
                  </th>
                  <th scope="col" className="py-3 pr-4 font-medium">
                    Entfernung
                  </th>
                  <th scope="col" className="py-3 pr-4 font-medium">
                    Fahrzeit
                  </th>
                  <th scope="col" className="py-3 font-medium">
                    Abholung
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Die aktuelle Stadt zuerst und hervorgehoben – sie ist der Bezugspunkt. */}
                <tr className="border-b border-border/60 bg-primary/5">
                  <th scope="row" className="py-3 pr-4 text-left font-semibold text-foreground">
                    {city.name}
                    <span className="ml-2 text-xs font-normal text-primary">diese Seite</span>
                  </th>
                  <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                    {isHome ? "Standort" : `${city.distanceKm} km`}
                  </td>
                  <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                    {city.driveMinutes} Min.
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {isHome ? "kostenlos" : zahlen.priceText}
                  </td>
                </tr>
                {nachbarn.map(({ city: nachbar, figures }) => (
                  <tr key={nachbar.slug} className="border-b border-border/40">
                    <th scope="row" className="py-3 pr-4 text-left font-normal">
                      <Link
                        to="/abholservice/$city"
                        params={{ city: nachbar.slug }}
                        className="text-foreground hover:text-primary hover:underline"
                      >
                        {nachbar.name}
                      </Link>
                    </th>
                    <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                      {nachbar.distanceKm === 0 ? "Standort" : `${nachbar.distanceKm} km`}
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                      {nachbar.driveMinutes} Min.
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {nachbar.distanceKm === 0 ? "kostenlos" : figures.priceText}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {vatNoticeShort()} Die Staffel gilt einheitlich für alle Fahrzeugklassen:{" "}
            {pickupTierSummary()}.
          </p>
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
