import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Droplets,
  Gem,
  MapPin,
  ShieldCheck,
  Sofa,
  Sparkles,
} from "lucide-react";

import heroCarAvif from "@/assets/hero-car.avif";
import heroCar from "@/assets/hero-car.jpg";
import heroCarWebp from "@/assets/hero-car.webp";
import { ConversionBand } from "@/components/ConversionBand";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PickupCityGrid } from "@/components/PickupCityGrid";
import { SectionHeading } from "@/components/SectionHeading";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
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
  "Premium-Fahrzeugaufbereitung in Horb: Innenreinigung, Lackkorrektur und Keramikversiegelung mit Hol- und Bringservice. Termin online anfragen.";

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
              "@type": "AutoRepair",
              "@id": `${SITE_URL}/#business`,
              name: company.name,
              url: SITE_URL,
              telephone: "+49 152 33540284",
              email: company.email,
              image: OG_IMAGE,
              logo: absUrl("/wgd-logo-760.webp"),
              priceRange: "€€–€€€",
              address: {
                "@type": "PostalAddress",
                streetAddress: company.street,
                postalCode: "72160",
                addressLocality: "Horb am Neckar-Dettingen",
                addressRegion: "Baden-Württemberg",
                addressCountry: "DE",
              },
              areaServed: pickupCities.map((city) => ({
                "@type": "City",
                name: city.name,
              })),
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

const featureIcons = [Sofa, Sparkles, ShieldCheck, Gem];

