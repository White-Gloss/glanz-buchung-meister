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
    text: "Aufbereitung vor der Rückgabe – für ein gepflegtes Erscheinungsbild und die fachgerechte Behandlung sichtbarer Gebrauchsspuren im vereinbarten Umfang.",
  },
  {
    icon: Truck,
    title: "Flotten- & Fuhrparkreinigung",
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
      className="content-auto scroll-mt-32 border-y border-border bg-[#050709]"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="eyebrow">B2B · Geschäftskunden</p>
            <h2 id="b2b-title" className="display-section mt-3 max-w-3xl uppercase">
              Gepflegte Fahrzeuge.{" "}
              <span className="text-chrome block">Ein professioneller Auftritt.</span>
            </h2>
            <p className="mt-6 max-w-2xl leading-7 text-muted-foreground">
              Für Unternehmen, Autohäuser und Fuhrparks entwickeln wir den passenden Ablauf – vom
              einzelnen Leasingrückläufer bis zur regelmäßig betreuten Fahrzeugflotte.
            </p>

            <div className="mt-8 border-y border-primary/30 bg-primary/[0.045] px-1 py-5 sm:px-5">
              <p className="display-card uppercase text-foreground">
                Individuelle Kalkulation statt Pauschalpreis
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Für B2B-Aufträge gibt es keine festen Pauschalpreise. Jeder Preis wird je nach
                Fahrzeuganzahl, Zustand, Leistungsumfang, Turnus und Logistik individuell
                kalkuliert.
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
                className="h-auto whitespace-normal rounded-lg px-5 py-3 text-center sm:col-span-2"
              >
                <a href={company.phoneHref}>
                  <Phone aria-hidden className="size-4" />
                  Telefonisch anfragen: {company.phone}
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-lg">
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <MessageCircle aria-hidden className="size-4" />
                  WhatsApp
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-lg">
                <a href={emailHref}>
                  <Mail aria-hidden className="size-4" />
                  E-Mail senden
                </a>
              </Button>
            </div>
          </div>

          <ul className="border-y border-border">
            {services.map(({ icon: Icon, title, text }, index) => (
              <li
                key={title}
                className="grid gap-5 border-b border-border py-6 last:border-b-0 sm:grid-cols-[3rem_minmax(0,1fr)] sm:items-start sm:py-7"
              >
                <div className="flex items-center gap-3 sm:block">
                  <span className="text-[0.62rem] tracking-[0.2em] text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Icon aria-hidden className="mt-0 size-5 text-primary sm:mt-3" />
                </div>
                <div>
                  <h3 className="display-sub uppercase">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
