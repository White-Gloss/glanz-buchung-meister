import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/widerruf")({
  component: WithdrawalPage,
  head: () =>
    pageHead({
      title: `Widerrufsbelehrung | ${site.name}`,
      description: "Widerrufsbelehrung und Muster-Widerrufsformular von White Gloss Detailing.",
      path: "/widerruf",
    }),
});

function WithdrawalPage() {
  const providerAddress = `${site.legalName}, ${site.owner}, ${site.street}, ${site.postalCode} ${site.city}`;

  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="atelier"
        alt={`Werkstatt von White Gloss in ${site.city}`}
        kicker="Rechtliches"
        title="Widerrufsbelehrung."
        lead="Informationen zum Widerrufsrecht und ein Musterformular für Ihren Widerruf."
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Widerruf" },
        ]}
      />
      <article className="prose-legal mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <section>
          <h2>Widerrufsrecht</h2>
          <p>
            Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu
            widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses.
          </p>
          <p>
            Um Ihr Widerrufsrecht auszuüben, müssen Sie uns ({providerAddress}, Telefon:{" "}
            <a href={site.phoneHref}>{site.phoneDisplay}</a>, E-Mail:{" "}
            <a href={`mailto:${site.email}`}>{site.email}</a>) mittels einer eindeutigen Erklärung
            (z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren Entschluss, diesen
            Vertrag zu widerrufen, informieren. Sie können dafür das untenstehende
            Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.
          </p>
          <p>
            Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung
            des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
          </p>
        </section>

        <section>
          <h2>Folgen des Widerrufs</h2>
          <p>
            Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen
            erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten,
            die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns
            angebotene günstigste Standardlieferung gewählt haben), unverzüglich und spätestens
            binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren
            Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir
            dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es
            sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden
            Ihnen wegen dieser Rückzahlung Entgelte berechnet.
          </p>
        </section>

        <section>
          <h2>Besondere Hinweise bei Dienstleistungen</h2>
          <p>
            Haben Sie verlangt, dass die Dienstleistung während der Widerrufsfrist beginnen soll, so
            haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem
            Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts unterrichten, bereits
            erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen
            Dienstleistungen entspricht.
          </p>
          <p>
            Ihr Widerrufsrecht erlischt bei einem Vertrag über die Erbringung von Dienstleistungen,
            wenn wir die Dienstleistung vollständig erbracht haben und mit der Ausführung der
            Dienstleistung erst begonnen haben, nachdem Sie dazu Ihre ausdrückliche Zustimmung
            gegeben und gleichzeitig bestätigt haben, dass Sie Ihr Widerrufsrecht bei vollständiger
            Vertragserfüllung durch uns verlieren.
          </p>
        </section>

        <section>
          <h2>Muster-Widerrufsformular</h2>
          <p>
            Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und
            senden Sie es zurück.
          </p>
          <div className="rounded-card border border-line bg-surface p-5 text-sm leading-7 text-muted">
            <p>An {providerAddress}</p>
            <p>
              E-Mail: <a href={`mailto:${site.email}`}>{site.email}</a>
            </p>
            <p className="mt-4">
              Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die
              Erbringung der folgenden Dienstleistung:
            </p>
            <p>Bestellt am (*) / erhalten am (*):</p>
            <p>Name des/der Verbraucher(s):</p>
            <p>Anschrift des/der Verbraucher(s):</p>
            <p>Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier):</p>
            <p>Datum:</p>
            <p>(*) Unzutreffendes streichen.</p>
          </div>
        </section>

        <p className="text-xs text-subtle">Stand: 3. September 2026</p>
      </article>
    </main>
  );
}
