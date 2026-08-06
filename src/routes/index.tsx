import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Camera, CheckCircle2, MapPin } from "lucide-react";

import heroCarAvif from "@/assets/hero-car.avif";
import heroCar from "@/assets/hero-car.jpg";
import heroCarWebp from "@/assets/hero-car.webp";
import { B2BServices } from "@/components/B2BServices";
import { ConversionBand } from "@/components/ConversionBand";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SectionHeading } from "@/components/SectionHeading";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { VehicleGallery } from "@/components/VehicleGallery";
import { BookingWizardSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { pickupCities, pickupCitiesByDistance } from "@/lib/pickupLocations";
import { absUrl, OG_IMAGE, OG_IMAGE_ALT, SITE_URL } from "@/lib/seo";
import {
  company,
  currency,
  features,
  pickupTierSummary,
  vatNoticeShort,
  servicePackages,
} from "@/lib/servicesConfig";

const BookingWizard = lazy(() =>
  import("@/components/BookingWizard").then((module) => ({ default: module.BookingWizard })),
);

const HOME_TITLE = "Fahrzeugaufbereitung Horb am Neckar | White Gloss";
const HOME_DESCRIPTION =
  "Premium-Fahrzeugaufbereitung in Horb am Neckar: Innenreinigung, Lackkorrektur, Keramikversiegelung und Hol- und Bringservice. Termin anfragen.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESCRIPTION },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absUrl("/") },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:alt", content: OG_IMAGE_ALT },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: HOME_DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "canonical", href: absUrl("/") },
      { rel: "alternate", hrefLang: "de-DE", href: absUrl("/") },
      {
        rel: "preload",
        as: "image",
        href: heroCarAvif,
        type: "image/avif",
        fetchPriority: "high",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              url: SITE_URL,
              name: company.name,
              inLanguage: "de-DE",
            },
            {
              "@type": "AutomotiveBusiness",
              "@id": `${SITE_URL}/#business`,
              name: company.name,
              url: SITE_URL,
              telephone: company.phoneHref.replace("tel:", ""),
              email: company.email,
              image: OG_IMAGE,
              logo: absUrl("/wgd-logo-760.webp"),
              priceRange: "€€–€€€",
              address: {
                "@type": "PostalAddress",
                streetAddress: company.street,
                postalCode: "72160",
                addressLocality: "Horb am Neckar",
                addressRegion: "Baden-Württemberg",
                addressCountry: "DE",
              },
              areaServed: pickupCities.map((city) => ({
                "@type": "City",
                name: city.name,
              })),
              openingHoursSpecification: {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                opens: "09:00",
                closes: "17:00",
              },
              hasOfferCatalog: {
                "@type": "OfferCatalog",
                name: "Fahrzeugaufbereitung",
                itemListElement: features.map((feature) => ({
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: feature.name,
                    url: absUrl(`/leistungen/${feature.slug}`),
                  },
                })),
              },
            },
          ],
        }),
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <ProofStrip />
        <Packages />
        <VehicleGallery />
        <QualityJourney />
        <Booking />
        <B2BServices />
        <ConversionBand variant="band" />
        <DiscoveryHub />
      </main>
      <SiteFooter />
    </div>
  );
}

function DeferredBookingWizard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || shouldLoad) return;
    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={containerRef}>
      {shouldLoad ? (
        <Suspense fallback={<BookingWizardSkeleton />}>
          <BookingWizard />
        </Suspense>
      ) : (
        <BookingWizardSkeleton />
      )}
    </div>
  );
}

