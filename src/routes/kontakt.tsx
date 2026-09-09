import { createFileRoute, Link } from "@tanstack/react-router";
import { IconMessage, IconPhone } from "@/components/icons";
import { PageHero } from "@/components/page-hero";
import { WorkshopMap } from "@/components/workshop-map";
import { ctaGhost, ctaPrimary } from "@/components/ui";
import { openingHours, site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/kontakt")({
  component: KontaktPage,
  head: () =>
    pageHead({
      title: `Kontakt | ${site.name}`,
      description: `White Gloss Detailing in ${site.city}: Telefon, WhatsApp, E-Mail und Anschrift. Werkstatt ${site.street}.`,
      path: "/kontakt",
      preloadShot: "atelier",
    }),
});

function KontaktPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="atelier"
        alt={`Werkstatt von White Gloss in ${site.city}`}
        kicker={`Werkstatt ${site.city}`}
        title="Kontakt."
        lead="Sie erreichen uns telefonisch, per E-Mail oder WhatsApp und in unserer Werkstatt in Horb am Neckar."
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Kontakt" },
        ]}
        actions={
          <>
            <Link to="/" hash="buchung" className={ctaPrimary}>
              Termin anfragen
            </Link>
            <a href={site.whatsapp} className={ctaGhost} target="_blank" rel="noopener noreferrer">
              <IconMessage className="size-4" />
              WhatsApp
            </a>
            <a href={site.phoneHref} className={ctaGhost}>
              <IconPhone className="size-4" />
              Anrufen
            </a>
          </>
        }
      />
      <section className="section mx-auto max-w-7xl px-4 sm:px-6">
        <dl className="gd-tiles gd-tiles-3">
          <div className="border border-line p-6">
            <dt className="kicker">Telefon</dt>
            <dd className="mt-4">
              <a href={site.phoneHref} className="font-display text-3xl tracking-tight hover:underline">
                {site.phoneDisplay}
              </a>
              <p className="mt-2 text-sm text-muted">{site.hoursLabel}</p>
            </dd>
          </div>
          <div className="border border-line p-6">
            <dt className="kicker">E-Mail</dt>
            <dd className="mt-4">
              <a href={`mailto:${site.email}`} className="font-display text-3xl tracking-tight hover:underline">
                {site.email}
              </a>
              <p className="mt-2 text-sm text-muted">Antwort in der Regel am selben Werktag.</p>
            </dd>
          </div>
          <div className="border border-line p-6">
            <dt className="kicker">Anschrift</dt>
            <dd className="mt-4 font-display text-3xl tracking-tight">
              {site.street}
              <span className="mt-1 block text-lg text-muted">
                {site.postalCode} {site.city}
              </span>
            </dd>
          </div>
        </dl>
        <p className="mt-10 max-w-xl text-sm text-muted">
          Geöffnet {openingHours.daysLabel}, {openingHours.opens}–{openingHours.closes} Uhr.
          Samstag und Sonntag geschlossen.
        </p>
        <WorkshopMap className="mt-12" />
      </section>
    </main>
  );
}
