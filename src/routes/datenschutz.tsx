import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/datenschutz")({
  component: PrivacyPage,
  head: () =>
    pageHead({
      title: `Datenschutzerklärung | ${site.name}`,
      description:
        "Informationen zur Verarbeitung personenbezogener Daten bei White Gloss Detailing.",
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
        lead="Welche personenbezogenen Daten wir verarbeiten, zu welchem Zweck und wie lange wir sie speichern."
        crumbs={[{ label: "Startseite", to: "/" }, { label: "Datenschutz" }]}
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
            Anfrage). Die Anfrage ist unverbindlich. Ein Vertrag kommt erst mit unserer
            ausdrücklichen Zusage oder mit Arbeitsbeginn nach abgestimmtem Umfang zustande.
          </p>
        </section>

        <section>
          <h2>4. Kontakt per E-Mail, Telefon oder WhatsApp</h2>
          <p>
            Bei einer Kontaktaufnahme verarbeiten wir Ihre Kontaktdaten und den Inhalt Ihrer
            Nachricht, um das Anliegen zu beantworten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b
            DSGVO bei vorvertraglichen oder vertraglichen Anliegen und im Übrigen Art. 6 Abs. 1 lit.
            f DSGVO.
          </p>
        </section>

        <section>
          <h2>5. WhatsApp, Instagram und Drittländer</h2>
          <p>
            Die WhatsApp- und Instagram-Verweise auf dieser Website sind Links; es wird kein
            WhatsApp- oder Instagram-Skript in Ihrem Browser geladen. Wenn Sie einen solchen Link
            antippen, stellen Sie selbst eine Verbindung zu Meta Platforms Ireland Limited her.
            Dabei können Daten (etwa Gerät, IP-Adresse, die vorausgefüllte Nachricht) in die USA und
            andere Drittländer übermittelt werden. Es gelten die Datenschutzhinweise von WhatsApp
            bzw. Instagram. Für sensible Inhalte nutzen Sie Telefon oder E-Mail.
          </p>
          <p>
            Der schwebende WhatsApp-Button ist ebenfalls nur ein Link. Er lädt kein Widget und setzt
            kein Cookie.
          </p>
          <p>
            Wenn die WhatsApp-Anbindung im Betrieb aktiviert ist, übermittelt unser Server
            Buchungshinweise über die WhatsApp Cloud API an Meta und versendet sie als
            Vorlagennachrichten an die konfigurierte WhatsApp-Nummer des Inhabers. Dies erfolgt zur
            Bearbeitung von Buchungsanfragen und Änderungen auch ohne einen Klick auf einen
            WhatsApp-Link. Die Hinweise können die Vorgangsnummer, den Kundennamen, die
            Telefonnummer, die gewählte Leistung, Datum und Uhrzeit der Fahrzeugabgabe, eine
            gekürzte Notiz sowie die Art des Vorgangs, etwa eine Bestätigung oder Stornierung,
            enthalten. Bei Verschiebungen oder Stornierungen kann der bisherige Abgabetermin, bei
            Stornierungen außerdem deren Zeitpunkt enthalten sein.
          </p>
          <p>
            Diese Anbindung sendet keine WhatsApp-Nachrichten an Buchungskunden. Kundenhinweise und
            Terminerinnerungen werden bei eingerichtetem E-Mail-Versand per E-Mail versendet. Meta
            meldet Nachrichtenkennungen und Zustellstatus zurück, damit wir den Versand an den
            Inhaber nachvollziehen und Zustellfehler prüfen können. WhatsApp-Nachrichten bestätigen
            oder ändern keinen Termin; die Freigabe erfolgt persönlich im Betriebspanel.
          </p>
        </section>

        <section>
          <h2>6. Google Tag, Conversion-Tracking und Cookies</h2>
          <p>
            Auf dieser Website setzen wir den Google Tag (Google Ireland Limited, Gordon House,
            Barrow Street, Dublin 4, Irland; Tag-ID: AW-18384520682, ggf. zusätzlich eine
            Google-Analytics-4-Mess-ID) zur Erfolgsmessung unserer Google-Ads-Werbeanzeigen bzw.
            Besucherstatistik ein. Wenn Sie über eine Google-Anzeige auf unsere Website gelangen
            oder eine Terminanfrage bzw. Buchung abschließen, wird dies als Conversion erfasst, um
            die Effektivität unserer Anzeigen zu analysieren.
          </p>
          <p>
            Das Skript wird technisch erst geladen, nachdem Sie im Cookie-Banner „Akzeptieren“
            gewählt haben (§ 25 Abs. 1 TDDDG). Rechtsgrundlage für den Einsatz ist Ihre
            Einwilligung, Art. 6 Abs. 1 lit. a DSGVO. Wählen Sie „Ablehnen“, wird der Google Tag
            nicht geladen. Um eine erteilte Einwilligung zurückzunehmen, löschen Sie in Ihrem
            Browser den localStorage-Eintrag „wg-consent“ dieser Website und laden Sie die Seite
            anschließend vollständig neu. Wählen Sie im erneut angezeigten Banner „Ablehnen“. Nach
            dem Neuladen bleibt der Google Tag ohne erneute Zustimmung ausgeschaltet. Das Löschen
            des Speichereintrags allein beendet ein bereits geladenes Skript im noch geöffneten
            Dokument nicht.
          </p>
          <p>
            Nach Ihrer Einwilligung können Daten wie Ihre IP-Adresse und Gerätekennungen an Google
            übertragen und gegebenenfalls in die USA übermittelt werden. Google stützt solche
            Übermittlungen auf Standardvertragsklauseln der EU-Kommission.
          </p>
          <p>
            Darüber hinaus findet im öffentlich zugänglichen Bereich keine werbliche
            Reichweitenmessung statt (kein Meta-Pixel).
          </p>
          <p>
            Technisch notwendige Speicherung kann im geschützten Betriebspanel zur Anmeldung und
            Sicherheit verwendet werden (Sitzung). Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.
            Das Cookie für das Nachreichen von Fahrzeugfotos ist in Abschnitt 7 beschrieben.
          </p>
          <p>
            Die Standortkarte zeigt zuerst ein eigenes Kartenbild. Erst wenn Sie „Google Maps laden
            – dabei werden Daten an Google übertragen“ antippen, wird Google Maps (Google Ireland
            Limited, Gordon House, Barrow Street, Dublin 4, Irland) in einem Rahmen geladen. Danach
            können Daten in die USA übermittelt werden (Standardvertragsklauseln von Google). Der
            Button „Google Maps“ öffnet Google in einem neuen Tab. Vor dem Klick stellt Ihr Browser
            keine Verbindung zu Google her. Rechtsgrundlage nach dem Klick ist Art. 6 Abs. 1 lit. a
            DSGVO.
          </p>
        </section>

        <section>
          <h2>7. Fahrzeugfotos und Zustandsmeldungen</h2>
          <p>
            Über die Seiten „Zustand prüfen lassen“ und „Dellen- und Hagelschäden“ können Sie
            uns eine Beschreibung sowie Dateinamen ausgewählter Fotos oder kurzer Videos
            übermitteln. Die Bild- und Videodateien selbst werden nicht hochgeladen und verbleiben
            auf Ihrem Gerät. Wir verwenden Name, Telefonnummer, Beschreibung und Dateinamen zur
            Zuordnung, Prüfung und Terminabstimmung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
          </p>
          <p>
            Für eine tatsächliche Begutachtung können wir die Dateien nach Rückmeldung über einen
            separaten sicheren Kanal nachfordern.
          </p>
          <p>
            Nach einer Terminanfrage können Sie auf der Bestätigungsseite optional Fahrzeugfotos
            oder kurze Videos zum Vorgang nachreichen. Bei dieser Uploadfunktion werden die
            tatsächlichen Dateien über unseren Server in einem privaten Speicherbereich bei Supabase
            gespeichert. Dateiname, Dateityp, Dateigröße und die Zuordnung zum Vorgang werden
            ebenfalls gespeichert. Die Aufnahmen sind nicht öffentlich zugänglich und dienen der
            Prüfung Ihrer Anfrage.
          </p>
          <p>
            Für das Nachreichen speichert Ihr Browser nach der Anfrage eine zufällige,
            vorgangsgebundene Upload-Berechtigung in einem HttpOnly-Cookie. Diese Berechtigung läuft
            nach sieben Tagen ab. Der Upload setzt voraus, dass das Cookie im Browser der
            ursprünglichen Anfrage noch vorhanden ist. Die siebentägige Frist betrifft die
            Upload-Berechtigung; bereits gespeicherte Aufnahmen werden dadurch nicht automatisch
            gelöscht. Für ihre Speicherdauer gilt Abschnitt 10.
          </p>
        </section>

        <section>
          <h2>8. Betriebspanel (nur intern)</h2>
          <p>
            Die Anmeldung zum Betriebspanel ist ausschließlich für den Inhaber und beauftragte
            Mitarbeiter bestimmt. Sie erfolgt per E-Mail und Passwort oder über Google (Google
            Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland). Google-Anmeldung ist
            nur für Adressen @white-gloss.de und ausdrücklich freigeschaltete Postfächer zulässig.
            Der Anmeldeanbieter X (Twitter) ist nicht aktiv. Öffentliche Besucher können dort kein
            Konto einrichten.
          </p>
        </section>

        <section>
          <h2>9. Empfänger</h2>
          <p>
            Hosting: IONOS SE, Deutschland. Anfragen und Termine werden von White Gloss bearbeitet.
            Die optional nachgereichten Fahrzeugaufnahmen werden bei Supabase in einem privaten
            Speicherbereich abgelegt. Wenn der E-Mail-Versand eingerichtet ist, werden
            Benachrichtigungen über Resend versendet; dabei werden Empfängeradresse, Betreff und
            Nachrichteninhalt an den Versanddienst übermittelt. Wenn die WhatsApp-Anbindung im
            Betrieb aktiviert ist, erhält Meta zusätzlich die in Abschnitt 5 beschriebenen
            Buchungshinweise zur Zustellung an den Inhaber.
          </p>
          <p>
            Google Ads und gegebenenfalls Analytics werden erst nach Ihrer Einwilligung geladen.
            Nach bewusstem Klick werden außerdem Google Ireland Limited (Karten, interne Anmeldung)
            beziehungsweise Meta Platforms Ireland Limited (WhatsApp, Instagram) aufgerufen. Die
            jeweiligen Abläufe sind in den Abschnitten 5, 6 und 8 beschrieben.
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
            <a href={`mailto:${site.email}`}>{site.email}</a>. Wie Sie eine Löschung anfragen
            können, beschreibt die <Link to="/datenloeschung">Anleitung zur Datenlöschung</Link>.
          </p>
        </section>

        <section>
          <h2>12. Sicherheit und Aktualisierung</h2>
          <p>
            Die Website wird verschlüsselt über HTTPS übertragen. Wir passen diese Hinweise an, wenn
            sich Funktionen, eingesetzte Dienste oder rechtliche Anforderungen ändern.
          </p>
        </section>

        <p className="text-xs text-subtle">Stand: 7. September 2026</p>
      </article>
    </main>
  );
}
