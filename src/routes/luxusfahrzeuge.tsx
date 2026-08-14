import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CarFront,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  Gem,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { luxuryVehicleService } from "@/lib/luxuryVehicles";
import { absUrl, standardPageMeta } from "@/lib/seo";
import { company } from "@/lib/servicesConfig";

const TITLE = "Luxusfahrzeug-Aufbereitung ab 80.000 € | White Gloss";
const DESCRIPTION =
  "Individuelle Premium-Aufbereitung für Luxusfahrzeuge ab ca. 80.000 € Fahrzeugwert. Ausschließlich nach telefonischer Beratung und persönlicher Begutachtung in Horb am Neckar.";

const processSteps = [
  {
    icon: Phone,
    number: "01",
    title: "Persönliches Telefonat",
    text: "Wir sprechen vertraulich über Fahrzeug, Nutzung, Zustand, Anspruch und gewünschten Umfang. Eine Online-Buchung ist für diesen Bereich bewusst nicht möglich.",
  },
  {
    icon: CarFront,
    number: "02",
    title: "Fahrzeug vorführen",
    text: "Das Fahrzeug wird persönlich bei White Gloss vorgestellt. Lack, Karosserie, Materialien und empfindliche Details werden gemeinsam geprüft.",
  },
  {
    icon: ClipboardCheck,
    number: "03",
    title: "Konzept festlegen",
    text: "Erst nach der Begutachtung definieren wir Verfahren, Schutzsysteme, Zeitrahmen und Verantwortlichkeiten – nachvollziehbar und ohne Standardpaket.",
  },
  {
    icon: Sparkles,
    number: "04",
    title: "Individuelle Ausführung",
    text: "Die Arbeit erfolgt ausschließlich im persönlich abgestimmten Umfang. Jede Maßnahme richtet sich nach Material, Historie und Werterhalt des Fahrzeugs.",
  },
];

export const Route = createFileRoute("/luxusfahrzeuge")({
  head: () => ({
    meta: [
      ...standardPageMeta({ title: TITLE, description: DESCRIPTION, path: "/luxusfahrzeuge" }),
    ],
    links: [
      { rel: "canonical", href: absUrl("/luxusfahrzeuge") },
      { rel: "alternate", hrefLang: "de-DE", href: absUrl("/luxusfahrzeuge") },
      { rel: "alternate", hrefLang: "x-default", href: absUrl("/luxusfahrzeuge") },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Individuelle Aufbereitung für Luxusfahrzeuge",
          description: DESCRIPTION,
          url: absUrl("/luxusfahrzeuge"),
          areaServed: "Baden-Württemberg",
          provider: {
            "@type": "AutomotiveBusiness",
            name: company.name,
            telephone: company.phone,
            url: company.web,
          },
        }),
      },
    ],
  }),
  component: LuxuryVehiclesPage,
});

