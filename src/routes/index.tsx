import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Droplets, Gem, ShieldCheck, Sofa, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BookingWizardSkeleton } from "@/components/skeletons";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const BookingWizard = lazy(() =>
  import("@/components/BookingWizard").then((m) => ({ default: m.BookingWizard })),
);
import { PickupCityGrid } from "@/components/PickupCityGrid";
import { SectionHeading } from "@/components/SectionHeading";

import { pickupCities, pickupCitiesByDistance } from "@/lib/pickupLocations";
import { currency, features, pickupPriceText, servicePackages } from "@/lib/servicesConfig";
import heroCar from "@/assets/hero-car.jpg";
import heroCarWebp from "@/assets/hero-car.webp";
import heroCarAvif from "@/assets/hero-car.avif";
import { absUrl, OG_IMAGE, OG_IMAGE_ALT, SITE_URL } from "@/lib/seo";

const HOME_TITLE = "Fahrzeugaufbereitung Horb am Neckar | White Gloss";
const HOME_DESCRIPTION =
  "Fahrzeugaufbereitung in Horb am Neckar: Innenreinigung, Lackkorrektur und Keramikversiegelung mit Hol- und Bringservice. Jetzt Termin anfragen.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      {
        name: "description",
        content: HOME_DESCRIPTION,
      },
      { property: "og:title", content: HOME_TITLE },
      {
        property: "og:description",
        content: HOME_DESCRIPTION,
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absUrl("/") },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:alt", content: OG_IMAGE_ALT },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: HOME_TITLE },
      {
        name: "twitter:description",
        content: HOME_DESCRIPTION,
      },
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
              name: "White Gloss Detailing",
              inLanguage: "de-DE",
            },
            {
              "@type": "Organization",
              "@id": `${SITE_URL}/#organization`,
              name: "White Gloss Detailing",
              url: SITE_URL,
              email: "info@whitegloss.de",
              logo: absUrl("/wgd-logo-760.webp"),
              areaServed: {
                "@type": "AdministrativeArea",
                name: "Horb am Neckar und Umgebung",
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
        href="#buchung"
        className="sr-only rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100]"
      >
        Direkt zur Buchung springen
      </a>
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <Packages />
        <section id="buchung" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
          <SectionHeading
            className="mb-10 max-w-2xl"
            eyebrow="Online Buchung"
            title="In 5 Schritten zum Termin"
            text="Konfigurieren Sie Ihre Aufbereitung, sehen Sie den voraussichtlichen Gesamtpreis sofort und senden Sie anschließend Ihre Terminanfrage."
          />

          <ErrorBoundary
            title="Der Buchungsassistent konnte nicht geladen werden"
            description="Bitte laden Sie die Seite neu. Alternativ nehmen wir Ihre Anfrage per E-Mail entgegen."
          >
            <DeferredBookingWizard />
          </ErrorBoundary>
        </section>
        <PickupAreas />
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
      { rootMargin: "800px 0px" },
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
  const stats: [string, string][] = [
    [`${pickupCities.length} Städte`, "Abholgebiet"],
    ["Live", "Preiskalkulation"],
    ["Bis 5 Jahre", "Keramikschutz"],
  ];

  return (
    <section className="relative overflow-hidden">
      <div className="grid-lines absolute inset-0 opacity-30" aria-hidden />
      <div
        className="pointer-events-none absolute -top-40 right-0 size-[36rem] rounded-full opacity-[0.14] blur-[130px]"
        style={{ background: "var(--gradient-accent)" }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12">
          {/* Headline-Kachel */}
          <div className="hairline-gold relative overflow-hidden rounded-3xl bg-card/70 p-6 backdrop-blur-xl sm:p-10 lg:col-span-8 lg:row-span-2 lg:p-14">
            <picture>
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
                className="absolute inset-0 size-full object-cover opacity-30"
              />
            </picture>
            <div
              className="absolute inset-0"
              style={{ backgroundImage: "var(--gradient-hero)" }}
              aria-hidden
            />
            <div className="relative flex h-full flex-col justify-center">
              <p className="eyebrow">White Gloss Detailing</p>
              <h1 className="text-gradient display-hero mt-3">
                Fahrzeug&shy;aufbereitung in Horb am Neckar
              </h1>

              <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                Lackkorrektur, Innenraumreinigung und Keramikversiegelung – inklusive Hol- und
                Bringservice in der Region.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild size="lg" className="glow-ring w-full sm:w-auto">
                  <a href="#buchung">
                    Jetzt Termin buchen
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                  <a href="#leistungen">Leistungen ansehen</a>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Transparente Paketpreise · Unverbindliche Terminanfrage
              </p>
            </div>
          </div>

          {/* Leistungs-Kachel */}
          <div className="hairline-gold order-last rounded-3xl bg-card/70 p-6 backdrop-blur-xl sm:p-8 lg:order-none lg:col-span-4">
            <p className="eyebrow">Unsere Schwerpunkte</p>
            <h2 className="display-sub mt-3 uppercase">Pflege, Korrektur und Schutz</h2>
            <ul className="mt-6 space-y-4">
              {[
                "Schonende Innen- und Außenreinigung",
                "Lackkorrektur unter kontrollierter Beleuchtung",
                "Langfristiger Schutz durch Keramikversiegelung",
                "Hol- und Bringservice rund um Horb",
              ].map((item) => (
                <li key={item} className="flex gap-3 text-sm text-foreground/85">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Stat-Kacheln */}
          <dl className="grid grid-cols-3 gap-3 sm:gap-4 lg:col-span-4">
            {stats.map(([v, l]) => (
              <div
                key={l}
                className="hairline-gold flex flex-col items-center justify-center rounded-3xl bg-card/70 px-2 py-6 text-center backdrop-blur-xl transition-colors hover:border-primary/50"
              >
                <dt className="display-price text-xl text-primary sm:text-3xl">{v}</dt>
                <dd className="mt-1 text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.65rem]">
                  {l}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="leistungen" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="Leistungen"
        title="Kompromisslose Qualität in jedem Detail"
        titleClassName="max-w-2xl"
      />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => {
          const Icon = featureIcons[i] ?? Droplets;
          return (
            <li key={f.id}>
              <Link
                to="/leistungen/$service"
                params={{ service: f.slug }}
                className="glass group flex h-full flex-col rounded-2xl p-6 outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon
                  aria-hidden
                  className="size-7 text-primary transition-transform duration-300 group-hover:scale-110"
                />
                <h3 className="display-card mt-5">{f.name}</h3>

                <p className="mt-2 flex-1 text-sm text-muted-foreground">{f.text}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm text-primary">
                  Mehr erfahren
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Packages() {
  return (
    <section className="border-y border-border/60 bg-card/20">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="Pakete & Preise"
          title="Das passende Detail für jeden Anspruch"
          titleClassName="max-w-3xl"
          text="Alle Startpreise gelten für die Kompaktklasse. Im Konfigurator wird der Preis passend zu Fahrzeuggröße und Extras sofort aktualisiert."
        />

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {servicePackages.map((servicePackage) => (
            <article
              key={servicePackage.id}
              className={[
                "relative flex h-full flex-col rounded-3xl border bg-card/70 p-6 backdrop-blur-xl sm:p-7",
                servicePackage.highlight
                  ? "border-primary shadow-[var(--shadow-glow)]"
                  : "border-border",
              ].join(" ")}
            >
              {servicePackage.highlight && (
                <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                  Beliebtestes Paket
                </span>
              )}
              <p className="eyebrow">{servicePackage.tagline}</p>
              <h3 className="display-sub mt-3 uppercase">{servicePackage.name}</h3>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="display-price text-primary">
                  ab {currency(servicePackage.basePrice)}
                </span>
                <span className="text-xs text-muted-foreground">· {servicePackage.duration}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {servicePackage.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm text-foreground/80">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                variant={servicePackage.highlight ? "default" : "outline"}
                className="mt-7"
              >
                <a href="#buchung">Paket konfigurieren</a>
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PickupAreas() {
  return (
    <section id="abholservice" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-20 sm:px-6">
      <SectionHeading
        eyebrow="Abholservice"
        title="Wir holen Ihr Fahrzeug ab – im Umkreis von Horb am Neckar"
        titleClassName="max-w-3xl"
        text={
          <span className="block max-w-2xl">
            Unsere Werkstatt steht in Horb am Neckar. Ihr Fahrzeug holen wir in{" "}
            {pickupCities.length} Städten der Region ab und bringen es veredelt zurück – pauschal
            für {pickupPriceText()}, im Paket High-End Keramik inklusive.
          </span>
        }
      />

      <div className="mt-10">
        <PickupCityGrid cities={pickupCitiesByDistance.slice(0, 6)} />
      </div>
      <Link
        to="/abholservice"
        className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm text-primary outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring active:text-primary/80"
      >
        Alle {pickupCities.length} Städte ansehen
        <ArrowRight className="size-4" />
      </Link>
    </section>
  );
}
