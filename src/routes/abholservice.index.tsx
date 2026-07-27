import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Car, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PickupCityGrid } from "@/components/PickupCityGrid";
import { buildOverviewJsonLd, homeBase, pickupCities } from "@/lib/pickupLocations";
import { company } from "@/lib/servicesConfig";

const TITLE = "Abholservice Fahrzeugaufbereitung | Horb & Umgebung";
const DESCRIPTION =
  "Wir holen Ihr Fahrzeug in 13 Städten rund um Horb am Neckar ab, bereiten es professionell auf und bringen es zurück. Jetzt Abholtermin anfragen.";

export const Route = createFileRoute("/abholservice/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/abholservice" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/abholservice" }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(buildOverviewJsonLd()) },
    ],
  }),
  component: PickupOverview,
});

function PickupOverview() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="grid-lines absolute inset-0 opacity-30" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <nav aria-label="Brotkrumen" className="text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Startseite
            </Link>
            <span className="px-2">/</span>
            <span className="text-foreground">Abholservice</span>
          </nav>
          <p className="mt-6 text-xs uppercase tracking-[0.3em] text-primary">
            Hol- & Bringservice
          </p>
          <h1 className="text-gradient display-page mt-3 max-w-4xl">
            Fahrzeugaufbereitung mit Abholservice rund um Horb am Neckar
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Unsere Werkstatt steht in {homeBase.city} ({homeBase.region}). Ihr Fahrzeug muss
            trotzdem nicht zu uns fahren: Wir holen es bei Ihnen ab, veredeln es unter
            kontrollierten Bedingungen und bringen es zum Wunschtermin zurück.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="glow-ring">
              <Link to="/" hash="buchung">
                Abholtermin anfragen
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={`tel:${company.phone.replace(/\s/g, "")}`}>Telefonisch beraten lassen</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [Car, "Abholung & Rückgabe", "Wir übernehmen Ihr Fahrzeug an Wohn- oder Firmenadresse."],
            [MapPin, "13 Städte im Umkreis", "Von Horb über Tübingen bis Böblingen und Reutlingen."],
            [ShieldCheck, "Voll versichert", "Überführungsfahrten sind während des Transports abgesichert."],
          ].map(([Icon, title, text]) => {
            const I = Icon as typeof Car;
            return (
              <article key={title as string} className="glass rounded-2xl p-6">
                <I className="size-7 text-primary" />
                <h2 className="mt-4 display-card uppercase">{title as string}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{text as string}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <h2 className="display-section uppercase">
          Unser Abholgebiet – {pickupCities.length} Städte
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Wählen Sie Ihre Stadt aus, um Entfernung, Fahrzeit und die regionalen Besonderheiten
          Ihres Abholtermins zu sehen.
        </p>
        <div className="mt-8">
          <PickupCityGrid />
        </div>
      </section>
    </div>
  );
}
