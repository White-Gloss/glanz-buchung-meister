import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { ctaPrimary } from "@/components/ui";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/barrierefreiheit")({
  component: AccessibilityPage,
  head: () =>
    pageHead({
      title: `Erklärung zur Barrierefreiheit | ${site.name}`,
      description:
        "Stand der digitalen Barrierefreiheit von white-gloss.de und Kontakt für Hinweise.",
      path: "/barrierefreiheit",
    }),
});

function AccessibilityPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="atelier"
        alt={`Werkstatt von White Gloss in ${site.city}`}
        kicker="Rechtliches"
        title="Barrierefreiheit."
        lead="Informationen zur Bedienbarkeit der Website, zu bekannten Einschränkungen und zu Ihren Kontaktmöglichkeiten."
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Barrierefreiheit" },
        ]}
        actions={
          <a href={`mailto:${site.email}`} className={ctaPrimary}>
            Hinweis senden
          </a>
        }
      />
      <article className="prose-legal mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p>
          White Gloss Detailing bemüht sich, diese Website für alle nutzbar zu halten. Eine
          unabhängige Konformitätsprüfung nach WCAG 2.2 AA liegt noch nicht vor. Diese Erklärung
          beschreibt den aktuellen Stand.
        </p>
        <section>
          <h2>Was vorhanden ist</h2>
          <ul>
            <li>Sprungmarke zum Inhalt</li>
            <li>Überschriften und Tastaturbedienung der wesentlichen Seiten</li>
            <li>Alternativtexte für Bilder mit inhaltlicher Bedeutung</li>
            <li>Formulare mit Beschriftung, die Anfrage ist unverbindlich</li>
          </ul>
        </section>
        <section>
          <h2>Bekannte Grenzen</h2>
          <p>
            Einzelne Bildstrecken und das Video im Kopfbereich können für Menschen mit
            eingeschränktem Sehvermögen oder Empfindlichkeit gegenüber Bewegung anstrengend sein.
            Das Video startet nicht, wenn auf dem Gerät eine reduzierte Bewegung eingestellt ist. PDF-Belege und eingebettete Karten nach Klick sind
            nicht vollständig barrierefrei.
          </p>
        </section>
        <section>
          <h2>Kontakt</h2>
          <p>
            Bitte melden Sie Barrieren an{" "}
            <a href={`mailto:${site.email}`}>{site.email}</a> oder{" "}
            <a href={site.phoneHref}>{site.phoneDisplay}</a>. Wir antworten in der Regel innerhalb
            von fünf Werktagen.
          </p>
          <p>
            Durchsetzungsstelle des Landes Baden-Württemberg: Landes-Zentrum Barrierefreiheit
            (LZ-BARR). Die Schlichtung nach BGG bleibt unberührt.
          </p>
        </section>
        <p>
          <Link to="/impressum">Impressum</Link>
          {" · "}
          <Link to="/datenschutz">Datenschutz</Link>
        </p>
        <p className="text-xs text-subtle">Stand: 3. September 2026</p>
      </article>
    </main>
  );
}
