import { createFileRoute, Link } from "@tanstack/react-router";
import { LazyConfigurator } from "@/components/lazy-configurator";
import { PageHero } from "@/components/page-hero";
import {
  extras,
  packageAnchor,
  packages,
  pickupKeramikNote,
  pickupTierSummary,
  vehicleClasses,
  site,
} from "@/data/site";
import { pageHead } from "@/lib/seo";
import { money } from "@/lib/utils";
import { ctaPrimary, PriceLine } from "@/components/ui";

export const Route = createFileRoute("/preise")({
  component: PreisePage,
  head: () =>
    pageHead({
      title: `Preise für Fahrzeugaufbereitung in Horb | ${site.name}`,
      description:
        "Preise Fahrzeugaufbereitung Horb: Basis Pflege ab 149 €, Premium Glanz ab 349 €, High-End Keramik ab 899 € inkl. MwSt.",
      path: "/preise",
      preloadShot: "keramik",
    }),
});

function PreisePage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="keramik"
        alt="Keramikversiegelung von Hand auf dem Lack"
        kicker="Pakete & Preise"
        title="Preise für die Aufbereitung."
        lead={`Drei Pakete in Horb am Neckar: Innenraumreinigung, Lackpolitur oder Keramikversiegelung. Alle Preise sind Endpreise ${site.vatNote}. Fahrzeuggröße und Extras rechnet der Konfigurator sofort mit.`}
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Preise & Pakete" },
        ]}
        actions={
          <Link to="/" hash="buchung" className={ctaPrimary}>
            Termin anfragen
          </Link>
        }
      />
      <div className="section mx-auto max-w-7xl px-4 sm:px-6">
      <ol className="mt-14 divide-y divide-line border-y border-line">
        {packages.map((p, i) => (
          <li key={p.id} id={packageAnchor(p.id)} className="lift gd-pack py-10">
            <p className="ga-num font-display text-sm text-subtle tabular-nums">
              {String(i + 1).padStart(2, "0")}.
            </p>
            <div className="ga-pack-copy">
              <p className="kicker">{p.name}</p>
              <h2 className="heading-2 mt-2">{p.searchLabel}</h2>
              <p className="mt-2 text-sm text-muted">{p.kicker}</p>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">{p.body}</p>
              <ul className="mt-5 space-y-2 text-sm text-muted">
                {p.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-[0.55em] size-1 shrink-0 rounded-full bg-subtle" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/"
                search={{ paket: p.id }}
                hash="buchung"
                className={`${ctaPrimary} mt-6`}
              >
                {p.searchLabel} anfragen
              </Link>
            </div>
            <p className="ga-price min-w-[8.5rem]">
              <span className="flex items-baseline gap-2 lg:justify-end">
                <span className="text-[0.65rem] uppercase tracking-[0.2em] text-subtle">ab </span>
                <span className="font-display text-4xl leading-none tracking-wide tabular-nums">
                  {money(p.price)}
                </span>
                <span className="text-sm text-muted"> €</span>
              </span>
              <span className="mt-2 block text-xs text-subtle">
                {site.vatNote} · {p.duration}
              </span>
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted">
        In der Region gibt es Innenreinigung schon unter 80 € und Politur-Pakete
        um 180 € – oft ohne echte Korrektur. Keramik wird zwischen ein paar
        Hundert und über 1.500 € angeboten. Unsere Startpreise liegen bewusst
        in der Werkstatt-Mitte: Pur 149 €, Signature 349 € mit Innenraum und
        Politur, Keramik 899 € inklusive Vorbereitung. Was darunter liegt,
        spart meist die Arbeit, die den Unterschied macht. Pauschale fünf
        Jahre rechnen wir nicht.
      </p>
      <h2 className="heading-2 mt-20">Fahrzeuggröße</h2>
      <div className="gd-tiles gd-tiles-3 mt-8">
        {vehicleClasses.map((c) => (
          <div key={c.id} className="border border-line p-6">
            <h3 className="font-display text-2xl tracking-wide">{c.label}</h3>
            <p className="mt-2 text-sm text-muted">{c.hint}</p>
            <p className="mt-5 text-xs uppercase tracking-[0.16em] text-subtle">
              {c.factor === 1 ? "Basispreis" : `Faktor ${c.factor.toString().replace(".", ",")}`}
            </p>
          </div>
        ))}
      </div>
      <h2 className="heading-2 mt-20">Zusatzleistungen</h2>
      <p className="mt-4 max-w-2xl text-sm text-muted">
        Alle Beträge {site.vatNote}. Reparaturen nur, wenn sie halten – sonst
        sagen wir vorher nein.
      </p>
      {(["pflege", "reparatur"] as const).map((group) => (
        <div key={group}>
          <h3 className="mt-12 text-xs uppercase tracking-[0.2em] text-subtle">
            {group === "pflege" ? "Pflege & Aufbereitung" : "Reparatur"}
          </h3>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {extras
              .filter((e) => e.group === group)
              .map((e) => (
                <PriceLine
                  key={e.id}
                  name={e.name}
                  hint={e.hint}
                  price={e.price}
                  note={e.inspect ? "nach Prüfung am Fahrzeug" : undefined}
                />
              ))}
          </ul>
        </div>
      ))}
      <p className="mt-6 text-sm text-subtle">
        Hol- und Bringservice: {pickupTierSummary()}. {pickupKeramikNote()}.
        Wenn Verschmutzung oder Lackzustand
        mehr Aufwand bedeuten, stimmen wir das mit Ihnen ab, bevor wir anfangen.
      </p>
      <div id="buchung" className="mt-16">
        <h2 id="buchung-heading" className="mb-8 font-display text-3xl">
          Preis konfigurieren
        </h2>
        <LazyConfigurator eager />
      </div>
      <p className="mt-10 text-sm">
        <Link to="/faq" className="hover:underline">
          Häufige Fragen zu Kosten und Dauer
        </Link>
      </p>
      </div>
    </main>
  );
}
