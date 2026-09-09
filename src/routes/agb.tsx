import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { depositConfig, pickupKeramikNote, pickupTierSummary, site } from "@/data/site";
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
        lead="Anfrage, Ausführung, Zahlung – in klarer Sprache."
        crumbs={[{ label: "Startseite", to: "/" }, { label: "AGB" }]}
      />
      <article className="prose-legal mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p>
          Diese Allgemeinen Geschäftsbedingungen gelten für Leistungen der Fahrzeugaufbereitung von{" "}
          {site.legalName}, Inhaber {site.owner}, {site.street}, {site.postalCode} {site.city}{" "}
          (nachfolgend „wir“ oder „White Gloss Detailing“), gegenüber Verbrauchern und Unternehmern.
        </p>

        <section>
          <h2>1. Anfrage, Angebot und Vertragsschluss</h2>
          <p>
            Die über die Website übermittelte Konfiguration und Terminanfrage ist unverbindlich. Sie
            stellt noch keinen verbindlichen Auftrag und keine verbindliche Preiszusage dar.
          </p>
          <p>
            Nach Sichtung der Angaben, Fotos und – soweit erforderlich – nach Besichtigung des
            Fahrzeugs stimmen wir Leistungsumfang, verbindlichen Preis und Termin persönlich mit
            Ihnen ab. Ein Vertrag über die Aufbereitung kommt erst zustande, wenn wir den Auftrag
            ausdrücklich bestätigen oder mit der vereinbarten Leistung beginnen. Ein Wunschtermin
            wird erst nach persönlicher Prüfung ausdrücklich vom Inhaber bestätigt. Die Uhrzeit
            bezeichnet die Fahrzeugabgabe. Der verbindliche Endpreis wird gesondert abgestimmt.
          </p>
        </section>

        <section>
          <h2>2. Preise und Fahrzeugzustand</h2>
          <p>
            Die auf der Website angezeigten Preise sind Orientierungspreise für die gewählte
            Fahrzeugklasse, das Paket und die Zusatzleistungen. Der tatsächliche Aufwand hängt
            insbesondere von Größe, Verschmutzung, Material, Vorschäden und dem dokumentierten
            Fahrzeugzustand ab. Deshalb kann der verbindliche Preis nach der Prüfung vom angezeigten
            Richtwert abweichen. Änderungen werden vor Beginn der Arbeiten mit Ihnen abgestimmt.
          </p>
          <p>
            Alle Preise sind, sofern nicht anders angegeben, Endpreise einschließlich der gesetzlich
            geschuldeten Umsatzsteuer ({site.vatNote}).
          </p>
        </section>

        <section>
          <h2>3. Termine, Übergabe und Mitwirkung</h2>
          <p>
            Der übermittelte Termin ist ein Terminwunsch. Der Inhaber prüft die Anfrage persönlich
            und bestätigt den Termin ausdrücklich. Bis zu dieser Freigabe bleibt die Anfrage offen.
            Die angegebene Uhrzeit bezeichnet die Fahrzeugabgabe. Den genauen Hol- und Bringservice
            sowie die Übergabe stimmen wir in der Regel drei bis vier Tage vor dem Termin
            telefonisch oder per E-Mail ab. Können wir den Wunschtermin nicht anbieten, schlagen wir
            einen Ausweichtermin vor.
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
          <h2>4. Hol- und Bringservice</h2>
          <p>
            Ein Hol- und Bringservice wird nur nach vorheriger Bestätigung erbracht. Abholort,
            Übergabezeit und Preis richten sich nach der vereinbarten Entfernung und dem
            Fahrzeugzustand ({pickupTierSummary()}. {pickupKeramikNote()}). Bei der Übergabe
            dokumentieren die Parteien erkennbare Vorschäden, soweit dies angemessen möglich ist.
            Die Aufbereitung erfolgt ausschließlich in der Werkstatt in {site.city}.
          </p>
        </section>

        <section>
          <h2>5. Anzahlungen und Zahlung</h2>
          <p>
            Bei Neukunden kann nach Annahme des Auftrags eine Anzahlung von{" "}
            {Math.round(depositConfig.rate * 100)} % des verbindlich vereinbarten Gesamtbetrags
            verlangt werden. Die Anzahlung wird auf den Gesamtbetrag angerechnet. Es erfolgt kein
            automatischer Einzug. Ohne abweichende Vereinbarung ist der Restbetrag vor Ort in bar
            oder spätestens innerhalb von sieben Tagen nach Leistungserbringung per Überweisung
            fällig.
          </p>
        </section>

        <section>
          <h2>6. Ausführung der Leistung</h2>
          <p>
            Die Aufbereitung erfolgt fachgerecht und materialgerecht im vereinbarten Umfang. Das
            Ergebnis richtet sich nach Alter, Zustand, Material und vorhandenen Vorschäden des
            Fahrzeugs. Eine vollständige Beseitigung aller Verschmutzungen, Gerüche, Kratzer,
            Verfärbungen oder sonstiger Spuren kann nicht zugesagt werden, wenn dies technisch,
            materialbedingt oder wirtschaftlich nicht möglich ist. Gesetzliche Mängelrechte bleiben
            unberührt.
          </p>
        </section>

        <section>
          <h2>7. Haftung</h2>
          <p>
            Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Schäden aus der
            Verletzung von Leben, Körper oder Gesundheit sowie nach zwingenden gesetzlichen
            Vorschriften. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die
            Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt. Im Übrigen ist die
            Haftung für leichte Fahrlässigkeit ausgeschlossen.
          </p>
          <p>
            Für bereits vorhandene Schäden, verdeckte Mängel, alters- oder materialbedingte
            Veränderungen sowie Schäden, die auf unzutreffenden oder unterlassenen Angaben zum
            Fahrzeugzustand beruhen, haften wir nur nach den gesetzlichen Vorschriften.
          </p>
        </section>

        <section>
          <h2>8. Widerrufsrecht für Verbraucher</h2>
          <p>
            Verbraucher erhalten bei Fernabsatz- oder außerhalb von Geschäftsräumen geschlossenen
            Verträgen die gesetzlich erforderliche Widerrufsbelehrung. Sie finden diese unter{" "}
            <Link to="/widerruf">Widerruf</Link>. Die Frist beginnt mit dem Vertragsschluss – also
            erst mit unserer ausdrücklichen Zusage oder mit Beginn der vereinbarten Leistung, nicht
            schon mit der unverbindlichen Online-Anfrage. Die vollständige Widerrufsbelehrung
            erscheint auch auf der Bestätigungsseite.
          </p>
        </section>

        <section>
          <h2>9. Schlussbestimmungen</h2>
          <p>
            Es gilt deutsches Recht. Gegenüber Verbrauchern gilt dies nur, soweit dadurch kein
            zwingender gesetzlicher Schutz des Staates des gewöhnlichen Aufenthalts entzogen wird.
            Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen
            unberührt.
          </p>
        </section>

        <p className="text-xs text-subtle">Stand: 7. September 2026</p>
      </article>
    </main>
  );
}
