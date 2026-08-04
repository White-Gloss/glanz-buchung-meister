import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { absUrl } from "@/lib/seo";
import { company } from "@/lib/servicesConfig";

const TITLE = "Datenschutzerklärung | White Gloss Detailing";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({
    meta: [
      { title: TITLE },
      {
        name: "description",
        content:
          "Informationen zur Verarbeitung personenbezogener Daten bei White Gloss Detailing.",
      },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [
      { rel: "canonical", href: absUrl("/datenschutz") },
      { rel: "alternate", hrefLang: "de-DE", href: absUrl("/datenschutz") },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
              <span className="text-foreground">Datenschutz</span>
            </nav>
            <p className="eyebrow mt-8">Rechtliches</p>
            <h1 className="display-page mt-3 uppercase">Datenschutzerklärung</h1>
          </div>
        </section>

        <article className="prose-legal mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <section>
            <h2>1. Verantwortlicher</h2>
            <address>
              <strong>{company.name}</strong>
              {company.owner && <span>{company.owner}</span>}
              {company.street && <span>{company.street}</span>}
              <span>{company.city}</span>
              <span>{company.country}</span>
              <span>
                E-Mail: <a href={`mailto:${company.email}`}>{company.email}</a>
              </span>
              <span>
                Telefon: <a href={company.phoneHref}>{company.phone}</a>
              </span>
            </address>
          </section>

          <section>
            <h2>2. Hosting und Server-Protokolle</h2>
            <p>
              Diese Website wird über Hostinger bereitgestellt. Beim Aufruf können technisch
              erforderliche Informationen wie IP-Adresse, Datum und Uhrzeit, aufgerufene Adresse,
              übertragene Datenmenge, Referrer sowie Browser- und Betriebssystemangaben in
              Server-Protokollen verarbeitet werden. Die Verarbeitung dient der sicheren, stabilen
              und fehlerfreien Bereitstellung der Website.
            </p>
            <p>
              Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse liegt im
              sicheren Betrieb und in der technischen Optimierung dieses Internetangebots.
            </p>
          </section>

          <section>
            <h2>3. Termin- und Buchungsanfragen</h2>
            <p>
              Wenn Sie den Online-Konfigurator nutzen, verarbeiten wir die von Ihnen eingegebenen
              Angaben. Dazu können Name, E-Mail-Adresse, Telefonnummer, Kennzeichen, gewünschter
              Termin, Fahrzeugklasse, Paket und Zusatzleistungen gehören. Die Daten werden zur
              Bearbeitung Ihrer Anfrage, zur Terminabstimmung und zur Vorbereitung eines möglichen
              Vertrags verwendet.
            </p>
            <p>
              Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Für die technische Speicherung der
              Buchungsdaten wird eine von Supabase bereitgestellte Datenbank-Infrastruktur als
              Auftragsverarbeitungsdienst eingesetzt. Mit dem Anbieter besteht ein Vertrag zur
              Auftragsverarbeitung nach Art. 28 DSGVO. Die Datenbank wird in der Region Frankfurt am
              Main (eu-central-1) und damit innerhalb der Europäischen Union betrieben. Eine
              Übermittlung der Buchungsdaten in ein Drittland findet im Regelbetrieb nicht statt.
            </p>
          </section>

          <section>
            <h2>4. Kontakt per E-Mail oder Telefon</h2>
            <p>
              Bei einer Kontaktaufnahme verarbeiten wir Ihre Kontaktdaten und den Inhalt Ihrer
              Nachricht, um das Anliegen zu beantworten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b
              DSGVO bei vorvertraglichen oder vertraglichen Anliegen und im Übrigen Art. 6 Abs. 1
              lit. f DSGVO.
            </p>
          </section>

          <section>
            <h2>5. WhatsApp-Link</h2>
            <p>
              Die Website enthält einen Link zu WhatsApp. Erst wenn Sie diesen Link aufrufen,
              stellen Sie eine Verbindung zum jeweiligen Anbieter her. Dabei gelten die
              Datenschutzbestimmungen von WhatsApp beziehungsweise Meta. Für sensible Inhalte können
              Sie alternativ Telefon oder E-Mail verwenden.
            </p>
          </section>

          <section>
            <h2>6. Cookies, lokale Speicherung und Reichweitenmessung</h2>
            <p>
              Technisch notwendige Speichermechanismen können im geschützten Verwaltungsbereich zur
              Anmeldung und Sicherheit verwendet werden.
            </p>
            <p>
              Mit Ihrer Einwilligung nutzen wir außerdem Cookies und ähnliche Technologien von
              Google Ads (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland), um
              zu messen, über welche Anzeige eine Terminanfrage zustande kommt. Diese werden erst
              aktiviert, wenn Sie im eingeblendeten Hinweis „Akzeptieren“ wählen; bei „Ablehnen“
              oder ohne Auswahl bleibt die Anzeigenmessung deaktiviert. Rechtsgrundlage ist Ihre
              Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG. Dabei können Daten in
              die USA übermittelt werden; Google hat sich den EU-Standardvertragsklauseln
              unterworfen.
            </p>
            <p>
              Ihre Entscheidung können Sie jederzeit widerrufen:{" "}
              <button
                type="button"
                onClick={() => {
                  void import("@/lib/adsConsent").then((m) => m.resetAdsConsent());
                }}
                className="text-primary underline underline-offset-2"
              >
                Cookie-Einwilligung zurücksetzen
              </button>
              .
            </p>
          </section>

          <section>
            <h2>7. Speicherdauer</h2>
            <p>
              Personenbezogene Daten werden nur so lange gespeichert, wie sie zur Bearbeitung der
              Anfrage, zur Vertragsdurchführung oder zur Erfüllung gesetzlicher
              Aufbewahrungspflichten erforderlich sind. Anschließend werden sie gelöscht oder
              gesperrt, sofern keine vorrangigen gesetzlichen Gründe entgegenstehen.
            </p>
          </section>

          <section>
            <h2>8. Ihre Rechte</h2>
            <p>
              Sie haben im Rahmen der gesetzlichen Voraussetzungen das Recht auf Auskunft,
              Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und
              Widerspruch. Eine erteilte Einwilligung können Sie mit Wirkung für die Zukunft
              widerrufen. Außerdem besteht ein Beschwerderecht bei einer
              Datenschutz-Aufsichtsbehörde.
            </p>
            <p>
              Für Datenschutzanfragen genügt eine Nachricht an{" "}
              <a href={`mailto:${company.email}`}>{company.email}</a>.
            </p>
          </section>

          <section>
            <h2>9. Sicherheit und Aktualisierung</h2>
            <p>
              Die Website wird verschlüsselt über HTTPS übertragen. Wir passen diese Hinweise an,
              wenn sich Funktionen, eingesetzte Dienste oder rechtliche Anforderungen ändern.
            </p>
          </section>

          <p className="text-xs text-muted-foreground">Stand: 31. Juli 2026</p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
