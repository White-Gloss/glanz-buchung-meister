import { createFileRoute, Link } from "@tanstack/react-router";
import { CookieSettingsButton } from "@/components/consent-banner";
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
        lead="Welche personenbezogenen Daten wir verarbeiten, zu welchem Zweck, wer sie erhält und wie lange wir sie speichern."
        crumbs={[{ label: "Startseite", to: "/" }, { label: "Datenschutz" }]}
      />
      <article className="prose-legal mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <section>
          <h2>1. Verantwortlicher</h2>
          <address className="not-italic">
            <strong className="text-fg">{site.ownerLegalName}</strong>
            <br />
            {site.legalName} ({site.legalForm})
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
          <p>
            Ein Datenschutzbeauftragter ist nicht bestellt, weil die gesetzlichen Voraussetzungen
            dafür nicht vorliegen. Für alle Fragen zum Datenschutz erreichen Sie uns unter den
            oben genannten Kontaktdaten.
          </p>
        </section>

        <section>
          <h2>2. Hosting, Server-Protokolle und Sicherheit</h2>
          <p>
            Die Website wird auf einem Server der IONOS SE (Elgendorfer Straße 57, 56410
            Montabaur, Deutschland) in Deutschland betrieben. IONOS ist als Auftragsverarbeiter
            für uns tätig. Beim Aufruf verarbeitet der Server technisch erforderliche Angaben wie
            IP-Adresse, Datum und Uhrzeit, aufgerufene Adresse, übertragene Datenmenge, Referrer
            sowie Browser- und Betriebssystemangaben in Server-Protokollen. Zum Schutz vor
            Missbrauch begrenzen wir Formularübermittlungen je IP-Adresse; diese Zählung liegt nur
            im Arbeitsspeicher und wird spätestens nach etwa einer Viertelstunde gelöscht.
          </p>
          <p>
            Zweck ist die sichere, stabile und fehlerfreie Bereitstellung der Website. Die
            Protokolle bewahren wir nur so lange auf, wie es für Fehleranalyse und Abwehr von
            Angriffen erforderlich ist, und löschen sie danach. Rechtsgrundlage ist Art. 6 Abs. 1
            lit. f DSGVO; unser berechtigtes Interesse liegt im sicheren Betrieb dieses
            Internetangebots. Die Website wird verschlüsselt über HTTPS übertragen.
          </p>
        </section>

        <section>
          <h2>3. Termin- und Buchungsanfragen</h2>
          <p>
            Wenn Sie den Online-Konfigurator oder ein Anfrageformular nutzen, verarbeiten wir Ihre
            Angaben: Name, Telefonnummer, E-Mail-Adresse, gegebenenfalls Anschrift bzw. Abholort,
            Fahrzeughersteller, Modell und Kennzeichen, Fahrzeugklasse, Paket, Zusatzleistungen,
            Wunschtermin, Zeitfenster und Ihre Hinweise. Wir verwenden die Daten zur Bearbeitung
            Ihrer Anfrage, zur Preisprüfung, Terminabstimmung und Vorbereitung eines Vertrags.
            Nach dem Absenden erhalten Sie eine Eingangsbestätigung per E-Mail mit einem
            persönlichen Statuslink, über den Sie den Bearbeitungsstand Ihres Auftrags abrufen
            können.
          </p>
          <p>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen auf Ihre
            Anfrage und Vertragserfüllung). Pflichtfelder sind gekennzeichnet; ohne sie können wir
            Ihre Anfrage nicht bearbeiten. Die Anfrage ist unverbindlich.
          </p>
        </section>

        <section>
          <h2>4. Fahrzeugfotos und Videos</h2>
          <p>
            Bei einer Anfrage, auf den Seiten „Zustand prüfen lassen“ und „Dellen- und
            Hagelschäden“ sowie nach einer Terminanfrage auf der Bestätigungsseite können Sie
            freiwillig Fotos oder kurze Videos Ihres Fahrzeugs übermitteln. Bitte achten Sie
            darauf, dass keine Personen zu erkennen sind. Die Dateien werden über unseren Server in
            einem nicht öffentlichen Speicherbereich bei Supabase gespeichert (Supabase Pte. Ltd.,
            65 Chulia Street #38-02/03, OCBC Centre, Singapur 049513; Auftragsverarbeiter).
            Gespeichert werden außerdem Dateiname, Dateityp, Dateigröße und die Zuordnung zum
            Vorgang. Wir nutzen die Aufnahmen zur Beurteilung des Fahrzeugzustands, zur
            Preisprüfung und zur Dokumentation von Vorschäden.
          </p>
          <p>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Die Dokumentation von Vorschäden
            erfolgt zusätzlich auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes
            Interesse ist die Klärung etwaiger Haftungsfragen. Fotos Ihres Fahrzeugs
            veröffentlichen wir nur mit Ihrer gesonderten Zustimmung und ohne lesbares Kennzeichen.
          </p>
          <p>
            Für das Nachreichen speichert Ihr Browser nach der Anfrage eine zufällige,
            vorgangsgebundene Upload-Berechtigung in einem HttpOnly-Cookie. Sie läuft nach sieben
            Tagen ab; bereits gespeicherte Aufnahmen werden dadurch nicht gelöscht (siehe
            Abschnitt 17).
          </p>
        </section>

        <section>
          <h2>5. Auftragsbearbeitung, Angebot und digitale Unterschrift</h2>
          <p>
            Anfragen bearbeiten wir in der Auftragssoftware RO App (Anbieter mit Sitz im
            Vereinigten Königreich, 7 Bell Yard, London WC2A 2JR; Auftragsverarbeiter). Dafür
            übermitteln wir Ihre Kontaktdaten, Fahrzeug- und Anfrageangaben sowie geschützte,
            befristete Links zu Ihren Aufnahmen. Laut Auftragsverarbeitungsvertrag speichert RO
            App die Daten bei Scaleway SAS in Frankreich; für Netzwerkschutz wird Cloudflare
            Germany GmbH eingesetzt. Für das Vereinigte Königreich besteht ein
            Angemessenheitsbeschluss der EU-Kommission (Art. 45 DSGVO).
          </p>
          <p>
            Nach unserer Prüfung erhalten Sie aus RO App eine E-Mail mit unserem verbindlichen
            Angebot und einem Link zu Ihrer Auftragsseite. Dort nehmen Sie das Angebot an und
            unterschreiben digital, indem Sie Ihre Unterschrift auf dem Bildschirm zeichnen.
            Verarbeitet werden dabei Ihr Name, das Unterschriftsbild, Datum und Uhrzeit der
            Annahme sowie technische Verbindungsdaten. Die Unterschrift dient dem Nachweis Ihrer
            Auftragserteilung und der vereinbarten Bedingungen. Wir werten sie nicht biometrisch
            aus.
          </p>
          <p>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragsschluss und -durchführung)
            sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am Nachweis des
            Vertragsschlusses). Bis zum 28. September 2026 haben wir Anfragen im CRM Bitrix24
            verwaltet (Alaio Cloud Limited, Zypern; Speicherung in Rechenzentren in Frankfurt am
            Main). Dort liegende ältere Vorgänge bleiben bis zum Ablauf der Fristen nach Abschnitt
            17 gespeichert.
          </p>
        </section>

        <section>
          <h2>6. E-Mail-Versand und E-Mail-Postfach</h2>
          <p>
            Automatische E-Mails der Website (Eingangsbestätigung, Terminerinnerung,
            Bewertungsbitte, Eingangsbestätigung eines Widerrufs, interne Hinweise) versenden wir
            über Resend (Plus Five Five, Inc., 2261 Market Street #5039, San Francisco, CA 94114,
            USA; Auftragsverarbeiter, Versand über Server in der EU). Dabei werden
            Empfängeradresse, Betreff und Inhalt der Nachricht übermittelt. Buchungsmails können
            zusätzlich über den E-Mail-Server der IONOS SE versendet werden.
          </p>
          <p>
            E-Mails an unsere Adressen @white-gloss.de empfangen wir über IONOS und bearbeiten sie
            in einem Postfach bei Google (Google Ireland Limited, Gordon House, Barrow Street,
            Dublin 4, Irland). Dabei kann Google Daten auch in den USA verarbeiten (siehe
            Abschnitt 16).
          </p>
          <p>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, soweit die Kommunikation einen Vertrag
            betrifft, im Übrigen Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer
            zuverlässigen Kommunikation).
          </p>
        </section>

        <section>
          <h2>7. Terminerinnerung und Bewertungsbitte</h2>
          <p>
            Etwa drei Tage vor einem verbindlich vereinbarten Termin erinnern wir Sie per E-Mail.
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
          </p>
          <p>
            Wenn Sie im Formular eingewilligt haben, bitten wir Sie sieben Tage nach Abschluss
            des Auftrags einmalig per E-Mail um Feedback und eine Bewertung bei Google.
            Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 7 Abs. 2 UWG). Sie
            können die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen, etwa per
            E-Mail an <a href={`mailto:${site.email}`}>{site.email}</a>. Die Bitte um eine
            Bewertung hängt nicht davon ab, ob Sie zufrieden waren.
          </p>
        </section>

        <section>
          <h2>8. Rechnung und Zahlung (Qonto)</h2>
          <p>
            Unser Geschäftskonto führen wir bei Qonto (Qonto SA, 6 impasse Bonne Nouvelle, 75010
            Paris, Frankreich). Rechnungen erstellen und versenden wir über das Rechnungsmodul von
            Qonto. Dafür verarbeitet Qonto als unser Auftragsverarbeiter Ihren Namen, Ihre
            Anschrift, E-Mail-Adresse, die erbrachten Leistungen, Beträge, Rechnungsnummer und
            Fälligkeit. Die Rechnung erhalten Sie per E-Mail von Qonto (Absender
            invoice@qonto.com) mit einem Link zur Rechnung; zur Erinnerung an fällige Rechnungen
            kann Qonto in unserem Auftrag eine weitere E-Mail senden. In Einzelfällen erstellen wir
            Rechnung oder Quittung als PDF über unser Buchungssystem und versenden sie per E-Mail.
          </p>
          <p>
            Zahlen Sie per Überweisung, verarbeitet Qonto als Zahlungsdienstleister Ihren Namen,
            Ihre IBAN, den Betrag und den Verwendungszweck. Bei Kartenzahlung vor Ort über Qonto
            verarbeiten Qonto und die beteiligten Kartenorganisationen die Kartendaten; wir
            erhalten keine vollständige Kartennummer. Für Zahlungsvorgänge ist Qonto
            eigenverantwortlich; es gelten zusätzlich die Datenschutzhinweise von Qonto. Über eine
            gesicherte Schnittstelle meldet Qonto unserem Buchungssystem den Zahlungsstatus einer
            Rechnung (Rechnungsnummer, Betrag, Status, Zahlungsdatum).
          </p>
          <p>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Abrechnung des Vertrags) und Art. 6
            Abs. 1 lit. c DSGVO in Verbindung mit den handels- und steuerrechtlichen Pflichten
            (§ 14 UStG, § 147 AO, § 257 HGB).
          </p>
        </section>

        <section>
          <h2>9. Kontakt per E-Mail, Telefon, WhatsApp und Instagram</h2>
          <p>
            Bei einer Kontaktaufnahme verarbeiten wir Ihre Kontaktdaten und den Inhalt Ihrer
            Nachricht, um Ihr Anliegen zu beantworten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b
            DSGVO bei vorvertraglichen oder vertraglichen Anliegen und im Übrigen Art. 6 Abs. 1
            lit. f DSGVO.
          </p>
          <p>
            Die WhatsApp- und Instagram-Verweise auf dieser Website, einschließlich des
            schwebenden WhatsApp-Buttons, sind einfache Links. Es wird kein Skript dieser Dienste
            geladen und kein Cookie gesetzt. Erst wenn Sie einen solchen Link antippen, stellen
            Sie selbst eine Verbindung zu Meta Platforms Ireland Limited (Merrion Road, Dublin 4,
            D04 X2K5, Irland) her. Dabei können Daten (etwa Gerät, IP-Adresse, die vorausgefüllte
            Nachricht) in die USA übermittelt werden. Es gelten die Datenschutzhinweise von
            WhatsApp bzw. Instagram. Für sensible Inhalte nutzen Sie bitte Telefon oder E-Mail.
          </p>
        </section>

        <section>
          <h2>10. Interne Benachrichtigungen über WhatsApp</h2>
          <p>
            Wenn die Anbindung aktiviert ist, übermittelt unser Server Hinweise zu neuen oder
            geänderten Anfragen über die WhatsApp Cloud API von Meta Platforms Ireland Limited
            an die WhatsApp-Nummer des Inhabers. Die Hinweise können Vorgangsnummer, Kundenname,
            Telefonnummer, gewählte Leistung, Termin, eine gekürzte Notiz und die Art des Vorgangs
            enthalten. Meta meldet Nachrichtenkennungen und Zustellstatus zurück. An Kundinnen und
            Kunden werden über diese Anbindung keine Nachrichten gesendet. Rechtsgrundlage ist
            Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse ist die schnelle Bearbeitung
            Ihrer Anfrage.
          </p>
        </section>

        <section>
          <h2>11. Google-Dienste</h2>
          <h3>a) Google Tag (Google Ads, Google Analytics) – nur mit Einwilligung</h3>
          <p>
            Mit Ihrer Einwilligung setzen wir den Google Tag der Google Ireland Limited ein (Tag-ID
            AW-18384520682, gegebenenfalls zusätzlich eine Google-Analytics-4-Mess-ID). Er misst,
            ob Besuche über unsere Google-Anzeigen zu einer Anfrage führen (Conversion), und
            erstellt Besucherstatistiken. Dabei werden Cookies gesetzt bzw. Informationen auf
            Ihrem Endgerät gespeichert und ausgelesen sowie Daten wie IP-Adresse, Geräte- und
            Browserangaben, aufgerufene Seiten und Interaktionen an Google übertragen.
          </p>
          <p>
            Das Skript wird technisch erst geladen, nachdem Sie im Cookie-Banner „Akzeptieren“
            gewählt haben. Rechtsgrundlage ist Ihre Einwilligung (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1
            lit. a DSGVO). Wählen Sie „Ablehnen“, wird der Google Tag nicht geladen. Über
            „Cookie-Einstellungen“ im Fußbereich jeder Seite können Sie Ihre Wahl jederzeit
            ändern. Mit „Einwilligung widerrufen“ wird die Einwilligung sofort auf abgelehnt
            gesetzt; die Seite lädt neu, bereits geladene Tracking-Skripte werden beendet und
            erreichbare Google-Analyse- und Werbe-Cookies dieser Website entfernt. Die
            Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt. Eine
            werbliche Reichweitenmessung durch Meta (Meta-Pixel) findet nicht statt.
          </p>
          <h3>b) Google Maps – erst nach Klick</h3>
          <p>
            Die Standortkarte zeigt zunächst ein eigenes Kartenbild. Erst wenn Sie „Google Maps
            laden – dabei werden Daten an Google übertragen“ antippen, wird Google Maps (Google
            Ireland Limited) in einem Rahmen geladen; dabei werden insbesondere Ihre IP-Adresse
            und Geräteangaben an Google übertragen. Der Button „Google Maps“ öffnet Google in
            einem neuen Tab. Vor dem Klick stellt Ihr Browser keine Verbindung zu Google her.
            Rechtsgrundlage nach dem Klick ist Ihre Einwilligung (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1
            lit. a DSGVO).
          </p>
          <h3>c) Google-Bewertungen</h3>
          <p>
            Wenn Rezensionen aus unserem Google-Unternehmensprofil auf der Website angezeigt
            werden, ruft unser Server die öffentlichen Angaben bei Google ab und hält sie höchstens
            eine Stunde im Arbeitsspeicher bereit. Dabei werden keine Besucherdaten an Google
            übermittelt. Angezeigt werden Autorenname, Bewertung, Rezensionstext und Datum;
            Profilbilder werden nicht geladen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
            (berechtigtes Interesse an einer transparenten Darstellung öffentlicher
            Kundenbewertungen). Links zu Google stellen erst beim Antippen eine Verbindung her.
          </p>
          <h3>d) Google-Anmeldung zum Betriebspanel</h3>
          <p>
            Der Inhaber und beauftragte Mitarbeiter können sich am internen Betriebspanel über
            Google anmelden. Öffentliche Besucher können dort kein Konto einrichten.
          </p>
          <p>
            Google kann Daten an die Google LLC in den USA übermitteln. Google LLC ist nach dem
            EU-US Data Privacy Framework zertifiziert (siehe Abschnitt 16).
          </p>
        </section>

        <section>
          <h2>12. Cookies und Speicherung im Browser</h2>
          <p>
            Ohne Einwilligung speichern wir nur, was für den von Ihnen gewünschten Dienst
            unbedingt erforderlich ist (§ 25 Abs. 2 Nr. 2 TDDDG): Ihre Auswahl im Cookie-Banner
            (lokaler Speicher „wg-consent“, bis Sie ihn löschen oder Ihre Auswahl ändern), die
            Upload-Berechtigung nach einer Anfrage (HttpOnly-Cookie, sieben Tage) und im
            Betriebspanel ein Sitzungs-Cookie zur Anmeldung. Cookies und Speicherungen des Google
            Tags erfolgen nur mit Ihrer Einwilligung (Abschnitt 11 a).
          </p>
        </section>

        <section>
          <h2>13. Online-Widerrufsfunktion</h2>
          <p>
            Wenn Sie über{" "}
            <Link to="/vertrag-widerrufen">
              Vertrag widerrufen
            </Link>{" "}
            einen Vertrag widerrufen, verarbeiten wir Ihren Namen, die Angaben zum Vertrag, den
            Umfang des Widerrufs, Ihre E-Mail-Adresse sowie Datum und Uhrzeit des Eingangs. Wir
            senden Ihnen damit die gesetzlich vorgeschriebene Eingangsbestätigung (über Resend,
            Abschnitt 6) und bearbeiten den Widerruf. Rechtsgrundlage ist Art. 6 Abs. 1 lit. c
            DSGVO in Verbindung mit § 356a BGB sowie Art. 6 Abs. 1 lit. b DSGVO
            (Rückabwicklung des Vertrags).
          </p>
        </section>

        <section>
          <h2>14. Betriebspanel (nur intern)</h2>
          <p>
            Die Anmeldung zum Betriebspanel ist ausschließlich für den Inhaber und beauftragte
            Mitarbeiter bestimmt. Sie erfolgt per E-Mail und Passwort oder über Google (Abschnitt
            11 d). Google-Anmeldung ist nur für Adressen @white-gloss.de und ausdrücklich
            freigeschaltete Postfächer zulässig.
          </p>
        </section>

        <section>
          <h2>15. Empfänger im Überblick</h2>
          <ul>
            <li>IONOS SE, Deutschland – Hosting, Server, E-Mail-Empfang und -Versand</li>
            <li>Supabase Pte. Ltd., Singapur – Speicherung von Fahrzeugaufnahmen</li>
            <li>RO App, Vereinigtes Königreich – Auftragsbearbeitung, Angebot, Unterschrift</li>
            <li>Alaio Cloud Limited (Bitrix24), Zypern – frühere Auftragsverwaltung bis 28.09.2026</li>
            <li>Plus Five Five, Inc. (Resend), USA – Versand automatischer E-Mails</li>
            <li>Google Ireland Limited, Irland – E-Mail-Postfach, Karten, Bewertungen, Anmeldung, Google Tag (nur mit Einwilligung)</li>
            <li>Qonto SA, Frankreich – Geschäftskonto, Rechnungsstellung, Zahlungen</li>
            <li>Meta Platforms Ireland Limited, Irland – interne WhatsApp-Benachrichtigungen</li>
            <li>Steuerberatung und Behörden, soweit gesetzlich vorgeschrieben</li>
          </ul>
          <p>
            Eine Weitergabe an sonstige Dritte oder ein Verkauf von Daten findet nicht statt.
          </p>
        </section>

        <section>
          <h2>16. Übermittlung in Drittländer</h2>
          <p>
            Einige Empfänger verarbeiten Daten außerhalb der EU oder des EWR. Für das Vereinigte
            Königreich (RO App) besteht ein Angemessenheitsbeschluss der EU-Kommission. Google
            LLC, Meta Platforms, Inc. und Plus Five Five, Inc. (Resend) sind nach dem EU-US Data
            Privacy Framework zertifiziert; Übermittlungen an sie stützen sich auf den
            Angemessenheitsbeschluss der EU-Kommission vom 10. Juli 2023 (Art. 45 DSGVO). Für
            Supabase Pte. Ltd. (Singapur) und etwaige Unterauftragnehmer außerhalb der EU gelten
            die Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO), die
            Bestandteil der jeweiligen Auftragsverarbeitungsbedingungen sind. Eine Kopie können
            Sie bei uns anfordern.
          </p>
        </section>

        <section>
          <h2>17. Speicherdauer</h2>
          <ul>
            <li>
              Anfragen, aus denen kein Auftrag entsteht, löschen wir spätestens zwölf Monate nach
              dem letzten Kontakt.
            </li>
            <li>
              Fahrzeugaufnahmen löschen wir, sobald sie für Angebot, Auftrag und die Klärung
              etwaiger Ansprüche nicht mehr benötigt werden, spätestens nach Ablauf der
              regelmäßigen Verjährungsfrist von drei Jahren ab Ende des Jahres, in dem der Auftrag
              abgeschlossen wurde.
            </li>
            <li>
              Angebote, angenommene Aufträge mit Unterschrift und geschäftliche Korrespondenz
              bewahren wir sechs Jahre auf (§ 257 HGB, § 147 AO), Rechnungen und sonstige
              Buchungsbelege acht Jahre, jeweils ab Ende des Kalenderjahres.
            </li>
            <li>
              Widerrufserklärungen bewahren wir zusammen mit den zugehörigen Vertragsunterlagen
              auf.
            </li>
            <li>
              Ihre Einwilligung zur Bewertungsbitte speichern wir, bis die E-Mail versendet oder
              die Einwilligung widerrufen wurde; den Nachweis der Einwilligung bis zu drei Jahre.
            </li>
            <li>Server-Protokolle löschen wir, sobald sie für die Sicherheit nicht mehr nötig sind.</li>
          </ul>
          <p>
            Danach werden die Daten gelöscht, sofern keine vorrangige gesetzliche Pflicht
            entgegensteht.
          </p>
        </section>

        <section>
          <h2>18. Pflicht zur Bereitstellung, keine automatisierte Entscheidung</h2>
          <p>
            Die Bereitstellung Ihrer Daten ist weder gesetzlich noch vertraglich vorgeschrieben.
            Ohne die als Pflichtfeld gekennzeichneten Angaben können wir Ihre Anfrage jedoch
            nicht bearbeiten und keinen Vertrag schließen. Eine automatisierte Entscheidung
            einschließlich Profiling nach Art. 22 DSGVO findet nicht statt; Preise und Termine
            prüft und bestätigt der Inhaber persönlich.
          </p>
        </section>

        <section>
          <h2>19. Ihre Rechte</h2>
          <p>
            Sie haben im Rahmen der gesetzlichen Voraussetzungen das Recht auf Auskunft (Art. 15
            DSGVO), Berichtigung (Art. 16 DSGVO), Löschung (Art. 17 DSGVO), Einschränkung der
            Verarbeitung (Art. 18 DSGVO) und Datenübertragbarkeit (Art. 20 DSGVO). Eine erteilte
            Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs.
            3 DSGVO).
          </p>
          <p>
            <strong className="text-fg">Widerspruchsrecht:</strong> Verarbeiten wir Ihre Daten auf
            Grundlage von Art. 6 Abs. 1 lit. f DSGVO, können Sie dieser Verarbeitung jederzeit aus
            Gründen, die sich aus Ihrer besonderen Situation ergeben, widersprechen (Art. 21
            DSGVO). Wir verarbeiten die Daten dann nicht mehr, es sei denn, wir können zwingende
            schutzwürdige Gründe nachweisen, die Ihre Interessen überwiegen, oder die Verarbeitung
            dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.
          </p>
          <p>
            Für Datenschutzanfragen genügt eine Nachricht an{" "}
            <a href={`mailto:${site.email}`}>{site.email}</a>. Wie Sie eine Löschung anfragen
            können, beschreibt die <Link to="/datenloeschung">Anleitung zur Datenlöschung</Link>.
          </p>
        </section>

        <section>
          <h2>20. Beschwerderecht</h2>
          <p>
            Sie können sich bei einer Datenschutz-Aufsichtsbehörde beschweren, insbesondere beim
            für uns zuständigen Landesbeauftragten für den Datenschutz und die
            Informationsfreiheit Baden-Württemberg, Lautenschlagerstraße 20, 70173 Stuttgart.
          </p>
        </section>

        <section>
          <h2>21. Aktualisierung</h2>
          <p>
            Wir passen diese Hinweise an, wenn sich Funktionen, eingesetzte Dienste oder
            rechtliche Anforderungen ändern. Es gilt die jeweils hier veröffentlichte Fassung.
          </p>
        </section>

        <p>
          <CookieSettingsButton />
        </p>
        <p className="text-xs text-subtle">Stand: 1. Oktober 2026</p>
      </article>
    </main>
  );
}