function Landing() {
  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only rounded-full bg-primary px-5 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]"
      >
        Direkt zum Inhalt
      </a>
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <ProofStrip />
        <Features />
        <Process />
        <Packages />
        <QualitySpotlight />
        <Booking />
        <PickupAreas />
        <ConversionBand />
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
    <section className="hero-stage relative isolate flex min-h-[44rem] overflow-hidden border-b border-border sm:min-h-[48rem]">
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
          className="size-full object-cover object-[62%_center]"
        />
      </picture>
      <div className="hero-scrim absolute inset-0 -z-10" aria-hidden />
      <div className="grid-lines absolute inset-0 -z-10 opacity-[0.16]" aria-hidden />

      <div className="mx-auto grid w-full max-w-7xl items-end gap-10 px-4 pb-10 pt-20 sm:px-6 sm:pb-14 lg:grid-cols-[minmax(0,1fr)_20rem] lg:pb-20">
        <div className="max-w-4xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-[0.66rem] uppercase tracking-[0.2em] text-white/75 backdrop-blur-md">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_18px_var(--primary)]" />
            Premium Detailing · Horb am Neckar
          </p>
          <h1 className="display-hero mt-6 max-w-4xl text-white">
            Fahrzeugaufbereitung.
            <span className="text-chrome block">Auf Showroom-Niveau.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">
            Tiefenreine Innenräume, korrigierter Lack und langfristiger Keramikschutz – präzise
            ausgeführt und auf Wunsch mit Hol- und Bringservice.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="glow-ring rounded-full px-7">
              <a href="#buchung">
                Termin &amp; Preis anfragen
                <ArrowRight aria-hidden className="size-4" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-white/20 bg-black/20 text-white backdrop-blur-md hover:bg-white hover:text-black"
            >
              <Link to="/leistungen">Leistungen entdecken</Link>
            </Button>
          </div>
          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-xs uppercase tracking-[0.12em] text-white/55">
            {[
              "Transparente Paketpreise",
              "Unverbindliche Anfrage",
              "Termine nach Vereinbarung",
            ].map((item) => (
              <li key={item} className="inline-flex items-center gap-2">
                <CheckCircle2 aria-hidden className="size-3.5 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <dl className="grid grid-cols-3 overflow-hidden rounded-3xl border border-white/12 bg-black/35 backdrop-blur-xl lg:grid-cols-1">
          {[
            [`${pickupCities.length}`, "Städte im Abholgebiet"],
            ["4", "präzise Prozessschritte"],
            ["5 J.", "Keramikschutz möglich"],
          ].map(([value, label], index) => (
            <div
              key={label}
              className={[
                "p-4 text-center lg:p-6 lg:text-left",
                index > 0 ? "border-l border-white/10 lg:border-l-0 lg:border-t" : "",
              ].join(" ")}
            >
              <dt className="display-price text-2xl text-white sm:text-3xl">{value}</dt>
              <dd className="mt-1 text-[0.58rem] uppercase tracking-[0.16em] text-white/50 sm:text-[0.65rem]">
                {label}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function ProofStrip() {
  return (
    <section aria-label="White Gloss Vorteile" className="border-b border-border bg-surface/45">
      <div className="mx-auto grid max-w-7xl divide-y divide-border px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
        {[
          [ShieldCheck, "Materialgerecht", "Verfahren passend zu Oberfläche und Zustand"],
          [Clock3, "Planbar", "Klare Pakete, Zeitrahmen und Terminanfrage"],
          [MapPin, "Regional", `Hol- & Bringservice in ${pickupCities.length} Städten`],
        ].map(([Icon, title, text]) => {
          const ItemIcon = Icon as typeof ShieldCheck;
          return (
            <div key={title as string} className="flex items-center gap-4 py-5 sm:px-6 first:pl-0">
              <ItemIcon aria-hidden className="size-5 shrink-0 text-primary" />
              <div>
                <h2 className="text-sm font-medium text-foreground">{title as string}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{text as string}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section
      id="leistungen"
      className="content-auto mx-auto max-w-7xl scroll-mt-28 px-4 py-24 sm:px-6"
    >
      <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
        <SectionHeading
          eyebrow="Leistungsspektrum"
          title={
            <>
              Präzision, die man
              <span className="text-chrome block">sieht und fühlt.</span>
            </>
          }
          titleClassName="max-w-xl uppercase"
          text="Jede Behandlung beginnt mit dem tatsächlichen Zustand Ihres Fahrzeugs – nicht mit einem starren Standardprogramm."
        />
        <p className="max-w-xl text-sm leading-6 text-muted-foreground lg:ml-auto">
          Von der tiefen Innenraumreinigung über die kontrollierte Lackkorrektur bis zum
          langanhaltenden Oberflächenschutz: Sie wählen den Schwerpunkt, wir stimmen den Ablauf
          darauf ab.
        </p>
      </div>

      <ul className="mt-12 grid gap-4 sm:grid-cols-2">
        {features.map((feature, index) => {
          const Icon = featureIcons[index] ?? Droplets;
          return (
            <li key={feature.id}>
              <Link
                to="/leistungen/$service"
                params={{ service: feature.slug }}
                className="feature-card group relative flex min-h-64 h-full flex-col overflow-hidden rounded-3xl p-6 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-8"
              >
                <span className="absolute right-6 top-5 font-display text-7xl text-white/[0.035]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Icon
                  aria-hidden
                  className="size-7 text-primary transition-transform duration-500 group-hover:scale-110"
                />
                <h3 className="display-sub mt-auto pt-12 uppercase">{feature.name}</h3>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  {feature.text}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm text-foreground">
                  Details ansehen
                  <ArrowRight
                    aria-hidden
                    className="size-4 text-primary transition-transform group-hover:translate-x-1"
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Button asChild variant="outline" size="lg" className="mt-8 rounded-full">
        <Link to="/leistungen">
          Alle Leistungen im Überblick
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </Button>
    </section>
  );
}

function Process() {
  const steps = [
    ["Check-in", "Fahrzeugzustand, Lackbild, Verschmutzung und gewünschtes Ergebnis bewerten."],
    ["Vorbereitung", "Sichere Handwäsche, Dekontamination, Abkleben und Materialvorbereitung."],
    ["Detailing", "Innenraum, Politur, Leder und Spezialleistungen präzise ausführen."],
    ["Finish", "Kontrolle unter Licht, Pflegeabschluss und abgestimmte Fahrzeugübergabe."],
  ];

  return (
    <section className="content-auto border-y border-border bg-surface/35">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <SectionHeading
          eyebrow="Der White-Gloss-Prozess"
          title="Vom Check-in bis zum Finish."
          titleClassName="uppercase"
          text="Vier klare Schritte sorgen dafür, dass Leistung, Zeitrahmen und Ergebnis von Anfang an nachvollziehbar bleiben."
        />
        <ol className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([title, text], index) => (
            <li key={title} className="group bg-background p-6 sm:p-8">
              <span className="text-xs uppercase tracking-[0.2em] text-primary">0{index + 1}</span>
              <h3 className="display-sub mt-8 uppercase">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Packages() {
  return (
    <section className="content-auto mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          eyebrow="Pakete & Preise"
          title="Der passende Umfang für Ihren Anspruch."
          titleClassName="max-w-3xl uppercase"
          text="Startpreise für die Kompaktklasse. Fahrzeuggröße und Extras werden im Konfigurator transparent berechnet."
        />
        <Link
          to="/preise"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-foreground transition-colors hover:text-primary"
        >
          Alle Preise &amp; Extras
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {servicePackages.map((servicePackage, index) => (
          <article
            key={servicePackage.id}
            className={[
              "package-card relative flex h-full flex-col rounded-3xl p-6 sm:p-8",
              servicePackage.highlight ? "package-card-featured" : "",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{servicePackage.tagline}</p>
                <h3 className="display-sub mt-3 uppercase">{servicePackage.name}</h3>
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
              className="mt-8 rounded-full"
            >
              <a href="#buchung">Paket konfigurieren</a>
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

function QualitySpotlight() {
  return (
    <section className="content-auto border-y border-border bg-[#050709]">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_0.86fr] lg:items-center">
        <div>
          <p className="eyebrow">Unser Qualitätsanspruch</p>
          <h2 className="display-section mt-3 max-w-3xl uppercase">
            Keine schnelle Kosmetik.
            <span className="text-chrome block">Ein sichtbar besseres Fahrzeug.</span>
          </h2>
          <p className="mt-6 max-w-2xl leading-7 text-muted-foreground">
            Gute Aufbereitung beginnt mit ehrlicher Beurteilung. Wir wählen Arbeitsschritte nach
            Material, Defektbild und Ihrem Ziel – damit aus Aufwand ein Ergebnis wird, das zum
            Fahrzeug passt.
          </p>
          <Button asChild variant="outline" size="lg" className="mt-8 rounded-full">
            <Link to="/qualitaet">
              So arbeiten wir
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Button>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            ["Zustand vor Standard", "Jedes Fahrzeug wird vorab individuell bewertet."],
            ["Kontrolliertes Licht", "Defekte und Finish werden sichtbar geprüft."],
            ["Klare Kommunikation", "Leistungsumfang und Grenzen bleiben nachvollziehbar."],
            ["Sicheres Finish", "Materialgerechte Produkte und sorgfältige Endkontrolle."],
          ].map(([title, text]) => (
            <div key={title} className="metal-panel rounded-2xl p-5">
              <dt className="display-card uppercase">{title}</dt>
              <dd className="mt-2 text-sm leading-6 text-muted-foreground">{text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Booking() {
  return (
    <section id="buchung" className="content-auto scroll-mt-28 bg-surface/25">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <SectionHeading
          className="mb-12 max-w-3xl"
          eyebrow="Online anfragen"
          title="In fünf Schritten zum Wunschtermin."
          titleClassName="uppercase"
          text="Fahrzeugklasse, Paket und Extras auswählen, Preisübersicht sehen und anschließend die unverbindliche Terminanfrage senden."
        />
        <ErrorBoundary
          title="Der Buchungsassistent konnte nicht geladen werden"
          description="Bitte laden Sie die Seite neu. Alternativ nehmen wir Ihre Anfrage per Telefon, WhatsApp oder E-Mail entgegen."
        >
          <DeferredBookingWizard />
        </ErrorBoundary>
      </div>
    </section>
  );
}

function PickupAreas() {
  return (
    <section
      id="abholservice"
      className="content-auto mx-auto max-w-7xl scroll-mt-28 px-4 py-24 sm:px-6"
    >
      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
        <SectionHeading
          eyebrow="Hol- & Bringservice"
          title="Wir holen Ihr Fahrzeug ab."
          titleClassName="max-w-2xl uppercase"
          text={`In ${pickupCities.length} Städten der Region holen wir Ihr Fahrzeug ab und bringen es nach dem Finish zurück – nach Entfernung ${pickupTierSummary()}, im Paket High-End Keramik inklusive.`}
        />
        <p className="max-w-xl text-sm leading-6 text-muted-foreground lg:ml-auto">
          Kein zusätzlicher Werkstattweg, kein Organisationsstress: Abholung und Rückgabe werden in
          einem klar vereinbarten Zeitfenster geplant.
        </p>
      </div>
      <div className="mt-12">
        <PickupCityGrid cities={pickupCitiesByDistance.slice(0, 6)} />
      </div>
      <Link
        to="/abholservice"
        className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-5 text-sm text-foreground outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        Alle {pickupCities.length} Städte ansehen
        <ArrowRight aria-hidden className="size-4 text-primary" />
      </Link>
    </section>
  );
}
