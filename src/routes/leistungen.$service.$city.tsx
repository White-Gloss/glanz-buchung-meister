import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Clock3, MapPin, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversionBand } from "@/components/ConversionBand";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { homeBase } from "@/lib/pickupLocations";
import {
  buildServiceCityFaq,
  buildServiceCityJsonLd,
  buildServiceCityMeta,
  buildServiceCitySections,
  getServiceCityCombo,
  serviceCityPath,
  siblingCities,
  siblingServices,
} from "@/lib/serviceCityPages";
import { OG_IMAGE, OG_IMAGE_ALT } from "@/lib/seo";
import {
  currency,
  pickupTierSummary,
  servicePackages,
  vatNotice,
  vatNoticeShort,
} from "@/lib/servicesConfig";

export const Route = createFileRoute("/leistungen/$service/$city")({
  loader: ({ params }) => {
    const combo = getServiceCityCombo(params.service, params.city);
    if (!combo) throw notFound();

    const { service, city } = combo;
    return {
      service,
      city,
      meta: buildServiceCityMeta(service, city),
      sections: buildServiceCitySections(service, city),
      faq: buildServiceCityFaq(service, city),
      jsonLd: buildServiceCityJsonLd(service, city),
    };
  },

  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Seite nicht gefunden" }, { name: "robots", content: "noindex" }],
      };
    }

    const { meta, jsonLd } = loaderData;
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
      scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
    };
  },

  component: ServiceCityPage,
});

