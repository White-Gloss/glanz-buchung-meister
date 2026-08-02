import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ClipboardCheck, Eye, ShieldCheck, Sparkles } from "lucide-react";

import { ConversionBand } from "@/components/ConversionBand";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { absUrl, OG_IMAGE, OG_IMAGE_ALT } from "@/lib/seo";

const TITLE = "Qualitätsanspruch & Ablauf | White Gloss Detailing";
const DESCRIPTION =
  "So arbeitet White Gloss Detailing: individuelle Zustandsprüfung, sichere Vorbereitung, präzise Aufbereitung und kontrolliertes Finish.";

export const Route = createFileRoute("/qualitaet")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absUrl("/qualitaet") },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:alt", content: OG_IMAGE_ALT },
    ],
    links: [
      { rel: "canonical", href: absUrl("/qualitaet") },
      { rel: "alternate", hrefLang: "de-DE", href: absUrl("/qualitaet") },
    ],
  }),
  component: QualityPage,
});

function QualityPage() {
  const process = [
    {
      title: "Check-in",
      icon: ClipboardCheck,
      text: "Fahrzeugzustand, Lackbild, Verschmutzung und Ziel werden vor Beginn gemeinsam eingeordnet.",
    },
    {
      title: "Vorbereitung",
      icon: ShieldCheck,
      text: "Handwäsche, Dekontamination, Abkleben und Materialvorbereitung schaffen eine sichere Basis.",
    },
    {
      title: "Detailing",
      icon: Sparkles,
      text: "Innenraum, Lack, Kunststoff, Leder und Zusatzleistungen werden nach Paket präzise bearbeitet.",
    },
    {
      title: "Finish",
      icon: Eye,
      text: "Das Ergebnis wird unter kontrolliertem Licht geprüft, nachgearbeitet und sauber übergeben.",
    },
  ];

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
              <span className="text-foreground">Qualität</span>
            </nav>
            <p className="eyebrow mt-10">Unser Qualitätsanspruch</p>
            <h1 className="display-page mt-3 max-w-5xl uppercase">
              Sorgfalt ist kein Extra.
              <span className="text-chrome block">Sie ist der Standard.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Ein hochwertiges Ergebnis entsteht nicht durch ein einzelnes Produkt, sondern durch
              saubere Vorbereitung, passende Verfahren und konsequente Kontrolle.
            </p>
            <Button asChild size="lg" className="mt-8 rounded-full">
              <Link to="/" hash="buchung">
                Fahrzeug anfragen
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="eyebrow">Der Prozess</p>
              <h2 className="display-section mt-3 uppercase">
                Vier Schritte. Ein klares Ergebnis.
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-6 text-muted-foreground">
                Jeder Schritt hat eine Aufgabe: Risiken reduzieren, Qualität sichtbar machen und das
                vereinbarte Ziel kontrolliert erreichen.
              </p>
            </div>
            <ol className="grid gap-4 sm:grid-cols-2">
              {process.map(({ title, icon: Icon, text }, index) => (
                <li key={title} className="feature-card rounded-3xl p-6">
                  <div className="flex items-start justify-between gap-4">
                    <Icon aria-hidden className="size-7 text-primary" />
                    <span className="text-xs tracking-[0.18em] text-muted-foreground">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="display-sub mt-10 uppercase">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="content-auto border-y border-border bg-surface/35">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
            <p className="eyebrow">Was Sie erwarten dürfen</p>
            <h2 className="display-section mt-3 max-w-3xl uppercase">
              Nachvollziehbare Arbeit statt leerer Versprechen.
            </h2>
            <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-2">
              {[
                [
                  "Individuelle Beurteilung",
                  "Materialien, Verschmutzung und Defektbild bestimmen den sinnvollen Arbeitsumfang.",
                ],
                [
                  "Materialgerechte Verfahren",
                  "Werkzeug und Reiniger werden passend zur Oberfläche und zum Ausgangszustand gewählt.",
                ],
                [
                  "Realistische Ergebnisse",
                  "Wir benennen Grenzen, bevor unnötiger Materialabtrag oder falsche Erwartungen entstehen.",
                ],
                [
                  "Kontrolliertes Finish",
                  "Kritische Bereiche werden nachgearbeitet und das Gesamtbild vor Übergabe abschließend geprüft.",
                ],
              ].map(([title, text]) => (
                <article key={title} className="bg-background p-6 sm:p-8">
                  <h3 className="flex items-center gap-3 text-sm font-medium text-foreground">
                    <CheckCircle2 aria-hidden className="size-4 shrink-0 text-primary" />
                    {title}
                  </h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="content-auto mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="eyebrow">Ehrliche Einordnung</p>
              <h2 className="display-section mt-3 uppercase">
                Nicht jeder Kratzer ist polierbar. Nicht jeder Schutz hält ohne Pflege.
              </h2>
              <p className="mt-5 max-w-2xl leading-7 text-muted-foreground">
                Professionelle Aufbereitung bedeutet auch, Grenzen klar zu benennen. Tiefe
                Lackschäden, strukturelle Lederdefekte oder dauerhaft verfärbte Materialien
                benötigen gegebenenfalls eine Reparatur statt reiner Pflege. Wir unterscheiden das
                vor Arbeitsbeginn.
              </p>
            </div>
            <div className="metal-panel rounded-3xl p-6 sm:p-8">
              <p className="eyebrow">Unser Grundsatz</p>
              <blockquote className="display-sub mt-4 uppercase">
                So intensiv wie nötig. So materialschonend wie möglich.
              </blockquote>
            </div>
          </div>
        </section>

        <ConversionBand
          eyebrow="Ihr Fahrzeug im Mittelpunkt"
          title="Lassen Sie uns Zustand und Ziel einordnen."
          text="Senden Sie Ihre Terminanfrage oder sprechen Sie direkt mit uns über den passenden Umfang."
        />
      </main>
      <SiteFooter />
    </div>
  );
}
