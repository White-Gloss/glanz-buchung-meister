import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { absUrl } from "@/lib/seo";
import { company } from "@/lib/servicesConfig";

const TITLE = "AGB | White Gloss Detailing";

export const Route = createFileRoute("/agb")({
  head: () => ({
    meta: [
      { title: TITLE },
      {
        name: "description",
        content:
          "Allgemeine Geschäftsbedingungen von White Gloss Detailing für Fahrzeugaufbereitung.",
      },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [
      { rel: "canonical", href: absUrl("/agb") },
      { rel: "alternate", hrefLang: "de-DE", href: absUrl("/agb") },
      { rel: "alternate", hrefLang: "x-default", href: absUrl("/agb") },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
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
              <span className="text-foreground">AGB</span>
            </nav>
            <p className="eyebrow mt-8">Rechtliches</p>
            <h1 className="display-page mt-3 uppercase">Allgemeine Geschäftsbedingungen</h1>
          </div>
        </section>

        <article className="prose-legal mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <p>
            Diese Allgemeinen Geschäftsbedingungen gelten für Leistungen der Fahrzeugaufbereitung
            von {company.name}, Inhaber {company.owner}, {company.street}, {company.city}{" "}
            (nachfolgend „wir“ oder „White Gloss Detailing“), gegenüber Verbrauchern und
            Unternehmern.
          </p>

          <section>
            <h2>1. Anfrage, Angebot und Vertragsschluss</h2>
            <p>
              Die über die Website übermittelte Konfiguration und Terminanfrage ist unverbindlich.
              Sie stellt noch keinen verbindlichen Auftrag und keine verbindliche Preiszusage dar.
            </p>
            <p>
              Nach Sichtung der Angaben, Fotos und – soweit erforderlich – nach Besichtigung des
              Fahrzeugs stimmen wir Leistungsumfang, verbindlichen Preis und Termin persönlich mit
              Ihnen ab. Ein Vertrag kommt erst zustande, wenn wir den Auftrag ausdrücklich
              bestätigen oder mit der vereinbarten Leistung beginnen.
            </p>
          </section>

          <section>
            <h2>2. Preise und Fahrzeugzustand</h2>
            <p>
              Die auf der Website angezeigten Preise sind Orientierungspreise für die gewählte
              Fahrzeugklasse, das Paket und die Zusatzleistungen. Der tatsächliche Aufwand hängt
              insbesondere von Größe, Verschmutzung, Material, Vorschäden und dem dokumentierten
              Fahrzeugzustand ab. Deshalb kann der verbindliche Preis nach der Prüfung vom
              angezeigten Richtwert abweichen. Änderungen werden vor Beginn der Arbeiten mit Ihnen
              abgestimmt.
            </p>
            <p>
              Alle Preise sind, sofern nicht anders angegeben, Endpreise einschließlich der
              gesetzlich geschuldeten Umsatzsteuer.
            </p>
          </section>

          <section>
            <h2>3. Termine, Übergabe und Mitwirkung</h2>
            <p>
              Der übermittelte Termin ist ein Terminwunsch. Den genauen Termin, die Uhrzeit sowie
              bei Hol- und Bringservice die Übergabe stimmen wir in der Regel drei bis vier Tage vor
              dem Termin telefonisch oder per E-Mail ab. Können wir den Wunschtermin nicht anbieten,
              schlagen wir einen Ausweichtermin vor.
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
              Fahrzeugzustand. Bei der Übergabe dokumentieren die Parteien erkennbare Vorschäden,
              soweit dies angemessen möglich ist.
            </p>
          </section>

          <section>
            <h2>5. Anzahlungen und Zahlung</h2>
            <p>
              Bei Neukunden kann nach Annahme des Auftrags eine Anzahlung von 10 % des verbindlich
              vereinbarten Gesamtbetrags verlangt werden. Die Anzahlung wird auf den Gesamtbetrag
              angerechnet. Ohne abweichende Vereinbarung ist der Restbetrag vor Ort in bar oder
              spätestens innerhalb von sieben Tagen nach Leistungserbringung per Überweisung fällig.
            </p>
          </section>

          <section>
            <h2>6. Ausführung der Leistung</h2>
            <p>
              Die Aufbereitung erfolgt fachgerecht und materialgerecht im vereinbarten Umfang. Das
              Ergebnis richtet sich nach Alter, Zustand, Material und vorhandenen Vorschäden des
              Fahrzeugs. Eine vollständige Beseitigung aller Verschmutzungen, Gerüche, Kratzer,
              Verfärbungen oder sonstiger Spuren kann nicht zugesagt werden, wenn dies technisch,
              materialbedingt oder wirtschaftlich nicht möglich ist. Gesetzliche Mängelrechte
              bleiben unberührt.
            </p>
          </section>

          <section>
            <h2>7. Haftung</h2>
            <p>
              Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Schäden aus der
              Verletzung von Leben, Körper oder Gesundheit sowie nach zwingenden gesetzlichen
              Vorschriften. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist
              die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt. Im Übrigen ist
              die Haftung für leichte Fahrlässigkeit ausgeschlossen.
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
              Verträgen die gesetzlich erforderliche Widerrufsbelehrung. Sie finden diese auch unter{" "}
              <Link to="/widerruf">Widerruf</Link>.
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

          <p className="text-xs text-muted-foreground">Stand: 8. August 2026</p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
