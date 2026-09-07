import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/datenloeschung")({
  component: DataDeletionPage,
  head: () =>
    pageHead({
      title: `Datenlöschung anfragen | ${site.name}`,
      description:
        "So fragen Sie bei White Gloss Detailing die Löschung Ihrer Buchungs- oder Kontodaten an.",
      path: "/datenloeschung",
    }),
});

function DataDeletionPage() {
  const subject = "Anfrage zur Datenlöschung – White Gloss";

  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="atelier"
        alt={`Werkstatt von White Gloss in ${site.city}`}
        kicker="Datenschutz"
        title="Datenlöschung anfragen."
        lead="So richten Sie Ihre Anfrage zur Löschung personenbezogener Daten an uns."
        crumbs={[{ label: "Startseite", to: "/" }, { label: "Datenlöschung" }]}
      />
      <article className="prose-legal mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <section>
          <h2>1. Anfrage per E-Mail senden</h2>
          <p>
            Wenn Sie bei {site.legalName} die Löschung Ihrer personenbezogenen Daten anfragen
            möchten, schreiben Sie an{" "}
            <a href={`mailto:${site.email}?subject=${encodeURIComponent(subject)}`}>{site.email}</a>
            . Verwenden Sie zur Zuordnung bitte den Betreff <strong>{subject}</strong>.
          </p>
        </section>

        <section>
          <h2>2. Den Vorgang zuordnen</h2>
          <p>
            Beschreiben Sie kurz, welche Daten oder welchen Vorgang Ihre Anfrage betrifft. Nennen
            Sie dazu nur die Angaben, die für die Zuordnung erforderlich sind:
          </p>
          <ul>
            <li>
              Bei einer Buchung oder Anfrage: die Vorgangsnummer, falls bekannt. Andernfalls nennen
              Sie Ihren Namen und den ungefähren Anfrage- oder Abgabetermin.
            </li>
            <li>Bei einem Konto im Betriebspanel: die zugehörige E-Mail-Adresse.</li>
          </ul>
          <p>
            Schreiben Sie möglichst von der E-Mail-Adresse, die Sie für den Vorgang verwendet haben.
            Geben Sie eine erreichbare Kontaktadresse für Rückfragen und unsere Antwort an. Senden
            Sie keine Passwörter, Anmeldetokens oder Ausweiskopien mit.
          </p>
        </section>

        <section>
          <h2>3. Rückmeldung zur Anfrage</h2>
          <p>
            Wir prüfen die Zuordnung und Ihre Löschanfrage. Falls dafür Angaben fehlen oder
            Rückfragen zur Berechtigung erforderlich sind, melden wir uns bei Ihnen. Über das
            Ergebnis und eine erfolgte Löschung erhalten Sie eine Rückmeldung über die angegebene
            Kontaktadresse. Das Absenden einer Anfrage löst keine automatische Löschung aus.
          </p>
          <p>
            Informationen zur Verarbeitung, zur Speicherdauer und zu Ihren Rechten finden Sie in
            unserer <Link to="/datenschutz">Datenschutzerklärung</Link>.
          </p>
        </section>

        <p className="text-xs text-subtle">Stand: 7. September 2026</p>
      </article>
    </main>
  );
}
