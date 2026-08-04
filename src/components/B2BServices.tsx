import {
  Building2,
  CarFront,
  CheckCircle2,
  ClipboardCheck,
  Mail,
  MessageCircle,
  Phone,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { company } from "@/lib/servicesConfig";

const services = [
  {
    icon: ClipboardCheck,
    title: "Leasingrückläufer",
    text: "Aufbereitung vor der Rückgabe – mit Fokus auf Sauberkeit, Präsentation und sichtbare Gebrauchsspuren im vereinbarten Leistungsumfang.",
  },
  {
    icon: Truck,
    title: "Flotten- & Fuhrparkpflege",
    text: "Einmalige Flottenreinigung oder planbare Pflegeintervalle für einen dauerhaft professionellen Unternehmensauftritt.",
  },
  {
    icon: Building2,
    title: "Autohäuser & Fahrzeughandel",
    text: "Verkaufs-, Stand- und Auslieferungsaufbereitung für gepflegte Fahrzeuge und einen überzeugenden ersten Eindruck.",
  },
  {
    icon: CarFront,
    title: "Firmen- & Poolfahrzeuge",
    text: "Materialgerechte Innen- und Außenreinigung für Dienstwagen, Poolfahrzeuge, Transporter und gewerblich genutzte Fahrzeuge.",
  },
] as const;

const processSteps = [
  ["Bedarf nennen", "Fahrzeuganzahl, Zustand, Leistungsumfang und gewünschten Turnus mitteilen."],
  ["Angebot erhalten", "Wir kalkulieren den Auftrag passend zu Aufwand, Menge und Logistik."],
  ["Umsetzung planen", "Termine, Übergabe und auf Wunsch Hol- und Bringservice abstimmen."],
] as const;

const whatsappHref = `${company.whatsappHref}?text=${encodeURIComponent(
  "Hallo White Gloss, ich möchte ein individuelles B2B-Angebot für Fahrzeugaufbereitung anfragen.",
)}`;

const emailHref = `mailto:${company.email}?subject=${encodeURIComponent(
  "B2B-Anfrage Fahrzeugaufbereitung",
)}&body=${encodeURIComponent(
  "Hallo White Gloss,\n\nich möchte ein individuelles B2B-Angebot für Fahrzeugaufbereitung anfragen.\n\nUnternehmen:\nFahrzeuganzahl:\nGewünschte Leistung:\nGewünschter Zeitraum:\n",
)}`;

export function B2BServices() {
  return (
    <section
      id="b2b"
      aria-labelledby="b2b-title"
      className="content-auto scroll-mt-28 border-y border-border bg-[#050709]"
    >
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div>
            <p className="eyebrow">B2B · Geschäftskunden</p>
            <h2 id="b2b-title" className="display-section mt-3 max-w-3xl uppercase">
              Gepflegte Fahrzeuge.
              <span className="text-chrome block">Ein professioneller Auftritt.</span>
            </h2>
            <p className="mt-6 max-w-2xl leading-7 text-muted-foreground">
              Für Unternehmen, Autohäuser und Fuhrparks entwickeln wir den passenden Ablauf – vom
              einzelnen Leasingrückläufer bis zur regelmäßig betreuten Fahrzeugflotte.
            </p>

            <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/[0.07] p-5 sm:p-6">
              <p className="display-card uppercase text-foreground">
                Individuelle Kalkulation statt Pauschalpreis
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Für B2B-Aufträge veröffentlichen wir bewusst keine festen Preise. Fahrzeuganzahl,
                Zustand, Leistungsumfang, Turnus und Logistik bestimmen das persönliche Angebot.
              </p>
            </div>

            <p className="mt-7 flex gap-3 text-sm leading-6 text-foreground/80">
              <CheckCircle2 aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
              B2B-Anfragen bitte direkt per Telefon, E-Mail oder WhatsApp stellen.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                asChild
                size="lg"
                className="h-auto whitespace-normal rounded-full px-5 py-3 text-center sm:col-span-2"
              >
                <a href={company.phoneHref}>
                  <Phone aria-hidden className="size-4" />
                  Telefonisch anfragen: {company.phone}
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <MessageCircle aria-hidden className="size-4" />
                  WhatsApp
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <a href={emailHref}>
                  <Mail aria-hidden className="size-4" />
                  E-Mail senden
                </a>
              </Button>
            </div>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {services.map(({ icon: Icon, title, text }, index) => (
              <li
                key={title}
                className="metal-panel relative min-h-60 overflow-hidden rounded-3xl p-6 sm:p-7"
              >
                <span
                  aria-hidden
                  className="absolute right-5 top-3 font-display text-6xl text-white/[0.035]"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Icon aria-hidden className="size-7 text-primary" />
                <h3 className="display-sub mt-12 uppercase">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
        </div>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-3">
          {processSteps.map(([title, text], index) => (
            <li key={title} className="bg-background p-6 sm:p-7">
              <div className="flex gap-4">
                <span className="text-xs tracking-[0.2em] text-primary">0{index + 1}</span>
                <div>
                  <h3 className="display-card uppercase">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
