import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/datenschutz")({
  component: PrivacyPage,
  head: () =>
    pageHead({
      title: `Datenschutzerklärung | ${site.name}`,
      description: "Informationen zur Verarbeitung personenbezogener Daten bei White Gloss Detailing.",
      path: "/datenschutz",
    }),
});

function PrivacyPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="atelier"
        alt={`Werkstatt von White Gloss in ${site.city}`}
        kicker="Rechtliches"
        title="Datenschutzerklärung."
        lead="Welche Daten wir brauchen, wofür, und wie lange sie bleiben."
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Datenschutz" },
        ]}
      />
      <article className="prose-legal mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <section>
          <h2>1. Verantwortlicher</h2>
          <address className="not-italic">
            <strong className="text-fg">{site.legalName}</strong>
            <br />
            Inhaber: {site.owner}
            <br />
            {site.street}
            <br />
            {site.postalCode} {site.city}
            <br />
            {site.country}
            <br />
            E-Mail: <a href={`mailto:${site.email}`}>{site.email}</a>
            <br />
            Telefon: <a href={site.phoneHref}>{site.phoneDisplay}</a>
          </address>
        </section>

        <section>
          <h2>2. Hosting und Server-Protokolle</h2>
          <p>
            Die Website wird im Produktivbetrieb auf Servern der IONOS SE (Elgendorfer Straße 57,
            56410 Montabaur, Deutschland) bereitgestellt. Beim Aufruf können technisch erforderliche
            Angaben wie IP-Adresse, Datum und Uhrzeit, aufgerufene Adresse, übertragene Datenmenge,
            Referrer sowie Browser- und Betriebssystemangaben in Server-Protokollen verarbeitet
            werden. Die Verarbeitung dient der sicheren, stabilen und fehlerfreien Bereitstellung
            der Website.
          </p>
          <p>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse liegt im
            sicheren Betrieb und in der technischen Stabilität dieses Internetangebots.
          </p>
        </section>

        <section>
          <h2>3. Termin- und Buchungsanfragen</h2>
          <p>
            Wenn Sie den Online-Konfigurator nutzen, verarbeiten wir die von Ihnen eingegebenen
            Angaben. Dazu können Name, Telefonnummer, E-Mail-Adresse, Wunschtermin, Zeitfenster,
            Abholort, Fahrzeugklasse, Paket, Zusatzleistungen und Hinweise gehören. Die Daten werden
            zur Bearbeitung Ihrer Anfrage, zur Terminabstimmung und zur Vorbereitung eines möglichen
            Vertrags verwendet.
          </p>
          <p>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen auf Ihre
            Anfrage). Die Anfrage ist unverbindlich. Ein Vertrag kommt erst mit unserer ausdrücklichen
            Zusage oder mit Arbeitsbeginn nach abgestimmtem Umfang zustande.
          </p>
        </section>

        <section>
          <h2>4. Kontakt per E-Mail, Telefon oder WhatsApp</h2>
          <p>
            Bei einer Kontaktaufnahme verarbeiten wir Ihre Kontaktdaten und den Inhalt Ihrer
            Nachricht, um das Anliegen zu beantworten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b
            DSGVO bei vorvertraglichen oder vertraglichen Anliegen und im Übrigen Art. 6 Abs. 1
            lit. f DSGVO.
          </p>
        </section>

        <section>
          <h2>5. WhatsApp, Instagram und Drittländer</h2>
          <p>
            Die Website enthält nur Links, kein WhatsApp- oder Instagram-Skript. Erst wenn Sie
            einen solchen Link antippen, stellen Sie selbst eine Verbindung zu Meta Platforms
            Ireland Limited her. Dabei können Daten (etwa Gerät, IP-Adresse, die vorausgefüllte
            Nachricht) in die USA und andere Drittländer übermittelt werden. Es gelten die
            Datenschutzhinweise von WhatsApp bzw. Instagram. Meta stützt die Übermittlung auf
            Standardvertragsklauseln. Für sensible Inhalte nutzen Sie Telefon oder E-Mail.
          </p>
          <p>
            Der schwebende WhatsApp-Button ist ebenfalls nur ein Link. Er lädt kein Widget und
            setzt kein Cookie.
          </p>
        </section>

        <section>
          <h2>6. Cookies, lokale Speicherung und Karten</h2>
          <p>
            Diese öffentliche Website setzt keine Marketing-Cookies, kein Google Analytics, kein
            Google Ads und kein Meta-Pixel. Es findet keine werbliche Reichweitenmessung statt.
            Für den öffentlichen Bereich wird kein Einwilligungsbanner benötigt, weil keine
            nicht-essentiellen Cookies oder Tracker gesetzt werden.
          </p>
          <p>
            Technisch notwendige Speicherung kann im geschützten Betriebspanel zur Anmeldung und
            Sicherheit verwendet werden (Sitzung). Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.
          </p>
          <p>
            Die Standortkarte zeigt zuerst ein eigenes Kartenbild. Erst wenn Sie
            „Google Maps laden – dabei werden Daten an Google übertragen“ antippen, wird Google Maps
            (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland) in einem Rahmen
            geladen. Danach können Daten in die USA übermittelt werden (Standardvertragsklauseln
            von Google). Der Button „Google Maps“ öffnet Google in einem neuen Tab. Vor dem Klick
            stellt Ihr Browser keine Verbindung zu Google her. Rechtsgrundlage nach dem Klick ist
            Art. 6 Abs. 1 lit. a DSGVO.
          </p>
        </section>

        <section>
          <h2>7. Fahrzeugfotos und Zustandsmeldungen</h2>
          <p>
            Über die Seiten „Zustand prüfen lassen“ und „Dellenentfernung & Hagelschaden“ können
            Sie uns eine Beschreibung sowie Dateinamen ausgewählter Fotos oder kurzer Videos
            übermitteln. Die Bild- und Videodateien selbst werden nicht hochgeladen und verbleiben
            auf Ihrem Gerät. Wir verwenden Name, Telefonnummer, Beschreibung und Dateinamen zur
            Zuordnung, Prüfung und Terminabstimmung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
          </p>
          <p>
            Für eine tatsächliche Begutachtung können wir die Dateien nach Rückmeldung über einen
            separaten sicheren Kanal nachfordern.
          </p>
        </section>

        <section>
          <h2>8. Betriebspanel (nur intern)</h2>
          <p>
            Die Anmeldung zum Betriebspanel ist ausschließlich für den Inhaber und beauftragte
            Mitarbeiter bestimmt. Sie erfolgt per E-Mail und Passwort oder über Google
            (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland).
            Google-Anmeldung ist nur für Adressen @white-gloss.de und ausdrücklich
            freigeschaltete Postfächer zulässig. Der Anmeldeanbieter X (Twitter) ist nicht
            aktiv. Öffentliche Besucher können dort kein Konto einrichten.
          </p>
        </section>

        <section>
          <h2>9. Empfänger</h2>
          <p>
            Hosting: IONOS SE, Deutschland. Anfragen und Termine: intern bei White Gloss.
            Nach bewusstem Klick: Google Ireland Limited (Karten, interne Anmeldung) und
            Meta Platforms Ireland Limited (WhatsApp, Instagram). Eine automatische Weitergabe
            an Werbenetzwerke findet nicht statt.
          </p>
        </section>

        <section>
          <h2>10. Speicherdauer</h2>
          <p>
            Personenbezogene Daten werden nur so lange gespeichert, wie sie zur Bearbeitung der
            Anfrage, zur Vertragsdurchführung oder zur Erfüllung gesetzlicher Aufbewahrungspflichten
            erforderlich sind. Anschließend werden sie gelöscht oder gesperrt, sofern keine
            vorrangigen gesetzlichen Gründe entgegenstehen.
          </p>
        </section>

        <section>
          <h2>11. Ihre Rechte</h2>
          <p>
            Sie haben im Rahmen der gesetzlichen Voraussetzungen das Recht auf Auskunft,
            Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und
            Widerspruch. Eine erteilte Einwilligung können Sie mit Wirkung für die Zukunft
            widerrufen. Außerdem besteht ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde,
            insbesondere beim Landesbeauftragten für den Datenschutz und die Informationsfreiheit
            Baden-Württemberg (LfDI BW). Einer Verarbeitung auf Grundlage von Art. 6 Abs. 1 lit. f
            DSGVO können Sie aus Gründen widersprechen, die sich aus Ihrer besonderen Situation
            ergeben (Art. 21 DSGVO).
          </p>
          <p>
            Für Datenschutzanfragen genügt eine Nachricht an{" "}
            <a href={`mailto:${site.email}`}>{site.email}</a>.
          </p>
        </section>

        <section>
          <h2>12. Sicherheit und Aktualisierung</h2>
          <p>
            Die Website wird verschlüsselt über HTTPS übertragen. Wir passen diese Hinweise an, wenn
            sich Funktionen, eingesetzte Dienste oder rechtliche Anforderungen ändern.
          </p>
        </section>

        <p className="text-xs text-subtle">Stand: 3. September 2026</p>
      </article>
    </main>
  );
}