function LuxuryVehiclesPage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="main-content">
        <section className="relative isolate overflow-hidden border-b border-primary/25">
          <div className="grid-lines absolute inset-0 -z-10 opacity-20" aria-hidden />
          <div className="chrome-orb -right-24 -top-32 -z-10" aria-hidden />
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
            <nav aria-label="Brotkrumen" className="text-xs text-muted-foreground">
              <Link to="/" className="transition-colors hover:text-foreground">
                Startseite
              </Link>
              <span aria-hidden className="px-2">
                /
              </span>
              <span className="text-foreground" aria-current="page">
                Luxusfahrzeuge
              </span>
            </nav>

            <div className="mt-10 grid items-end gap-10 lg:grid-cols-[1fr_0.48fr]">
              <div>
                <p className="eyebrow flex items-center gap-2">
                  <Gem aria-hidden className="size-4" /> Private Client Service
                </p>
                <h1 className="display-page mt-3 max-w-5xl uppercase">
                  Außergewöhnliche Fahrzeuge.
                  <span className="text-chrome block">Ohne Standardprogramm.</span>
                </h1>
                <p className="mt-6 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Für Luxus-, Sport- und Sammlerfahrzeuge ab etwa 80.000 € Fahrzeugwert planen wir
                  jede Aufbereitung persönlich. Keine Schnellbuchung, kein pauschales Paket –
                  sondern eine ruhige Begutachtung und ein exakt abgestimmtes Gesamtkonzept.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button asChild size="lg" className="rounded-full">
                    <a href={company.phoneHref}>
                      <Phone aria-hidden className="size-4" /> Persönlich anrufen
                    </a>
                  </Button>
                  <a
                    href="#ablauf"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-6 text-sm text-foreground transition-colors hover:border-primary/50"
                  >
                    Ablauf ansehen <ArrowRight aria-hidden className="size-4" />
                  </a>
                </div>
              </div>

              <aside className="metal-panel rounded-3xl border-primary/30 p-6 sm:p-8">
                <p className="text-xs uppercase tracking-[0.2em] text-primary">
                  Zugang nach Beratung
                </p>
                <p className="display-sub mt-3 uppercase">
                  {luxuryVehicleService.minimumVehicleValueLabel}
                </p>
                <ul className="mt-6 grid gap-3 text-sm text-muted-foreground">
                  {[
                    "Ausschließlich telefonische Erstberatung",
                    "Persönliche Vorstellung des Fahrzeugs erforderlich",
                    "Umfang und Preis erst nach Begutachtung",
                    "Keine Online-Buchung und kein Standardpaket",
                  ].map((item) => (
                    <li key={item} className="flex gap-2.5 leading-6">
                      <CheckCircle2 aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </div>
        </section>

        <section id="ablauf" className="scroll-mt-32 mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <p className="eyebrow">Persönlicher Ablauf</p>
          <h2 className="display-section mt-3 max-w-3xl uppercase">
            Erst verstehen. Dann entscheiden. Danach ausführen.
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {processSteps.map(({ icon: Icon, number, title, text }) => (
              <article key={number} className="feature-card rounded-3xl p-6 sm:p-8">
                <div className="flex items-start justify-between">
                  <Icon aria-hidden className="size-8 text-primary" />
                  <span className="text-xs tracking-[0.2em] text-muted-foreground">{number}</span>
                </div>
                <h3 className="display-card mt-8 uppercase">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-surface/35">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="eyebrow">Warum persönlich?</p>
              <h2 className="display-section mt-3 uppercase">Wert verlangt Verantwortung.</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <article className="rounded-2xl border border-border bg-background p-6">
                <ShieldCheck aria-hidden className="size-7 text-primary" />
                <h3 className="display-card mt-5 uppercase">Materialgerechte Entscheidung</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Sonderlacke, empfindliche Oberflächen, Carbon, Leder und individuelle Umbauten
                  benötigen eine Prüfung am Fahrzeug – nicht nur Fotos oder Modellangaben.
                </p>
              </article>
              <article className="rounded-2xl border border-border bg-background p-6">
                <Gem aria-hidden className="size-7 text-primary" />
                <h3 className="display-card mt-5 uppercase">Diskrete Einzelbetreuung</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Ein fester Ansprechpartner begleitet Beratung, Planung und Ausführung. Details zum
                  Fahrzeug und Auftrag behandeln wir selbstverständlich vertraulich.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="eyebrow">Premium-Pflegesysteme</p>
              <h2 className="display-section mt-3 uppercase">
                Das Produkt folgt dem Fahrzeug. Nicht umgekehrt.
              </h2>
              <p className="mt-5 text-sm leading-6 text-muted-foreground sm:text-base">
                Für besondere Lacke und Materialien wählen wir hochwertige Wachse, Reiniger und
                Schutzsysteme gezielt nach Oberfläche und gewünschtem Finish aus. Dazu können – wenn
                technisch passend – Premium-Produkte etwa von Swissvax gehören.
              </p>
            </div>
            <div className="metal-panel rounded-3xl border-primary/30 p-6 sm:p-8">
              <Droplets aria-hidden className="size-8 text-primary" />
              <h3 className="display-sub mt-6 uppercase">Auswahl nach Material und Ziel</h3>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  "Premium-Carnaubawachse für besondere Lackbilder",
                  "Materialgerechte Leder- und Interieurpflege",
                  "Schonende Produkte für Carbon und Hochglanzflächen",
                  "Individuelle Schutzsysteme statt pauschaler Markenwahl",
                ].map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-6 text-muted-foreground">
                    <CheckCircle2 aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
                Die Nennung von Swissvax beschreibt eine mögliche Produktauswahl und keine
                Herstellerpartnerschaft. Entscheidend ist immer die Eignung für das konkrete
                Fahrzeug.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-surface/20">
          <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
            <p className="eyebrow">Private Client Anfrage</p>
            <h2 className="display-section mt-3 uppercase">Beginnen wir mit einem Gespräch.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Rufen Sie uns an und beschreiben Sie kurz Ihr Fahrzeug sowie Ihr Ziel. Im Gespräch
              klären wir, ob und wann eine persönliche Begutachtung sinnvoll ist.
            </p>
            <Button asChild size="lg" className="mt-8 rounded-full px-8">
              <a href={company.phoneHref}>
                <Phone aria-hidden className="size-4" /> {company.phone}
              </a>
            </Button>
            <p className="mt-4 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Keine Online-Buchung · Termine nach persönlicher Vereinbarung
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
