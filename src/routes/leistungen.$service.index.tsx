import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversionBand } from "@/components/ConversionBand";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  getServicePage,
  buildServiceJsonLd,
  servicePages,
  type ServicePage,
} from "@/lib/servicePages";
import { currency, servicePackages, vatNoticeShort } from "@/lib/servicesConfig";
import { absUrl, OG_IMAGE, OG_IMAGE_ALT } from "@/lib/seo";
import { pickupCitiesByDistance } from "@/lib/pickupLocations";
import { listPublishedCustomServices, toServicePage } from "@/lib/customServices.functions";

/**
 * Eigene (im Admin angelegte) Leistungen bekommen dieselbe Detailseite wie
 * die 7 Kern-Leistungen — aber ohne Ablauf-Schritte, ohne FAQ (die gibt es
 * für sie nicht) und ohne die 91-Städte-Matrix (siehe customServices.functions.ts
 * für die Begründung).
 */
export const Route = createFileRoute("/leistungen/$service/")({
  loader: async ({ params }) => {
    let customServices: ServicePage[] = [];
    try {
      const rows = await listPublishedCustomServices();
      customServices = rows.map(toServicePage);
    } catch {
      // eigene Leistungen bleiben dann einfach weg, kein Fehler für den Besuch
    }
    const service =
      getServicePage(params.service) ??
      customServices.find((candidate) => candidate.slug === params.service);
    if (!service) throw notFound();
    const allServices = [...servicePages, ...customServices];
    return { service, jsonLd: buildServiceJsonLd(service), allServices };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Leistung nicht gefunden" }, { name: "robots", content: "noindex" }],
      };
    }

    const { service, jsonLd } = loaderData;
    const canonical = absUrl(`/leistungen/${service.slug}`);
    return {
      meta: [
        { title: service.metaTitle },
        { name: "description", content: service.metaDescription },
        { property: "og:title", content: service.metaTitle },
        { property: "og:description", content: service.metaDescription },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonical },
        { property: "og:image", content: OG_IMAGE },
        { property: "og:image:alt", content: OG_IMAGE_ALT },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: service.metaTitle },
        { name: "twitter:description", content: service.metaDescription },
        { name: "twitter:image", content: OG_IMAGE },
      ],
      links: [
        { rel: "canonical", href: canonical },
        { rel: "alternate", hrefLang: "de-DE", href: canonical },
      ],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
    };
  },
  component: ServicePage,
});

function ServicePage() {
  const { service, allServices } = Route.useLoaderData();
  const relatedPackages = servicePackages.filter((servicePackage) =>
    service.relatedPackageIds.includes(servicePackage.id),
  );
  const relatedServices = allServices.filter((item) => item.slug !== service.slug);
  const isCoreService = servicePages.some((item) => item.slug === service.slug);

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="main-content">
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="grid-lines absolute inset-0 opacity-30" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
            <nav aria-label="Brotkrumen" className="text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground">
                Startseite
              </Link>
              <span className="px-2">/</span>
              <Link to="/" hash="leistungen" className="hover:text-foreground">
                Leistungen
              </Link>
              <span className="px-2">/</span>
              <span className="text-foreground">{service.name}</span>
            </nav>

            <p className="eyebrow mt-7">{service.eyebrow}</p>
            <h1 className="text-gradient display-page mt-3 max-w-4xl">{service.title}</h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              {service.lead}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="glow-ring">
                <Link to="/" hash="buchung">
                  Leistung konfigurieren
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/abholservice">Abholgebiet ansehen</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="eyebrow">Warum White Gloss</p>
              <h2 className="display-section mt-3 uppercase">Auf den Zustand abgestimmt</h2>
              <p className="mt-5 max-w-2xl text-muted-foreground">{service.detail}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {service.benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="hairline-gold flex gap-3 rounded-2xl bg-card/70 p-4 text-sm text-foreground/85"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {service.process.length > 0 && (
          <section className="border-y border-border/60 bg-card/20">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
              <p className="eyebrow">Arbeitsablauf</p>
              <h2 className="display-section mt-3 uppercase">Sorgfalt in vier Schritten</h2>
              <ol className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {service.process.map((step, index) => (
                  <li key={step.title} className="glass rounded-2xl p-5">
                    <span className="display-price text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="display-card mt-4 uppercase">{step.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {relatedPackages.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <p className="eyebrow">Passende Pakete</p>
            <h2 className="display-section mt-3 uppercase">{service.name} direkt konfigurieren</h2>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {relatedPackages.map((servicePackage) => (
                <article
                  key={servicePackage.id}
                  className="hairline-gold flex h-full flex-col rounded-2xl bg-card/70 p-5"
                >
                  <h3 className="display-card uppercase">{servicePackage.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{servicePackage.tagline}</p>
                  <p className="mt-5 flex items-center justify-between gap-3">
                    <span className="display-price text-primary">
                      ab {currency(servicePackage.basePrice)}
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {vatNoticeShort()}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock3 className="size-3.5" />
                      {servicePackage.duration}
                    </span>
                  </p>
                </article>
              ))}
            </div>
            <Button asChild size="lg" className="mt-7">
              <Link to="/" hash="buchung">
                Zum Preisrechner
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </section>
        )}

        {service.faq.length > 0 && (
          <section className="border-t border-border/60 bg-card/20">
            <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
              <p className="eyebrow">Antworten vorab</p>
              <h2 className="display-section mt-3 uppercase">Häufige Fragen zur {service.name}</h2>
              <dl className="mt-8 space-y-4">
                {service.faq.map(([question, answer]) => (
                  <div key={question} className="hairline-gold rounded-2xl bg-card/60 p-5">
                    <dt className="display-card uppercase">{question}</dt>
                    <dd className="mt-2 text-sm text-muted-foreground">{answer}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="display-sub uppercase">Weitere Leistungen</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {relatedServices.map((item) => (
              <Link
                key={item.slug}
                to="/leistungen/$service"
                params={{ service: item.slug }}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {item.name}
                <ArrowRight className="size-3.5 text-primary" />
              </Link>
            ))}
          </div>
        </section>
        {/* Matrix-Verlinkung: nur für die Kern-Leistungen, für die es die
            91 Stadt-Kombinationsseiten wirklich gibt (siehe Loader-Kommentar
            oben — eigene Leistungen haben diese Seiten bewusst nicht). */}
        {isCoreService && (
          <section className="content-auto border-y border-border bg-surface/35">
            <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
              <p className="eyebrow">Regional</p>
              <h2 className="display-section mt-3 uppercase">{service.shortName} in Ihrer Stadt</h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
                Ausgeführt wird immer in unserer Werkstatt in Horb am Neckar. Für diese Städte
                übernehmen wir Abholung und Rückgabe – jede Seite nennt Entfernung, Fahrzeit und
                Abholpreis.
              </p>
              <ul className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {pickupCitiesByDistance.map((city) => (
                  <li key={city.slug}>
                    <Link
                      to="/leistungen/$service/$city"
                      params={{ service: service.slug, city: city.slug }}
                      className="glass flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm transition-colors hover:text-primary"
                    >
                      <span className="truncate">
                        {service.shortName} {city.short}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {city.distanceKm} km
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <ConversionBand
          eyebrow={service.name}
          title="Passenden Umfang direkt anfragen."
          text="Fahrzeugklasse und Paket auswählen, Preisübersicht sehen und Wunschtermin unverbindlich senden."
        />
      </main>
      <SiteFooter />
    </div>
  );
}
