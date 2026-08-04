import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, CircleGauge, Plus } from "lucide-react";

import { ConversionBand } from "@/components/ConversionBand";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { absUrl, OG_IMAGE, OG_IMAGE_ALT } from "@/lib/seo";
import {
  addOns,
  currency,
  pickupPricing,
  pickupTierSummary,
  servicePackages,
  vatNotice,
  vatNoticeShort,
  vehicleTypes,
} from "@/lib/servicesConfig";

const TITLE = "Preise für Fahrzeugaufbereitung in Horb | White Gloss";
const DESCRIPTION =
  "Transparente Paketpreise für Fahrzeugaufbereitung in Horb: Basis Pflege ab 149 €, Premium Glanz ab 349 € und High-End Keramik ab 899 €.";

export const Route = createFileRoute("/preise")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: absUrl("/preise") },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:alt", content: OG_IMAGE_ALT },
    ],
    links: [
      { rel: "canonical", href: absUrl("/preise") },
      { rel: "alternate", hrefLang: "de-DE", href: absUrl("/preise") },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
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
              <span className="text-foreground">Preise</span>
            </nav>
            <p className="eyebrow mt-10">Pakete &amp; Preise</p>
            <h1 className="display-page mt-3 max-w-5xl uppercase">
              Klarer Umfang.
              <span className="text-chrome block">Transparente Startpreise.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Sie sehen vor Ihrer Anfrage, welche Leistungen enthalten sind. Fahrzeuggröße und
              gewählte Extras werden im Online-Konfigurator direkt berücksichtigt.
            </p>
            <Button asChild size="lg" className="mt-8 rounded-full">
              <Link to="/" hash="buchung">
                Preis konfigurieren
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="grid gap-5 lg:grid-cols-3">
            {servicePackages.map((servicePackage, index) => (
              <article
                key={servicePackage.id}
                className={[
                  "package-card relative flex h-full flex-col rounded-3xl p-6 sm:p-8",
                  servicePackage.highlight ? "package-card-featured" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">{servicePackage.tagline}</p>
                    <h2 className="display-sub mt-3 uppercase">{servicePackage.name}</h2>
                  </div>
                  <span className="text-xs tracking-[0.18em] text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <p className="mt-8">
                  <span className="display-price text-4xl text-foreground">
                    ab {currency(servicePackage.basePrice)}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {vatNoticeShort()} · Kompaktklasse · {servicePackage.duration}
                  </span>
                </p>
                <ul className="mt-8 flex-1 space-y-3">
                  {servicePackage.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm text-foreground/78">
                      <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant={servicePackage.highlight ? "default" : "outline"}
                  className="mt-8 rounded-full"
                >
                  <Link to="/" hash="buchung">
                    Paket auswählen
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        </section>

        <section className="content-auto border-y border-border bg-surface/35">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Fahrzeuggröße</p>
              <h2 className="display-section mt-3 uppercase">Der Aufwand wächst mit der Fläche.</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                Die Paketpreise starten bei der Kompaktklasse. Größere Fahrzeuge benötigen mehr
                Material und Arbeitszeit; der Konfigurator rechnet den Faktor sofort ein.
              </p>
              <div className="mt-8 overflow-hidden rounded-3xl border border-border">
                {vehicleTypes.map((vehicle, index) => (
                  <div
                    key={vehicle.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-border p-5 last:border-b-0"
                  >
                    <div>
                      <h3 className="text-sm font-medium text-foreground">{vehicle.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{vehicle.description}</p>
                    </div>
                    <p className="text-sm text-primary">
                      {index === 0
                        ? "Basispreis"
                        : `Faktor ${vehicle.factor.toLocaleString("de-DE")}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="eyebrow">Zusatzleistungen</p>
              <h2 className="display-section mt-3 uppercase">
                Ergänzen, was Ihr Fahrzeug braucht.
              </h2>
              <div className="mt-8 grid gap-3">
                {addOns.map((addOn) => (
                  <article
                    key={addOn.id}
                    className="metal-panel grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 rounded-2xl p-4"
                  >
                    <span className="grid size-9 place-items-center rounded-full border border-border">
                      <Plus aria-hidden className="size-4 text-primary" />
                    </span>
                    <div>
                      <h3 className="text-sm font-medium text-foreground">{addOn.name}</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {addOn.description}
                      </p>
                    </div>
                    <p className="whitespace-nowrap text-sm text-foreground">
                      {addOn.distanceBased ? "nach Entfernung*" : `ab ${currency(addOn.price)}`}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {vatNoticeShort()}
                      </span>
                    </p>
                  </article>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                {vatNotice()} * Hol- &amp; Bringservice nach Entfernung zur Werkstatt:{" "}
                {pickupTierSummary()}. Im Paket High-End Keramik ist die Abholung bis{" "}
                {pickupPricing.freeUpToKm} km bereits enthalten. Endpreis der übrigen
                Zusatzleistungen abhängig von Fahrzeugklasse und gewähltem Umfang.
              </p>
            </div>
          </div>
        </section>

        <section className="content-auto mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="metal-panel grid gap-6 rounded-3xl p-6 sm:p-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
            <CircleGauge aria-hidden className="size-8 text-primary" />
            <div>
              <h2 className="display-sub uppercase">Warum Startpreise?</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
                Verschmutzung, Lackzustand und Sondermaterialien können den tatsächlichen Aufwand
                verändern. Vor Beginn stimmen wir erkennbare Mehrarbeit mit Ihnen ab – ohne
                überraschende Zusatzpositionen im Nachhinein.
              </p>
            </div>
          </div>
        </section>

        <ConversionBand
          eyebrow="Sofort kalkulieren"
          title="Ihr Paket in wenigen Schritten."
          text="Fahrzeugklasse, Paket und Extras auswählen und den voraussichtlichen Gesamtpreis direkt sehen."
        />
      </main>
      <SiteFooter />
    </div>
  );
}
