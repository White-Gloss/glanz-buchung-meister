import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Car,
  CheckCircle2,
  FileCheck2,
  Gem,
  Hammer,
  ShieldCheck,
  Sofa,
  Sparkles,
} from "lucide-react";

import { ConversionBand } from "@/components/ConversionBand";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { absUrl, OG_IMAGE, OG_IMAGE_ALT } from "@/lib/seo";
import { servicePages as coreServicePages, type ServicePage } from "@/lib/servicePages";
import { ServiceCityMatrix } from "@/components/ServiceCityMatrix";
import { pickupCitiesByDistance } from "@/lib/pickupLocations";
import { listPublishedCustomServices, toServicePage } from "@/lib/customServices.functions";

const TITLE = "Leistungen der Fahrzeugaufbereitung | White Gloss";
const DESCRIPTION =
  "Fahrzeugaufbereitung, Lackkorrektur, Keramikversiegelung, Smart Repair und mehr in Horb am Neckar – mit Abholservice in der ganzen Region.";
const icons = [Sofa, Sparkles, ShieldCheck, Gem, Car, Hammer, FileCheck2];

export const Route = createFileRoute("/leistungen/")({
  loader: async (): Promise<{ customServices: ServicePage[] }> => {
    try {
      const rows = await listPublishedCustomServices();
      return { customServices: rows.map(toServicePage) };
    } catch {
      return { customServices: [] };
    }
  },
  head: ({ loaderData }) => {
    const allServices = [...coreServicePages, ...(loaderData?.customServices ?? [])];
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:type", content: "website" },
        { property: "og:url", content: absUrl("/leistungen") },
        { property: "og:image", content: OG_IMAGE },
        { property: "og:image:alt", content: OG_IMAGE_ALT },
      ],
      links: [
        { rel: "canonical", href: absUrl("/leistungen") },
        { rel: "alternate", hrefLang: "de-DE", href: absUrl("/leistungen") },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Leistungen von White Gloss Detailing",
            itemListElement: allServices.map((service, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: service.name,
              url: absUrl(`/leistungen/${service.slug}`),
            })),
          }),
        },
      ],
    };
  },
  component: ServicesOverview,
});

function ServicesOverview() {
  const { customServices } = Route.useLoaderData();
  const servicePages = [...coreServicePages, ...customServices];
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="main-content">
        <section className="relative isolate overflow-hidden border-b border-border">
          <div className="grid-lines absolute inset-0 -z-10 opacity-20" aria-hidden />
          <div className="chrome-orb -right-32 -top-32 -z-10" aria-hidden />
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
            <nav aria-label="Brotkrumen" className="text-xs text-muted-foreground">
              <Link to="/" className="transition-colors hover:text-foreground">
                Startseite
              </Link>
              <span className="px-2">/</span>
              <span className="text-foreground">Leistungen</span>
            </nav>
            <p className="eyebrow mt-10">Leistungsspektrum</p>
            <h1 className="display-page mt-3 max-w-5xl uppercase">
              Das passende Detail
              <span className="text-chrome block">für jedes Ziel.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Ob hygienischer Innenraum, klarer Lack oder langfristiger Schutz: Wir stimmen
              Verfahren und Umfang auf Zustand, Material und gewünschtes Ergebnis ab.
            </p>
            <Button asChild size="lg" className="mt-8 rounded-full">
              <Link to="/" hash="buchung">
                Leistung konfigurieren
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="grid gap-5 md:grid-cols-2">
            {servicePages.map((service, index) => {
              const Icon = icons[index] ?? Sparkles;
              return (
                <article
                  key={service.slug}
                  className="feature-card flex flex-col rounded-3xl p-6 sm:p-8"
                >
                  <div className="flex items-start justify-between gap-4">
                    <Icon aria-hidden className="size-8 text-primary" />
                    <span className="text-xs tracking-[0.2em] text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="eyebrow mt-10">{service.eyebrow}</p>
                  <h2 className="display-sub mt-3 uppercase">{service.name}</h2>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">{service.lead}</p>
                  <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                    {service.benefits.slice(0, 4).map((benefit) => (
                      <li key={benefit} className="flex gap-2 text-xs leading-5 text-foreground/75">
                        <CheckCircle2
                          aria-hidden
                          className="mt-0.5 size-3.5 shrink-0 text-primary"
                        />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/leistungen/$service"
                    params={{ service: service.slug }}
                    className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm text-foreground transition-colors hover:text-primary"
                  >
                    {service.name} ansehen
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <section className="content-auto border-y border-border bg-surface/35">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
              <div>
                <p className="eyebrow">So wählen Sie richtig</p>
                <h2 className="display-section mt-3 uppercase">
                  Nicht mehr als nötig. Genau so viel wie sinnvoll.
                </h2>
              </div>
              <div className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-3">
                {[
                  [
                    "Pflege",
                    "Für regelmäßige Sauberkeit, Werterhalt und ein gepflegtes Gesamtbild.",
                  ],
                  [
                    "Korrektur",
                    "Wenn Waschkratzer, Hologramme oder matte Flächen sichtbar stören.",
                  ],
                  [
                    "Schutz",
                    "Wenn Glanz und pflegeleichte Oberfläche langfristig erhalten bleiben sollen.",
                  ],
                ].map(([title, text]) => (
                  <article key={title} className="bg-background p-6">
                    <h3 className="display-card uppercase">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <ConversionBand
          eyebrow="Noch unsicher?"
          title="Wir finden den sinnvollen Umfang."
          text="Beschreiben Sie uns Zustand und Ziel Ihres Fahrzeugs. Wir ordnen die passende Leistung vor dem Termin ehrlich ein."
        />

        {/* Local-SEO-Matrix: bewusst kompakt und ganz am Seitenende */}
        <section className="content-auto border-t border-border bg-surface/25">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
            <p className="eyebrow">Leistung und Ort</p>
            <h2 className="display-section mt-3 uppercase">Fahrzeugaufbereitung in Ihrer Stadt</h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
              Alle Arbeiten führen wir in unserer Werkstatt in Horb am Neckar aus. Für{" "}
              {pickupCitiesByDistance.length} Städte im Umkreis übernehmen wir Abholung und
              Rückgabe. Öffnen Sie nur die Leistung, die Sie interessiert.
            </p>
            <ServiceCityMatrix />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
