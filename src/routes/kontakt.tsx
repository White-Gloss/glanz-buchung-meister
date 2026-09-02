import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Phone } from "lucide-react";
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
    }),
});

function KontaktPage() {
  return (
    <main id="main-content" className="mx-auto max-w-7xl px-4 py-16 pb-28 sm:px-6 lg:pb-16" tabIndex={-1}>
      <p className="kicker">Werkstatt {site.city}</p>
      <h1 className="heading-1 mt-4">Kontakt</h1>
      <p className="mt-5 max-w-xl text-muted leading-relaxed">
        Anrufen, schreiben oder vorbeikommen. Die Arbeit läuft in der Werkstatt –
        den Hol- und Bringservice gibt es in 13 Städten.
      </p>

      <dl className="gd-tiles gd-tiles-3 mt-12">
        <div className="border border-line p-5">
          <dt className="text-xs uppercase tracking-[0.16em] text-subtle">Telefon</dt>
          <dd className="mt-3">
            <a href={site.phoneHref} className="font-display text-2xl tracking-tight hover:underline">
              {site.phoneDisplay}
            </a>
            <p className="mt-2 text-sm text-muted">{site.hoursLabel}</p>
          </dd>
        </div>
        <div className="border border-line p-5">
          <dt className="text-xs uppercase tracking-[0.16em] text-subtle">E-Mail</dt>
          <dd className="mt-3">
            <a href={`mailto:${site.email}`} className="font-display text-2xl tracking-tight hover:underline">
              {site.email}
            </a>
            <p className="mt-2 text-sm text-muted">Antwort in der Regel am selben Werktag.</p>
          </dd>
        </div>
        <div className="border border-line p-5">
          <dt className="text-xs uppercase tracking-[0.16em] text-subtle">Anschrift</dt>
          <dd className="mt-3 font-display text-2xl tracking-tight">
            {site.street}
            <span className="mt-1 block text-lg text-muted">
              {site.postalCode} {site.city}
            </span>
          </dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/" hash="buchung" className={ctaPrimary}>
          Termin anfragen
        </Link>
        <a href={site.whatsapp} className={ctaGhost} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="size-4" aria-hidden />
          WhatsApp
        </a>
        <a href={site.phoneHref} className={ctaGhost}>
          <Phone className="size-4" aria-hidden />
          Anrufen
        </a>
      </div>

      <p className="mt-10 max-w-xl text-sm text-muted">
        Geöffnet {openingHours.daysLabel}, {openingHours.opens}–{openingHours.closes} Uhr.
        Samstag und Sonntag geschlossen.
      </p>

      <WorkshopMap className="mt-12" />
    </main>
  );
}
