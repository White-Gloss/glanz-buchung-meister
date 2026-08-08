import { ClipboardList, Eye, Handshake, MapPin, Shield, Star } from "lucide-react";

const signals = [
  {
    icon: Eye,
    title: "Kontrollierte Beleuchtung",
    text: "Alle Arbeiten unter gleichmäßiger Prüfbeleuchtung für ein nachvollziehbares Finish.",
  },
  {
    icon: ClipboardList,
    title: "Vorab-Check",
    text: "Lack und Innenraum werden vor Arbeitsbeginn gemeinsam gesichtet und bewertet.",
  },
  {
    icon: Handshake,
    title: "Transparente Absprache",
    text: "Erkennbare Mehrarbeit stimmen wir vorher ab – keine überraschenden Zusatzpositionen.",
  },
  {
    icon: MapPin,
    title: "Werkstatt in Horb",
    text: "Regionale Aufbereitungshalle mit Hol- und Bringservice für 13 Städte.",
  },
  {
    icon: Shield,
    title: "Materialgerecht",
    text: "pH-neutrale Reiniger, abgestimmte Polituren und geprüfte Versiegelungssysteme.",
  },
  {
    icon: Star,
    title: "Handarbeit",
    text: "Keine Waschstraße: Jedes Fahrzeug wird von Hand gewaschen, poliert und versiegelt.",
  },
];

export function TrustSignals() {
  return (
    <section
      aria-labelledby="trust-title"
      className="content-auto border-y border-border/60 bg-[#050709]"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="eyebrow">Qualitätsversprechen</p>
        <h2 id="trust-title" className="display-section mt-3 max-w-3xl uppercase">
          Was Ihre Aufbereitung ausmacht.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {signals.map(({ icon: Icon, title, text }) => (
            <article
              key={title}
              className="glass rounded-2xl p-5 transition-colors hover:border-primary/40"
            >
              <Icon className="size-6 text-primary" aria-hidden />
              <h3 className="display-card mt-4 uppercase">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
