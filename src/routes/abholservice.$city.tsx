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
import { Button } from "@/components/ui/button";
import { PickupCityGrid } from "@/components/PickupCityGrid";
import {
  buildCityJsonLd,
  buildCityMeta,
  getNeighbourCities,
  getPickupCity,
  homeBase,
} from "@/lib/pickupLocations";
import { company, servicePackages } from "@/lib/servicesConfig";

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
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: meta.canonical }],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(loaderData.jsonLd) },
      ],
    };
  },
  notFoundComponent: CityNotFound,
  component: CityPage,
});

function CityNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-32 text-center">
      <h1 className="font-display text-4xl uppercase">Stadt nicht im Abholgebiet</h1>
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
    [RouteIcon, "Entfernung", isHome ? "Standort vor Ort" : `${city.distanceKm} km`],
    [Timer, "Fahrzeit", `ca. ${city.driveMinutes} Min.`],
    [Car, "Region", city.district],
  ];

  return (
    <div className="min-h-screen bg-background">
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

          <p className="mt-6 text-xs uppercase tracking-[0.3em] text-primary">
            Abholservice {city.short}
          </p>
          <h1 className="text-gradient mt-3 max-w-4xl font-display text-4xl uppercase leading-[0.95] text-balance sm:text-6xl">
            {city.focusKeyword} – mit kostenlosem Hol- und Bringservice
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">{city.intro}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="glow-ring">
              <Link to="/" hash="buchung">
                Abholtermin für {city.short} anfragen
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={`tel:${company.phone.replace(/\s/g, "")}`}>{company.phone}</a>
            </Button>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {facts.map(([Icon, label, value]) => (
              <div key={label} className="hairline-gold rounded-2xl bg-card/70 p-4 backdrop-blur-xl">
                <dt className="flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
                  <Icon className="size-3.5 text-primary" />
                  {label}
                </dt>
                <dd className="mt-2 font-display text-lg uppercase text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ABLAUF + REGIONALER CONTENT */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="font-display text-3xl uppercase sm:text-4xl">
              So läuft die Abholung in {city.name} ab
            </h2>
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
                  `Ihr Fahrzeug kommt fertig veredelt nach ${city.short} zurück – inklusive Endkontrolle und Rechnung als PDF.`,
                ],
              ].map(([title, text], i) => (
                <li key={title} className="flex gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/40 font-display text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-lg uppercase">{title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <h2 className="mt-14 font-display text-3xl uppercase sm:text-4xl">
              Was Fahrzeuge aus {city.short} besonders braucht
            </h2>
            <p className="mt-4 text-muted-foreground">{city.demand}</p>
            <p className="mt-4 text-muted-foreground">{city.localBenefit}</p>

            <h3 className="mt-10 font-display text-xl uppercase">
              Abholgebiet in und um {city.name}
            </h3>
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
          </div>

          {/* Pakete */}
          <aside className="space-y-3">
            <h2 className="font-display text-2xl uppercase">
              Pakete für Kundschaft aus {city.short}
            </h2>
            {servicePackages.map((p) => (
              <article
                key={p.id}
                className="hairline-gold rounded-2xl bg-card/70 p-5 backdrop-blur-xl"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-lg uppercase">{p.name}</h3>
                  <span className="font-display text-primary">ab {p.basePrice} €</span>
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
          <h2 className="font-display text-3xl uppercase sm:text-4xl">
            Häufige Fragen aus {city.name}
          </h2>
          <dl className="mt-8 space-y-6">
            {buildCityFaqItems(city).map(([q, a]) => (
              <div key={q} className="hairline-gold rounded-2xl bg-card/60 p-5">
                <dt className="font-display text-lg uppercase">{q}</dt>
                <dd className="mt-2 text-sm text-muted-foreground">{a}</dd>
              </div>
            ))}
          </dl>

        </div>
      </section>

      {/* Interne Verlinkung */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-2xl uppercase">Weitere Städte im Abholgebiet</h2>
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
    </div>
  );
}
