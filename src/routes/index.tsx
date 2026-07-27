import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Droplets,
  Gem,
  ShieldCheck,
  Sofa,
  Sparkles,
  Star,
  Instagram,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingWizard } from "@/components/BookingWizard";
import { company, features } from "@/lib/servicesConfig";
import logoSm from "@/assets/wgd-logo-440.webp.asset.json";
import logoLg from "@/assets/wgd-logo-760.webp.asset.json";

const LOGO_SRCSET = `${logoSm.url} 440w, ${logoLg.url} 760w`;
const LOGO_ALT =
  "White Gloss Detailing – Logo mit Muscle-Car-Silhouette und dem Claim „No compromises. Only results.“";
import heroCar from "@/assets/hero-car.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "White Gloss Detailing – Premium Fahrzeugaufbereitung in Bonn" },
      {
        name: "description",
        content:
          "Premium Fahrzeugaufbereitung, Lackkorrektur und Keramikversiegelung in Bonn. Termin online buchen und Rechnung sofort als PDF erhalten.",
      },
      { property: "og:title", content: "White Gloss Detailing – Premium Fahrzeugaufbereitung" },
      {
        property: "og:description",
        content:
          "Lackkorrektur, Keramikversiegelung und Innenreinigung auf Next-Level Niveau. Jetzt Termin online buchen.",
      },
    ],
    links: [
      { rel: "preload", as: "image", href: logoSm.url, imageSrcSet: LOGO_SRCSET, imageSizes: "(min-width: 1024px) 340px, (min-width: 640px) 280px, min(64vw, 200px)", fetchpriority: "high" },
    ],
  }),
  component: Landing,
});

const featureIcons = [Sofa, Sparkles, ShieldCheck, Gem];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Features />
        
        <section id="buchung" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Online Buchung</p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-5xl">
              In 5 Schritten zum Termin
            </h2>
            <p className="mt-3 text-muted-foreground">
              Konfigurieren Sie Ihre Aufbereitung – der Preis aktualisiert sich live. Rechnung nach
              deutschem Standard inklusive.
            </p>
          </div>
          <BookingWizard />
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
        <Link to="/" aria-label="White Gloss Detailing – zur Startseite" className="flex min-w-0 items-center">
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
            to="/admin"
            className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
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
  return (
    <section className="relative overflow-hidden">
      <img
        src={heroCar}
        alt=""
        aria-hidden
        width={1920}
        height={1088}
        className="absolute inset-0 size-full object-cover opacity-55"
      />
      <div
        className="absolute inset-0"
        style={{ backgroundImage: "var(--gradient-hero)" }}
        aria-hidden
      />
      <div className="grid-lines absolute inset-0 opacity-40" aria-hidden />
      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl flex-col justify-center px-4 py-14 sm:min-h-[calc(100svh-5.25rem)] sm:px-6 sm:py-20 lg:min-h-[calc(100svh-5.75rem)] lg:py-28">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          <img
            src={logoSm.url}
            srcSet={LOGO_SRCSET}
            sizes="(min-width: 1024px) 340px, (min-width: 640px) 280px, min(64vw, 200px)"
            width={760}
            height={437}
            fetchPriority="high"
            decoding="async"
            alt={LOGO_ALT}
            className="mx-auto mb-5 h-auto w-[min(64vw,200px)] object-contain drop-shadow-[0_18px_50px_rgba(0,82,255,0.35)] sm:mb-7 sm:w-[280px] lg:mb-8 lg:w-[340px]"
          />

          <span className="glass inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.2em] sm:px-4 sm:text-xs sm:tracking-[0.25em]">
            <Star className="size-3.5 shrink-0 text-primary" />
            {company.claim}
          </span>
          <h1 className="text-gradient mt-4 font-display text-[1.75rem] leading-[1.1] font-bold text-balance break-words sm:mt-5 sm:text-5xl sm:leading-[1.05] lg:text-7xl">
            Premium Fahrzeugaufbereitung auf Next-Level Niveau
          </h1>
          <p className="mt-3 max-w-xl text-base text-muted-foreground sm:mt-4 sm:text-lg">
            Handarbeit, Hightech-Produkte und kompromisslose Detailversessenheit – für einen Glanz,
            der über den Neuwagenzustand hinausgeht.
          </p>
          <div className="mt-6 flex w-full flex-wrap justify-center gap-3 sm:mt-7">
            <Button asChild size="lg" className="glow-ring">
              <a href="#buchung">
                Jetzt Termin buchen
                <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#leistungen">Leistungen ansehen</a>
            </Button>
          </div>
          <dl className="mt-9 grid w-full max-w-lg grid-cols-3 gap-2 sm:mt-10 sm:gap-4">
            {[
              ["500+", "Fahrzeuge"],
              ["4.9/5", "Bewertung"],
              ["5 Jahre", "Keramikschutz"],
            ].map(([v, l]) => (
              <div key={l} className="glass rounded-2xl px-2 py-3 sm:px-4">
                <dt className="font-display text-lg font-bold sm:text-2xl">{v}</dt>
                <dd className="text-[0.6rem] uppercase tracking-wider text-muted-foreground sm:text-xs sm:tracking-widest">
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
      <p className="text-xs uppercase tracking-[0.3em] text-primary">Leistungen</p>
      <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold sm:text-5xl">
        Kompromisslose Qualität in jedem Detail
      </h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => {
          const Icon = featureIcons[i] ?? Droplets;
          return (
            <article
              key={f.id}
              className="glass group rounded-2xl p-6 transition-colors hover:border-primary/50"
            >
              <Icon className="size-7 text-primary transition-transform duration-300 group-hover:scale-110" />
              <h3 className="mt-5 font-display text-lg font-semibold">{f.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </article>
          );
        })}
      </div>
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
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-display uppercase tracking-widest text-foreground">Kontakt</p>
          <p className="flex items-center gap-2">
            <Phone className="size-4 text-primary" />
            {company.phone}
          </p>
          <p className="flex items-center gap-2">
            <Mail className="size-4 text-primary" />
            {company.email}
          </p>
          <p className="flex items-center gap-2">
            <Instagram className="size-4 text-primary" />
            {company.instagram}
          </p>
          {company.street && company.city && (
            <p className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" />
              {company.street}, {company.city}
            </p>
          )}
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-display uppercase tracking-widest text-foreground">Rechtliches</p>
          <p>Inhaber: {company.owner}</p>
          <p>Steuernummer: {company.taxNumber}</p>
          <p>USt-IdNr.: {company.taxId}</p>
          <Link to="/admin" className="inline-block pt-2 transition-colors hover:text-foreground">
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
