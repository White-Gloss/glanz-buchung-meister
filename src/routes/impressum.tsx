import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { absUrl } from "@/lib/seo";
import { company } from "@/lib/servicesConfig";

const TITLE = "Impressum | White Gloss Detailing";

export const Route = createFileRoute("/impressum")({
  head: () => ({
    meta: [
      { title: TITLE },
      {
        name: "description",
        content: "Anbieterkennzeichnung und Kontaktdaten von White Gloss Detailing.",
      },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [
      { rel: "canonical", href: absUrl("/impressum") },
      { rel: "alternate", hrefLang: "de-DE", href: absUrl("/impressum") },
    ],
  }),
  component: ImprintPage,
});

function ImprintPage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main id="main-content">
        <section className="border-b border-border">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
            <nav aria-label="Brotkrumen" className="text-xs text-muted-foreground">
              <Link to="/" className="transition-colors hover:text-foreground">
                Startseite
              </Link>
              <span className="px-2">/</span>
              <span className="text-foreground">Impressum</span>
            </nav>
            <p className="eyebrow mt-8">Rechtliches</p>
            <h1 className="display-page mt-3 uppercase">Impressum</h1>
          </div>
        </section>

        <article className="prose-legal mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <section>
            <h2>Angaben gemäß § 5 DDG</h2>
            <address>
              <strong>{company.name}</strong>
              {company.owner && <span>Inhaber: {company.owner}</span>}
              {company.street && <span>{company.street}</span>}
              <span>{company.city}</span>
              <span>{company.country}</span>
            </address>
          </section>

          <section>
            <h2>Kontakt</h2>
            <p>
              Telefon: <a href={company.phoneHref}>{company.phone}</a>
              <br />
              E-Mail: <a href={`mailto:${company.email}`}>{company.email}</a>
            </p>
          </section>

          {company.taxId && (
            <section>
              <h2>Umsatzsteuer-ID</h2>
              <p>
                Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: {company.taxId}
              </p>
            </section>
          )}

          <section>
            <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
            <address>
              {company.owner && <span>{company.owner}</span>}
              {company.street && <span>{company.street}</span>}
              <span>{company.city}</span>
            </address>
          </section>

          <section>
            <h2>Verbraucherstreitbeilegung</h2>
            <p>
              Wir sind nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor
              einer Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>

          <section>
            <h2>Haftung für Inhalte und Links</h2>
            <p>
              Wir erstellen die Inhalte dieser Website mit Sorgfalt. Für externe Links zu fremden
              Inhalten ist der jeweilige Anbieter verantwortlich. Sollten uns rechtswidrige Inhalte
              bekannt werden, entfernen wir entsprechende Links nach Prüfung.
            </p>
          </section>

          <p className="text-xs text-muted-foreground">Stand: 31. Juli 2026</p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
