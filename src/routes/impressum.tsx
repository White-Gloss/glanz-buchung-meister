import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/impressum")({
  component: ImpressumPage,
  head: () =>
    pageHead({
      title: `Impressum | ${site.name}`,
      description: "Anbieterkennzeichnung und Kontaktdaten von White Gloss Detailing.",
      path: "/impressum",
    }),
});

function ImpressumPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="atelier"
        alt={`Werkstatt von White Gloss in ${site.city}`}
        kicker="Rechtliches"
        title="Impressum."
        lead="Wer hinter White Gloss steht – Anschrift, Kontakt, Angaben gemäß § 5 DDG."
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Impressum" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="font-display text-2xl">Angaben gemäß § 5 DDG</h2>
          <address className="mt-3 not-italic text-muted">
            <strong className="text-fg">{site.legalName}</strong>
            <br />
            Inhaber: {site.owner}
            <br />
            {site.street}
            <br />
            {site.postalCode} {site.city}
            <br />
            {site.country}
          </address>
        </section>
        <section>
          <h2 className="font-display text-2xl">Kontakt</h2>
          <p className="mt-3 text-muted">
            Telefon: <a href={site.phoneHref}>{site.phoneDisplay}</a>
            <br />
            E-Mail: <a href={`mailto:${site.email}`}>{site.email}</a>
            <br />
            Öffnungszeiten: {site.hoursLabel}
          </p>
        </section>
        <section>
          <h2 className="font-display text-2xl">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
          <address className="mt-3 not-italic text-muted">
            {site.owner}
            <br />
            {site.street}
            <br />
            {site.postalCode} {site.city}
          </address>
        </section>
        <section>
          <h2 className="font-display text-2xl">Verbraucherstreitbeilegung</h2>
          <p className="mt-3 text-muted">
            Wir sind nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor
            einer Verbraucherschlichtungsstelle teilzunehmen. Die frühere OS-Plattform der
            Europäischen Kommission zur Online-Streitbeilegung wird nicht mehr betrieben.
          </p>
        </section>
        <section>
          <h2 className="font-display text-2xl">Haftung für Inhalte und Links</h2>
          <p className="mt-3 text-muted">
            Wir erstellen die Inhalte dieser Website mit Sorgfalt. Für externe Links zu fremden
            Inhalten ist der jeweilige Anbieter verantwortlich. Sollten uns rechtswidrige Inhalte
            bekannt werden, entfernen wir entsprechende Links nach Prüfung.
          </p>
        </section>
        <p className="text-xs text-subtle">Stand: 31. August 2026</p>
      </div>
      </div>
    </main>
  );
}