function Hero() {
  return (
    <section className="hero-stage relative isolate flex min-h-[42rem] overflow-hidden border-b border-border sm:min-h-[46rem] lg:min-h-[calc(100svh-7.25rem)]">
      <picture className="absolute inset-0 -z-20">
        <source srcSet={heroCarAvif} type="image/avif" />
        <source srcSet={heroCarWebp} type="image/webp" />
        <img
          src={heroCar}
          alt=""
          aria-hidden
          width={1920}
          height={1088}
          decoding="async"
          loading="eager"
          fetchPriority="high"
          className="size-full object-cover object-[62%_center] lg:object-[66%_center]"
        />
      </picture>
      <div className="hero-scrim absolute inset-0 -z-10" aria-hidden />

      <div className="mx-auto flex w-full max-w-7xl items-center px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
        <div className="max-w-3xl">
          <h1 className="display-hero max-w-3xl text-white">
            Fahrzeugaufbereitung.
            <span className="text-chrome block">Kein Kompromiss. Sichtbare Ergebnisse.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
            Premium-Fahrzeugaufbereitung für einen tiefenreinen Innenraum, klaren Lack und
            langfristigen Schutz – präzise ausgeführt in Horb am Neckar.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="glow-ring rounded-lg px-7">
              <a href="#buchung">
                Termin &amp; Preis anfragen
                <ArrowRight aria-hidden className="size-4" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-lg border-white/25 bg-black/20 text-white backdrop-blur-md hover:bg-white hover:text-black"
            >
              <Link to="/preise">Pakete &amp; Preise</Link>
            </Button>
          </div>
          <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[0.66rem] uppercase tracking-[0.14em] text-white/58 sm:text-xs">
            {["Klare Startpreise", "Unverbindliche Anfrage", "Hol- & Bringservice"].map(
              (item, index) => (
                <li key={item} className="inline-flex items-center gap-2">
                  {index > 0 && <span aria-hidden className="size-1 rounded-full bg-primary" />}
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ProofStrip() {
  return (
    <section aria-label="White Gloss Vorteile" className="border-b border-border bg-surface/45">
      <div className="mx-auto grid max-w-7xl divide-y divide-border px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
        {[
          ["Materialgerecht", "Verfahren passend zu Oberfläche und Zustand"],
          ["Planbar", "Klare Pakete, Zeitrahmen und Terminanfrage"],
          ["Regional", `Hol- & Bringservice in ${pickupCities.length} Städten`],
        ].map(([title, text], index) => (
          <div key={title} className="py-5 sm:px-6 first:pl-0">
            <div className="flex items-baseline gap-3">
              <span className="text-[0.62rem] tracking-[0.2em] text-primary">0{index + 1}</span>
              <h2 className="text-sm font-medium text-foreground">{title}</h2>
            </div>
            <p className="mt-1 pl-8 text-xs text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Packages() {
  return (
    <section className="content-auto mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          eyebrow="Pakete & Preise"
          title="Drei klare Pakete. Ein sichtbarer Unterschied."
          titleClassName="max-w-3xl uppercase"
          text="Wählen Sie einen sinnvollen Ausgangspunkt. Fahrzeuggröße und Extras werden im Konfigurator transparent berechnet."
        />
        <Link
          to="/preise"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-foreground transition-colors hover:text-primary"
        >
          Alle Preise &amp; Extras
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>

      <div className="mt-12 grid overflow-hidden border-y border-border lg:grid-cols-3 lg:divide-x lg:divide-border">
        {servicePackages.map((servicePackage, index) => (
          <article
            key={servicePackage.id}
            className={[
              "relative flex h-full flex-col border-b border-border px-1 py-8 last:border-b-0 sm:px-7 lg:border-b-0 lg:py-10",
              servicePackage.highlight ? "bg-primary/[0.035]" : "",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.62rem] uppercase tracking-[0.18em] text-primary">
                  {servicePackage.tagline}
                </p>
                <h3 className="display-sub mt-4 uppercase">{servicePackage.name}</h3>
              </div>
              <span className="text-xs text-muted-foreground">0{index + 1}</span>
            </div>
            <p className="mt-7 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="display-price text-3xl text-foreground">
                ab {currency(servicePackage.basePrice)}
              </span>
              <span className="text-xs text-muted-foreground">
                {vatNoticeShort()} · {servicePackage.duration}
              </span>
            </p>
            <ul className="mt-7 flex-1 space-y-3">
              {servicePackage.features.map((feature) => (
                <li key={feature} className="flex gap-3 text-sm text-foreground/78">
                  <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              variant={servicePackage.highlight ? "default" : "outline"}
              className="mt-8 rounded-lg"
            >
              <a href="#buchung">Paket konfigurieren</a>
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

function QualityJourney() {
  const steps = [
    ["Check-in", "Zustand, Material und gewünschtes Ergebnis gemeinsam einordnen."],
    ["Vorbereitung", "Sicher reinigen, dekontaminieren und empfindliche Bereiche schützen."],
    ["Detailing", "Die vereinbarten Arbeiten konzentriert und materialgerecht ausführen."],
    ["Finish", "Ergebnis unter kontrolliertem Licht prüfen und sauber übergeben."],
  ];

  return (
    <section className="content-auto border-y border-border bg-[#050709]">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
        <div className="lg:sticky lg:top-32">
          <p className="eyebrow">Der White-Gloss-Prozess</p>
          <h2 className="display-section mt-3 max-w-3xl uppercase">
            Ein klarer Ablauf.
            <span className="text-chrome block">Keine Überraschungen.</span>
          </h2>
          <p className="mt-6 max-w-2xl leading-7 text-muted-foreground">
            Gute Aufbereitung beginnt mit einer ehrlichen Beurteilung. Jeder Schritt folgt dem
            tatsächlichen Zustand Ihres Fahrzeugs – vom ersten Blick bis zur Endkontrolle.
          </p>
          <Button asChild variant="outline" size="lg" className="mt-8 rounded-lg">
            <Link to="/qualitaet">
              Unser Qualitätsanspruch
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
        </div>
        <ol className="border-y border-border bg-background/35">
          {steps.map(([title, text], index) => (
            <li
              key={title}
              className="grid gap-4 border-b border-border p-6 last:border-b-0 sm:grid-cols-[3rem_minmax(0,1fr)] sm:items-start sm:p-7"
            >
              <span className="text-xs tracking-[0.22em] text-primary">0{index + 1}</span>
              <div>
                <h3 className="display-sub uppercase">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Booking() {
  return (
    <section id="buchung" className="content-auto scroll-mt-28 bg-surface/25">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading
          className="mb-12 max-w-3xl"
          eyebrow="Online anfragen"
          title="Ihr Termin. Klar konfiguriert."
          titleClassName="uppercase"
          text="Fahrzeugklasse, Paket und Extras auswählen, Preisübersicht sehen und anschließend die unverbindliche Terminanfrage senden."
        />
        <ErrorBoundary
          title="Der Buchungsassistent konnte nicht geladen werden"
          description="Bitte laden Sie die Seite neu. Alternativ nehmen wir Ihre Anfrage per Telefon, WhatsApp oder E-Mail entgegen."
        >
          <DeferredBookingWizard />
        </ErrorBoundary>

        {/*
          Zweiter Weg für alle, die vor der Buchung erst eine Einschätzung
          möchten: Fotos hochladen statt Paket auswählen.
        */}
        <div className="glass mt-10 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="display-card uppercase">Unsicher, was Ihr Fahrzeug braucht?</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Schicken Sie uns Fotos und eine kurze Beschreibung des Zustands. Wir sehen es uns an
              und sagen Ihnen ehrlich, was sinnvoll ist — kostenlos und unverbindlich.
            </p>
          </div>
          <Button asChild size="lg" variant="outline" className="shrink-0 gap-2">
            <Link to="/fahrzeug-zustand">
              <Camera aria-hidden className="size-4 text-primary" />
              Zustand prüfen lassen
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function DiscoveryHub() {
  return (
    <section
      aria-labelledby="discovery-title"
      className="content-auto border-t border-border bg-surface/25"
    >
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Gezielt weiterfinden</p>
            <h2 id="discovery-title" className="display-section mt-3 uppercase">
              Leistung oder Abholort wählen.
            </h2>
          </div>
          <p className="max-w-lg text-sm leading-6 text-muted-foreground">
            Detaillierte Informationen liegen bewusst auf eigenen Seiten, damit diese Startseite
            ruhig und übersichtlich bleibt.
          </p>
        </div>

        <div className="mt-8 grid border-y border-border lg:grid-cols-[0.82fr_1.18fr] lg:divide-x lg:divide-border">
          <div className="py-6 lg:pr-10">
            <div className="flex items-center justify-between gap-4">
              <h3 className="display-card uppercase">Leistungen</h3>
              <Link
                to="/leistungen"
                className="inline-flex min-h-10 items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                Alle ansehen
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {features.map((feature) => (
                <li key={feature.slug}>
                  <Link
                    to="/leistungen/$service"
                    params={{ service: feature.slug }}
                    className="group flex min-h-12 items-center justify-between gap-3 rounded-lg px-1 text-sm text-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {feature.name}
                    <ArrowRight
                      aria-hidden
                      className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-border py-6 lg:border-t-0 lg:pl-10">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="display-card uppercase">Hol- &amp; Bringservice</h3>
              <span className="text-xs text-muted-foreground">
                {pickupCities.length} Städte · {pickupTierSummary()}
              </span>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-5 sm:grid-cols-3 xl:grid-cols-4">
              {pickupCitiesByDistance.map((city) => (
                <li key={city.slug}>
                  <Link
                    to="/abholservice/$city"
                    params={{ city: city.slug }}
                    className="group flex min-h-10 items-center gap-1.5 border-b border-border text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MapPin aria-hidden className="size-3 text-primary" />
                    {city.short}
                    <ArrowRight
                      aria-hidden
                      className="ml-auto size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    />
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/abholservice"
              className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm text-foreground transition-colors hover:text-primary"
            >
              Abholservice &amp; Entfernungspreise
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