function ServiceCityPage() {
  const { service, city, meta, sections, faq } = Route.useLoaderData();
  const relatedPackages = servicePackages.filter((pkg) =>
    service.relatedPackageIds.includes(pkg.id),
  );
  const otherCities = siblingCities(service, city);
  const otherServices = siblingServices(service);

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="main-content">
        {/* ---------------- Kopfbereich ---------------- */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
            <nav aria-label="Brotkrumen" className="text-xs text-muted-foreground">
              <Link to="/" className="transition-colors hover:text-foreground">
                Startseite
              </Link>
              <span className="px-2">/</span>
              <Link to="/leistungen" className="transition-colors hover:text-foreground">
                Leistungen
              </Link>
              <span className="px-2">/</span>
              <Link
                to="/leistungen/$service"
                params={{ service: service.slug }}
                className="transition-colors hover:text-foreground"
              >
                {service.name}
              </Link>
              <span className="px-2">/</span>
              <span className="text-foreground">{city.name}</span>
            </nav>

            <p className="eyebrow mt-6">{service.eyebrow}</p>
            <h1 className="text-gradient display-page mt-3 max-w-4xl">{meta.h1}</h1>

            {/* Kernaussage: Ausführung in Horb, Abholung für Stadt X */}
            <p className="mt-5 max-w-3xl text-base text-muted-foreground sm:text-lg">
              Ausführung in unserer Werkstatt in {homeBase.city} · Abholung und Rückgabe in{" "}
              {city.name} ({city.district})
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <p className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-sm">
                <MapPin aria-hidden className="size-4 shrink-0 text-primary" />
                <span>
                  {city.distanceKm} km bis {homeBase.city}
                </span>
              </p>
              <p className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-sm">
                <Clock3 aria-hidden className="size-4 shrink-0 text-primary" />
                <span>ca. {city.driveMinutes} Min. Fahrzeit</span>
              </p>
              <p className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-sm">
                <RouteIcon aria-hidden className="size-4 shrink-0 text-primary" />
                <span className="truncate" title={city.route}>
                  {city.route}
                </span>
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="glow-ring">
                <Link to="/" hash="buchung">
                  Termin für {city.short} anfragen
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/abholservice/$city" params={{ city: city.slug }}>
                  Abholservice {city.short}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ---------------- Inhaltsabschnitte ---------------- */}
        <section className="content-auto mx-auto max-w-4xl px-4 py-16 sm:px-6">
          {sections.map((section) => (
            <article key={section.heading} className="mb-12 last:mb-0">
              <h2 className="display-section uppercase">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-4 text-sm leading-7 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </article>
          ))}
        </section>

        {/* ---------------- Leistungsumfang ---------------- */}
        <section className="content-auto border-y border-border bg-surface/35">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Leistungsumfang</p>
              <h2 className="display-section mt-3 uppercase">
                Das ist bei der {service.shortName} enthalten
              </h2>
              <ul className="mt-8 space-y-3">
                {service.benefits.map((benefit) => (
                  <li key={benefit} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                    <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="eyebrow">Ablauf</p>
              <h2 className="display-section mt-3 uppercase">Schritt für Schritt</h2>
              <ol className="mt-8 space-y-4">
                {service.process.map((step, index) => (
                  <li key={step.title} className="metal-panel rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-widest text-primary">
                      Schritt {index + 1}
                    </p>
                    <h3 className="mt-1 text-sm font-medium text-foreground">{step.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ---------------- Preise & Abholstaffel ---------------- */}
        <section className="content-auto mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <p className="eyebrow">Preise</p>
          <h2 className="display-section mt-3 uppercase">
            Was {service.shortName} für {city.short} kostet
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
            Hol- und Bringservice nach Entfernung: {pickupTierSummary()}. {vatNotice()}
          </p>

          {relatedPackages.length > 0 ? (
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {relatedPackages.map((pkg) => (
                <article key={pkg.id} className="glass rounded-2xl p-5">
                  <h3 className="display-card">{pkg.name}</h3>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {pkg.tagline}
                  </p>
                  <p className="display-price mt-4">ab {currency(pkg.basePrice)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {vatNoticeShort()} · Startpreis Kompaktklasse · {pkg.duration}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="metal-panel mt-8 rounded-2xl p-5 text-sm leading-6 text-muted-foreground">
              Der Aufwand hängt hier stark vom Einzelfall ab. Deshalb nennen wir den Preis erst
              nach der Begutachtung des Fahrzeugs und nicht pauschal im Voraus.
            </p>
          )}
        </section>

        {/* ---------------- FAQ (deckungsgleich mit JSON-LD) ---------------- */}
        <section className="content-auto border-y border-border bg-surface/35">
          <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
            <p className="eyebrow">Häufige Fragen</p>
            <h2 className="display-section mt-3 uppercase">
              {service.shortName} in {city.short}
            </h2>
            <dl className="mt-8 space-y-6">
              {faq.map(([question, answer]) => (
                <div key={question} className="metal-panel rounded-2xl p-5">
                  <dt className="text-sm font-medium text-foreground">{question}</dt>
                  <dd className="mt-2 text-sm leading-6 text-muted-foreground">{answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ---------------- Matrix-Verlinkung (reines CSS, kein JS) ---------------- */}
        <section className="content-auto mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Gleiche Leistung, andere Stadt</p>
              <h2 className="display-sub mt-3 uppercase">
                {service.shortName} in der Region
              </h2>
              <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                {otherCities.map((other) => (
                  <li key={other.slug}>
                    <Link
                      to="/leistungen/$service/$city"
                      params={{ service: service.slug, city: other.slug }}
                      className="glass flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm transition-colors hover:text-primary"
                    >
                      <span className="truncate">
                        {service.shortName} {other.short}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {other.distanceKm} km
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="eyebrow">Gleiche Stadt, andere Leistung</p>
              <h2 className="display-sub mt-3 uppercase">Weitere Leistungen für {city.short}</h2>
              <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                {otherServices.map((other) => (
                  <li key={other.slug}>
                    <Link
                      to="/leistungen/$service/$city"
                      params={{ service: other.slug, city: city.slug }}
                      className="glass flex items-center rounded-xl px-4 py-3 text-sm transition-colors hover:text-primary"
                    >
                      <span className="truncate">
                        {other.shortName} {city.short}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Alle Kombinationen finden Sie in der{" "}
                <Link to="/leistungen" className="text-primary hover:underline">
                  Leistungsübersicht
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        <ConversionBand
          eyebrow={`Termin für ${city.short}`}
          title={`${service.shortName} anfragen.`}
          text={`Fahrzeugklasse und Paket auswählen, Abholort ${city.name} angeben – den voraussichtlichen Gesamtpreis sehen Sie sofort.`}
        />
      </main>
      <SiteFooter />
    </div>
  );
}

export { serviceCityPath };
