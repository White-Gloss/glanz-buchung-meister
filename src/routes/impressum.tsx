import { createFileRoute, Link } from "@tanstack/react-router";
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
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-16 sm:px-6" tabIndex={-1}>
      <nav aria-label="Brotkrumen" className="text-xs text-subtle">
        <Link to="/" className="hover:text-fg">
          Startseite
        </Link>
        <span className="px-2">/</span>
        <span>Impressum</span>
      </nav>
      <h1 className="mt-6 font-display text-5xl">Impressum</h1>
      <div className="mt-10 space-y-8 text-sm leading-relaxed">
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
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS)
            bereit:{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              rel="noreferrer"
              target="_blank"
              className="underline hover:text-fg"
            >
              https://ec.europa.eu/consumers/odr
            </a>
            . Wir sind nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor
            einer Verbraucherschlichtungsstelle teilzunehmen.
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
        <p className="text-xs text-subtle">Stand: 30. August 2026</p>
      </div>
    </main>
  );
}
