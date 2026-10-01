import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { paymentNote, pickupKeramikNote, pickupTierSummary, site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/agb")({
  component: TermsPage,
  head: () =>
    pageHead({
      title: `AGB | ${site.name}`,
      description:
        "Allgemeine Geschäftsbedingungen von White Gloss Detailing für Fahrzeugaufbereitung.",
      path: "/agb",
    }),
});

function TermsPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="atelier"
        alt={`Werkstatt von White Gloss in ${site.city}`}
        kicker="Rechtliches"
        title="Allgemeine Geschäftsbedingungen."
        lead="Anfrage, Vertragsschluss, Ausführung und Zahlung – in klarer Sprache."
        crumbs={[{ label: "Startseite", to: "/" }, { label: "AGB" }]}
      />
      <article className="prose-legal mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p>
          Diese Allgemeinen Geschäftsbedingungen gelten für Leistungen der Fahrzeugaufbereitung von{" "}
          {site.ownerLegalName}, handelnd unter der Geschäftsbezeichnung {site.legalName},{" "}
          {site.street}, {site.postalCode} {site.city} (nachfolgend „wir“), gegenüber Verbrauchern
          und Unternehmern. Verbraucher ist jede natürliche Person, die ein Rechtsgeschäft zu
          Zwecken abschließt, die überwiegend weder ihrer gewerblichen noch ihrer selbständigen
          beruflichen Tätigkeit zugerechnet werden können (§ 13 BGB).
        </p>

        <section>
          <h2>1. Anfrage, Angebot und Vertragsschluss</h2>
          <p>
            Die Darstellung unserer Leistungen und Preise auf der Website ist kein bindendes
            Angebot. Die über die Website, per E-Mail, Telefon oder WhatsApp übermittelte
            Konfiguration und Terminanfrage ist unverbindlich und begründet keine Zahlungspflicht.
          </p>
          <p>
            Nach Sichtung Ihrer Angaben, Fotos und – soweit erforderlich – einer Besichtigung des
            Fahrzeugs senden wir Ihnen ein verbindliches Angebot mit Leistungsumfang, Festpreis und
            angebotenem Zeitraum per E-Mail. Die E-Mail enthält einen Link zu Ihrer persönlichen
            Auftragsseite, auf der Sie das Angebot prüfen können.
          </p>
          <p>
            Der Vertrag kommt zustande, wenn Sie das Angebot auf der Auftragsseite annehmen und
            unterschreiben. Wird ein Auftrag persönlich in unserer Werkstatt vereinbart, kommt der
            Vertrag mit der beiderseitigen Einigung über Leistung und Preis zustande. Die genaue
            Uhrzeit der Fahrzeugübergabe sowie Abholung oder eigene Anlieferung stimmen wir nach dem
            Vertragsschluss persönlich mit Ihnen ab.
          </p>
          <p>
            Nach dem Vertragsschluss erhalten Sie eine Bestätigung mit dem Vertragsinhalt, diesen
            AGB und der Widerrufsbelehrung auf einem dauerhaften Datenträger (in der Regel per
            E-Mail), spätestens bevor wir mit der Ausführung beginnen.
          </p>
        </section>

        <section>
          <h2>2. Vertragssprache, Vertragstext und Korrektur von Eingaben</h2>
          <p>
            Vertragssprache ist Deutsch. Wir speichern den Vertragstext (Angebot, Annahme und diese
            AGB). Sie erhalten Angebot und Vertragsbestätigung per E-Mail und können die jeweils
            aktuellen AGB jederzeit auf dieser Seite abrufen, speichern und ausdrucken.
          </p>
          <p>
            Eingaben im Anfrageformular können Sie vor dem Absenden über die Schaltflächen „Zurück“
            und durch Ändern der Felder korrigieren. Vor der Annahme des Angebots sehen Sie auf der
            Auftragsseite Leistungen, Festpreis und Zeitraum und können die Seite ohne Annahme
            verlassen. Fehler in einer bereits gesendeten Anfrage korrigieren wir auf Ihren Hinweis
            per E-Mail oder Telefon. Wir haben uns keinem besonderen Verhaltenskodex unterworfen.
          </p>
        </section>

        <section>
          <h2>3. Preise und Fahrzeugzustand</h2>
          <p>
            Die auf der Website angezeigten Preise sind Ab-Preise und dienen der Orientierung für
            die gewählte Fahrzeugklasse, das Paket und die Zusatzleistungen. Der tatsächliche
            Aufwand hängt insbesondere von Größe, Verschmutzung, Material, Vorschäden und dem
            dokumentierten Fahrzeugzustand ab. Maßgeblich ist der Festpreis aus unserem Angebot.
            Zeigt sich nach Vertragsschluss ein Mehraufwand, der für uns bei der Angebotserstellung
            nicht erkennbar war, führen wir Mehrarbeiten nur nach Ihrer vorherigen Zustimmung aus.
          </p>
          <p>
            Alle Preise sind Endpreise einschließlich der gesetzlichen Umsatzsteuer ({site.vatNote}).
          </p>
        </section>

        <section>
          <h2>4. Termine, Übergabe und Mitwirkung</h2>
          <p>
            Der bei der Anfrage gewählte Termin ist ein Terminwunsch. Verbindlich ist der Zeitraum
            aus dem angenommenen Angebot. Den genauen Hol- und Bringservice sowie die Übergabe
            stimmen wir in der Regel drei bis vier Tage vor dem Termin telefonisch oder per E-Mail
            ab. Können wir den Wunschtermin nicht anbieten, schlagen wir einen Ausweichtermin vor.
          </p>
          <p>
            Bitte übergeben Sie das Fahrzeug mit allen für die vereinbarte Leistung notwendigen
            Schlüsseln und informieren Sie uns vor Beginn über bekannte Vorschäden, besondere
            Materialien, technische Besonderheiten, empfindliche Oberflächen und Wertgegenstände.
            Persönliche Gegenstände und Wertsachen sind vor der Übergabe aus dem Fahrzeug zu
            entfernen.
          </p>
        </section>

        <section>
          <h2>5. Hol- und Bringservice</h2>
          <p>
            Ein Hol- und Bringservice wird nur nach vorheriger Vereinbarung erbracht. Abholort,
            Übergabezeit und Preis richten sich nach der vereinbarten Entfernung und dem
            Fahrzeugzustand ({pickupTierSummary()}. {pickupKeramikNote()}). Bei der Übergabe
            dokumentieren die Parteien erkennbare Vorschäden, soweit dies angemessen möglich ist.
            Die Aufbereitung erfolgt ausschließlich in der Werkstatt in {site.city}.
          </p>
        </section>

        <section>
          <h2>6. Zahlung</h2>
          <p>
            {paymentNote} Nach Leistungserbringung erhalten Sie eine Rechnung. Der Rechnungsbetrag
            ist ohne Abzug bis zu dem auf der Rechnung genannten Fälligkeitsdatum zu zahlen, und
            zwar per Überweisung auf das in der Rechnung angegebene Konto oder vor Ort in bar oder,
            soweit angeboten, per Karte.
          </p>
        </section>

        <section>
          <h2>7. Ausführung der Leistung und Mängelrechte</h2>
          <p>
            Die Aufbereitung erfolgt fachgerecht und materialgerecht im vereinbarten Umfang. Das
            Ergebnis richtet sich nach Alter, Zustand, Material und vorhandenen Vorschäden des
            Fahrzeugs. Eine vollständige Beseitigung aller Verschmutzungen, Gerüche, Kratzer,
            Verfärbungen oder sonstiger Spuren kann nicht zugesagt werden, wenn dies technisch,
            materialbedingt oder wirtschaftlich nicht möglich ist; hierauf weisen wir Sie im
            Angebot hin, soweit es für Ihr Fahrzeug erkennbar ist.
          </p>
          <p>
            Es gelten die gesetzlichen Mängelrechte. Herstellerangaben zur Haltbarkeit von
            Versiegelungen sind Richtwerte und keine Garantie im Rechtssinne.
          </p>
        </section>

        <section>
          <h2>8. Haftung</h2>
          <p>
            Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Schäden aus der
            Verletzung von Leben, Körper oder Gesundheit, nach dem Produkthaftungsgesetz sowie
            nach sonstigen zwingenden gesetzlichen Vorschriften. Bei leicht fahrlässiger
            Verletzung wesentlicher Vertragspflichten (Pflichten, deren Erfüllung die
            ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren
            Einhaltung Sie regelmäßig vertrauen dürfen) ist die Haftung auf den vertragstypischen,
            vorhersehbaren Schaden begrenzt. Im Übrigen ist die Haftung für leichte Fahrlässigkeit
            ausgeschlossen.
          </p>
          <p>
            Für bereits vorhandene Schäden, verdeckte Mängel, alters- oder materialbedingte
            Veränderungen sowie Schäden, die auf unzutreffenden oder unterlassenen Angaben zum
            Fahrzeugzustand beruhen, haften wir nur nach den gesetzlichen Vorschriften.
          </p>
        </section>

        <section>
          <h2>9. Widerrufsrecht für Verbraucher</h2>
          <p>
            Verbrauchern steht bei Verträgen, die ausschließlich über Fernkommunikationsmittel oder
            außerhalb unserer Geschäftsräume geschlossen werden, ein gesetzliches Widerrufsrecht
            zu. Einzelheiten enthält die <Link to="/widerruf">Widerrufsbelehrung</Link>. Die Frist
            beginnt mit dem Vertragsschluss – also mit Ihrer Annahme des Angebots, nicht schon mit
            der unverbindlichen Online-Anfrage. Sie können den Widerruf auch online über{" "}
            <Link to="/vertrag-widerrufen">
              Vertrag widerrufen
            </Link>{" "}
            erklären.
          </p>
          <p>
            Soll die Leistung vor Ablauf der Widerrufsfrist beginnen, bitten wir Sie vor Beginn um
            Ihr ausdrückliches Verlangen. Widerrufen Sie danach, schulden Sie Wertersatz für die bis
            zum Widerruf erbrachten Leistungen. Ist die Leistung vollständig erbracht, erlischt das
            Widerrufsrecht unter den in der Widerrufsbelehrung genannten Voraussetzungen.
          </p>
        </section>

        <section>
          <h2>10. Streitbeilegung</h2>
          <p>
            Wir sind nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor
            einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </section>

        <section>
          <h2>11. Schlussbestimmungen</h2>
          <p>
            Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
            Gegenüber Verbrauchern gilt diese Rechtswahl nur, soweit dadurch kein zwingender
            gesetzlicher Schutz des Staates ihres gewöhnlichen Aufenthalts entzogen wird. Sollte
            eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen
            unberührt.
          </p>
        </section>

        <p className="text-xs text-subtle">Stand: 1. Oktober 2026</p>
      </article>
    </main>
  );
}
