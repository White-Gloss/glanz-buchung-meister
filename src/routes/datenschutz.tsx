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
      { rel: "alternate", hrefLang: "x-default", href: absUrl("/datenschutz") },
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
              Diese Website wird auf einem Server der IONOS SE (Elgendorfer Straße 57, 56410
              Montabaur) in Deutschland betrieben. Beim Aufruf können technisch erforderliche
              Informationen wie IP-Adresse, Datum und Uhrzeit, aufgerufene Adresse, übertragene
              Datenmenge, Referrer sowie Browser- und Betriebssystemangaben in Server-Protokollen
              verarbeitet werden. Die Verarbeitung dient der sicheren, stabilen und fehlerfreien
              Bereitstellung der Website.
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
              Google Ireland Limited (Gordon House, Barrow Street, Dublin 4, Irland). Das betrifft
              zwei Dienste, die über dasselbe Skript (gtag.js) laufen: Google Ads misst, über welche
              Anzeige eine Terminanfrage zustande kommt; Google Analytics 4 wertet aus, wie unsere
              Website genutzt wird (aufgerufene Seiten, Verweildauer, ungefähre Herkunftsregion,
              Angaben zu Browser und Endgerät). Ihre IP-Adresse wird dabei gekürzt. Beide Dienste
              werden erst aktiviert, wenn Sie im eingeblendeten Hinweis „Akzeptieren“ wählen; bei
              „Ablehnen“ oder ohne Auswahl bleiben sie deaktiviert und es wird kein Google-Skript
              geladen. Rechtsgrundlage ist Ihre Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO, § 25
              Abs. 1 TDDDG. Dabei können Daten in die USA übermittelt werden; Google hat sich den
              EU-Standardvertragsklauseln unterworfen.
            </p>
            <p>
              Ebenfalls nur mit Ihrer Einwilligung setzen wir den Meta-Pixel und die Conversions API
              von Meta Platforms Ireland Limited (Merrion Road, Dublin 4, Irland) ein. Damit messen
              wir, welche Anzeige auf Facebook oder Instagram zu einem Seitenaufruf oder einer
              Anfrage geführt hat. Verarbeitet werden dabei Ihre IP-Adresse, Angaben zu Browser und
              Endgerät, die aufgerufene Seite sowie die Meta-eigenen Cookies <code>_fbp</code> und{" "}
              <code>_fbc</code>. Die Conversions API meldet dieselben Ereignisse zusätzlich von
              unserem Server aus; sie ersetzt die Einwilligung nicht, sondern erfolgt ausschließlich
              nach Ihrer Zustimmung und mit derselben Ereigniskennung, damit ein Ereignis nur einmal
              gezählt wird. Rechtsgrundlage ist Ihre Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO, §
              25 Abs. 1 TDDDG. Für die dabei erfolgende gemeinsame Verarbeitung besteht mit Meta
              eine Vereinbarung über gemeinsame Verantwortlichkeit nach Art. 26 DSGVO; Daten können
              in die USA übermittelt werden.
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
            <h2>7. Fahrzeugfotos und Zustandsmeldungen</h2>
            <p>
              Über die Seiten „Zustand prüfen lassen“ und „Dellenentfernung &
              Hagelschaden-Reparatur“ können Sie uns Fotos oder kurze Videos Ihres Fahrzeugs sowie
              eine Beschreibung des Zustands oder Schadens übermitteln. Bei Dellen-Anfragen
              verarbeiten wir zusätzlich Schadensart, betroffenen Fahrzeugbereich, ungefähre Anzahl
              und Größe der Dellen, Fahrzeugmarke und Modell sowie den gewünschten
              Begutachtungstermin. Wir verwenden diese Angaben ausschließlich zur Prüfung des
              Schadens, zur Terminabstimmung und zur individuellen Preisermittlung. Rechtsgrundlage
              ist Art. 6 Abs. 1 lit. b DSGVO.
            </p>
            <p>
              Die Aufnahmen liegen in einem nicht öffentlich zugänglichen Speicherbereich bei
              Supabase und sind ausschließlich für uns über zeitlich begrenzte Links abrufbar. Ein
              öffentlicher Abruf ist nicht möglich.
            </p>
            <p>
              Zur Vorsortierung setzen wir für die Einschätzung der Fotos einen KI-Dienst der
              Anthropic PBC (San Francisco, USA) als Auftragsverarbeiter ein. Dabei werden
              ausgewählte Fotos zusammen mit der Fahrzeugbezeichnung, dem Kennzeichen und Ihrer
              Zustandsbeschreibung an den Dienst übertragen; Name, E-Mail-Adresse und Telefonnummer
              werden nicht übermittelt. Die Übertragung erfolgt nur, wenn wir die Einschätzung im
              Einzelfall ausdrücklich anfordern — nicht automatisch beim Eingang Ihrer Meldung. Es
              besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO; die Übermittlung in
              die USA wird auf die Standardvertragsklauseln der Europäischen Kommission nach Art. 46
              Abs. 2 lit. c DSGVO gestützt. Die Einschätzung ersetzt keine Begutachtung und dient
              allein unserer internen Vorbereitung.
            </p>
            <p>
              Wenn Sie mit dieser Übermittlung nicht einverstanden sind, teilen Sie uns das bitte
              mit — wir beurteilen die Aufnahmen dann ausschließlich selbst.
            </p>
          </section>

          <section>
            <h2>8. Speicherdauer</h2>
            <p>
              Personenbezogene Daten werden nur so lange gespeichert, wie sie zur Bearbeitung der
              Anfrage, zur Vertragsdurchführung oder zur Erfüllung gesetzlicher
              Aufbewahrungspflichten erforderlich sind. Anschließend werden sie gelöscht oder
              gesperrt, sofern keine vorrangigen gesetzlichen Gründe entgegenstehen.
            </p>
          </section>

          <section>
            <h2>9. Ihre Rechte</h2>
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
            <h2>10. Sicherheit und Aktualisierung</h2>
            <p>
              Die Website wird verschlüsselt über HTTPS übertragen. Wir passen diese Hinweise an,
              wenn sich Funktionen, eingesetzte Dienste oder rechtliche Anforderungen ändern.
            </p>
          </section>

          <p className="text-xs text-muted-foreground">Stand: 11. August 2026</p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
