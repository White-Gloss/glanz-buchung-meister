import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Droplets,
  Gem,
  ShieldCheck,
  Sofa,
  Sparkles,
  Instagram,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BookingWizardSkeleton } from "@/components/skeletons";

const BookingWizard = lazy(() =>
  import("@/components/BookingWizard").then((m) => ({ default: m.BookingWizard })),
);
import { PickupCityGrid } from "@/components/PickupCityGrid";
import { SectionHeading } from "@/components/SectionHeading";

import { pickupCities } from "@/lib/pickupLocations";
import { company, features,
  pickupPriceText,
} from "@/lib/servicesConfig";

import logoSm from "@/assets/wgd-logo-440.webp.asset.json";
import logoLg from "@/assets/wgd-logo-760.webp.asset.json";

const LOGO_SRCSET = `${logoSm.url} 440w, ${logoLg.url} 760w`;
const LOGO_ALT =
  "White Gloss Detailing – Logo mit Muscle-Car-Silhouette und dem Claim „No compromises. Only results.“";
import heroCar from "@/assets/hero-car.jpg";
import heroCarWebp from "@/assets/hero-car.webp";
import heroCarAvif from "@/assets/hero-car.avif";
import { absUrl, OG_IMAGE, OG_IMAGE_ALT } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "White Gloss Detailing – Fahrzeugaufbereitung Horb am Neckar" },
      {
        name: "description",
        content:
          "Premium Fahrzeugaufbereitung, Lackkorrektur und Keramikversiegelung in Horb am Neckar – inkl. Abholservice. Termin online buchen, Rechnung sofort als PDF.",
      },
      { property: "og:title", content: "White Gloss Detailing – Premium Fahrzeugaufbereitung" },
      {
        property: "og:description",
        content:
          "Lackkorrektur, Keramikversiegelung und Innenreinigung auf Next-Level Niveau. Jetzt Termin online buchen.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absUrl("/") },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:alt", content: OG_IMAGE_ALT },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "White Gloss Detailing – Premium Fahrzeugaufbereitung" },
      {
        name: "twitter:description",
        content:
          "Lackkorrektur, Keramikversiegelung und Innenreinigung auf Next-Level Niveau. Jetzt Termin online buchen.",
      },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "canonical", href: absUrl("/") },
      { rel: "preload", as: "image", href: logoSm.url, imageSrcSet: LOGO_SRCSET, imageSizes: "(min-width: 1024px) 340px, (min-width: 640px) 280px, min(64vw, 200px)", fetchPriority: "high" },
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
      <Header />
      <main>
        <Hero />
        <Features />
        <PickupAreas />

        
        <section id="buchung" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
          <SectionHeading
            className="mb-10 max-w-2xl"
            eyebrow="Online Buchung"
            title="In 5 Schritten zum Termin"
            text="Konfigurieren Sie Ihre Aufbereitung – der Preis aktualisiert sich live. Rechnung nach deutschem Standard inklusive."
          />

          <ErrorBoundary
            title="Der Buchungsassistent konnte nicht geladen werden"
            description="Bitte laden Sie die Seite neu. Alternativ nehmen wir Ihre Anfrage gerne telefonisch oder per E-Mail entgegen."
          >
            <Suspense fallback={<BookingWizardSkeleton />}>
              <BookingWizard />
            </Suspense>
          </ErrorBoundary>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <Link to="/" aria-label="White Gloss Detailing – zur Startseite" className="flex min-h-11 min-w-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <img
            src={logoSm.url}
            srcSet={LOGO_SRCSET}
            sizes="(min-width: 640px) 220px, 160px"
            width={440}
            height={253}
            decoding="async"
            alt=""
            aria-hidden
            className="h-10 w-auto max-w-[160px] shrink-0 object-contain sm:h-13 sm:max-w-[220px] lg:h-15"
          />
        </Link>

        <nav className="flex shrink-0 items-center gap-2">
          <Link
            to="/abholservice"
            className="hidden min-h-11 items-center rounded-lg px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:text-primary sm:flex"
          >
            Abholservice
          </Link>
          <Link

            to="/admin"
            className="hidden min-h-11 items-center rounded-lg px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:text-primary sm:flex"
          >
            Admin
          </Link>
          <Button asChild size="sm">
            <a href="#buchung">Termin buchen</a>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  const stats: [string, string][] = [
    ["500+", "Fahrzeuge veredelt"],
    ["4.9/5", "Bewertung"],
    ["5 Jahre", "Keramikschutz"],
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
                fetchPriority="low"
                className="absolute inset-0 size-full object-cover opacity-30"
              />
            </picture>
            <div
              className="absolute inset-0"
              style={{ backgroundImage: "var(--gradient-hero)" }}
              aria-hidden
            />
            <div className="relative flex h-full flex-col justify-center">
              <h1 className="text-gradient display-hero">
                Premium Fahrzeug&shy;aufbereitung auf Next-Level Niveau
              </h1>


              <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                Handarbeit, Hightech-Produkte und kompromisslose Detailversessenheit – für einen
                Glanz, der über den Neuwagenzustand hinausgeht.
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
                Unverbindliche Anfrage · Antwort innerhalb von 24 Stunden
              </p>
            </div>
          </div>

          {/* Logo-Kachel */}
          <div className="hairline-gold order-last flex items-center justify-center rounded-3xl bg-card/70 p-6 backdrop-blur-xl sm:p-8 lg:order-none lg:col-span-4">
            <img
              src={logoSm.url}
              srcSet={LOGO_SRCSET}
              sizes="(min-width: 1024px) 280px, (min-width: 640px) 260px, min(60vw, 200px)"
              width={760}
              height={437}
              fetchPriority="high"
              decoding="async"
              alt={LOGO_ALT}
              className="h-auto w-[min(60vw,200px)] object-contain drop-shadow-[0_18px_50px_rgba(201,168,76,0.28)] sm:w-[260px] lg:w-[280px]"
            />
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
            <li
              key={f.id}
              className="glass group rounded-2xl p-6 transition-colors hover:border-primary/50"
            >
              <Icon
                aria-hidden
                className="size-7 text-primary transition-transform duration-300 group-hover:scale-110"
              />
              <h3 className="display-card mt-5">{f.name}</h3>

              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </li>
          );
        })}
      </ul>
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
        <PickupCityGrid />
      </div>
      <Link
        to="/abholservice"
        className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm text-primary outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring active:text-primary/80"
      >
        Alles zum Abholservice
        <ArrowRight className="size-4" />
      </Link>
    </section>
  );
}


