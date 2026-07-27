import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
  Car,
  Armchair,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingWizard } from "@/components/BookingWizard";
import { company, features } from "@/lib/servicesConfig";
import logoAsset from "@/assets/wgd-logo.png.asset.json";
import heroCar from "@/assets/hero-car.jpg";
import beforeAfterExterior from "@/assets/before-after-exterior.jpg";
import beforeAfterInterior from "@/assets/before-after-interior.jpg";

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
        <BeforeAfter />
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
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center">
          <img
            src={logoAsset.url}
            alt="White Gloss Detailing Logo"
            className="h-9 w-auto max-w-[150px] shrink-0 object-contain sm:h-12 sm:max-w-[220px] lg:h-14"
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
        alt="Schwarzer Sportwagen mit Hochglanzlack nach der Aufbereitung"
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
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:py-40">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <img
            src={logoAsset.url}
            alt="White Gloss Detailing Logo"
            className="mx-auto mb-8 h-auto w-[min(78vw,260px)] object-contain drop-shadow-[0_18px_50px_rgba(0,82,255,0.35)] sm:w-[340px] lg:w-[420px]"
          />

          <span className="glass inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.2em] sm:px-4 sm:text-xs sm:tracking-[0.25em]">
            <Star className="size-3.5 shrink-0 text-primary" />
            {company.claim}
          </span>
          <h1 className="text-gradient mt-6 font-display text-[1.75rem] leading-[1.1] font-bold text-balance break-words sm:text-5xl sm:leading-[1.05] lg:text-7xl">
            Premium Fahrzeugaufbereitung auf Next-Level Niveau
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Handarbeit, Hightech-Produkte und kompromisslose Detailversessenheit – für einen Glanz,
            der über den Neuwagenzustand hinausgeht.
          </p>
          <div className="mt-9 flex w-full flex-wrap justify-center gap-3">
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
          <dl className="mt-12 grid w-full max-w-lg grid-cols-3 gap-2 sm:mt-14 sm:gap-4">
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

type ComparisonSliderProps = {
  beforeImage: string;
  afterImage: string;
  beforeAlt: string;
  afterAlt: string;
  label: string;
  icon: React.ElementType;
};

function ComparisonSlider({
  beforeImage,
  afterImage,
  beforeAlt,
  afterAlt,
  label,
  icon: Icon,
}: ComparisonSliderProps) {
  const [pos, setPos] = useState(50);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="size-5 text-primary" />
        <h3 className="font-display text-lg font-semibold">{label}</h3>
      </div>
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border">
        {/* Before image (full background) */}
        <img
          src={beforeImage}
          alt={beforeAlt}
          loading="lazy"
          width={1920}
          height={1088}
          className="absolute inset-0 size-full object-cover"
        />
        <span className="absolute bottom-4 left-4 rounded-full bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-foreground backdrop-blur-sm">
          Vorher
        </span>

        {/* After image (clipped by slider position) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          <img
            src={afterImage}
            alt={afterAlt}
            loading="lazy"
            width={1920}
            height={1088}
            className="size-full object-cover"
          />
          <span className="absolute bottom-4 left-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary-foreground">
            Nachher
          </span>
        </div>

        {/* Divider line */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary shadow-[0_0_12px_rgba(0,82,255,0.8)]"
          style={{ left: `${pos}%` }}
        />

        {/* Slider thumb indicator */}
        <div
          className="pointer-events-none absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary bg-background p-1.5 shadow-lg"
          style={{ left: `${pos}%` }}
        >
          <div className="size-2.5 rounded-full bg-primary" />
        </div>

        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          aria-label={`Vorher-Nachher-Regler: ${label}`}
          onChange={(e) => setPos(Number(e.target.value))}
          className="absolute inset-0 size-full cursor-ew-resize opacity-0"
        />
      </div>
    </div>
  );
}

function BeforeAfter() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="glass overflow-hidden rounded-3xl p-5 sm:p-8">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Vorher / Nachher</p>
            <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
              Der Unterschied ist sichtbar
            </h2>
          </div>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Regler ziehen zum Vergleichen
          </span>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <ComparisonSlider
            label="Außenaufbereitung"
            icon={Car}
            beforeImage={beforeAfterExterior}
            afterImage={beforeAfterExterior}
            beforeAlt="Fahrzeug vor der Außenaufbereitung mit verkratzter, matter Lackierung"
            afterAlt="Fahrzeug nach der Außenaufbereitung mit spiegelndem Hochglanzlack"
          />
          <ComparisonSlider
            label="Innenraum-Reinigung"
            icon={Armchair}
            beforeImage={beforeAfterInterior}
            afterImage={beforeAfterInterior}
            beforeAlt="Verschmutzter Innenraum vor der Reinigung"
            afterAlt="Perfekt gereinigter und gepflegter Innenraum nach der Aufbereitung"
          />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-background/80">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <img src={logoAsset.url} alt="White Gloss Detailing" className="h-12 w-auto" />
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
          <p className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            {company.street}, {company.city}
          </p>
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