function Footer() {
  return (
    <footer className="border-t border-border bg-background/80">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <img
            src={logoSm.url}
            width={440}
            height={253}
            loading="lazy"
            decoding="async"
            alt=""
            aria-hidden
            className="h-12 w-auto"
          />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            {company.name} – {company.claim}
          </p>
        </div>
        <address className="space-y-2 text-sm not-italic text-muted-foreground">
          <h2 className="label-caps text-foreground">Kontakt</h2>
          <p className="flex items-center gap-2">
            <Phone aria-hidden className="size-4 text-primary" />
            {company.phone}
          </p>
          <p className="flex items-center gap-2">
            <Mail aria-hidden className="size-4 text-primary" />
            {company.email}
          </p>
          <p className="flex items-center gap-2">
            <Instagram aria-hidden className="size-4 text-primary" />
            {company.instagram}
          </p>
          {company.street && company.city && (
            <p className="flex items-center gap-2">
              <MapPin aria-hidden className="size-4 text-primary" />
              {company.street}, {company.city}
            </p>
          )}
        </address>
        <div className="space-y-2 text-sm text-muted-foreground">
          <h2 className="label-caps text-foreground">Rechtliches</h2>
          <p>Inhaber: {company.owner}</p>
          <p>Steuernummer: {company.taxNumber}</p>
          <p>USt-IdNr.: {company.taxId}</p>
          <Link
            to="/admin"
            className="inline-flex min-h-11 items-center rounded-lg pt-2 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            Admin-Bereich
          </Link>
        </div>
      </div>
      <div className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {company.name}. Alle Rechte vorbehalten.
      </div>
    </footer>
  );
}
