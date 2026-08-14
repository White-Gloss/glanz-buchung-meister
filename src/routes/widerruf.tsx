import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { absUrl } from "@/lib/seo";
import { company } from "@/lib/servicesConfig";

const TITLE = "Widerrufsbelehrung | White Gloss Detailing";

export const Route = createFileRoute("/widerruf")({
  head: () => ({
    meta: [
      { title: TITLE },
      {
        name: "description",
        content: "Widerrufsbelehrung und Muster-Widerrufsformular von White Gloss Detailing.",
      },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [
      { rel: "canonical", href: absUrl("/widerruf") },
      { rel: "alternate", hrefLang: "de-DE", href: absUrl("/widerruf") },
      { rel: "alternate", hrefLang: "x-default", href: absUrl("/widerruf") },
    ],
  }),
  component: WithdrawalPage,
});

function WithdrawalPage() {
  const providerAddress = `${company.name}, ${company.owner}, ${company.street}, ${company.city}`;

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
              <span className="text-foreground">Widerruf</span>
            </nav>
            <p className="eyebrow mt-8">Rechtliches</p>
            <h1 className="display-page mt-3 uppercase">Widerrufsbelehrung</h1>
          </div>
        </section>

        <article className="prose-legal mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <section>
            <h2>Widerrufsrecht</h2>
            <p>
              Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu
              widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses.
            </p>
            <p>
              Um Ihr Widerrufsrecht auszuüben, müssen Sie uns ({providerAddress}, Telefon:{" "}
              <a href={company.phoneHref}>{company.phone}</a>, E-Mail:{" "}
              <a href={`mailto:${company.email}`}>{company.email}</a>) mittels einer eindeutigen
              Erklärung (z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren Entschluss,
              diesen Vertrag zu widerrufen, informieren. Sie können dafür das untenstehende
              Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.
            </p>
            <p>
              Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die
              Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
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
              dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben,
              es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall
              werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.
            </p>
          </section>

          <section>
            <h2>Besondere Hinweise bei Dienstleistungen</h2>
            <p>
              Haben Sie verlangt, dass die Dienstleistung während der Widerrufsfrist beginnen soll,
              so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem
              Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts unterrichten, bereits
              erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen
              Dienstleistungen entspricht.
            </p>
            <p>
              Ihr Widerrufsrecht erlischt bei einem Vertrag über die Erbringung von
              Dienstleistungen, wenn wir die Dienstleistung vollständig erbracht haben und mit der
              Ausführung der Dienstleistung erst begonnen haben, nachdem Sie dazu Ihre ausdrückliche
              Zustimmung gegeben und gleichzeitig bestätigt haben, dass Sie Ihr Widerrufsrecht bei
              vollständiger Vertragserfüllung durch uns verlieren.
            </p>
          </section>

          <section>
            <h2>Muster-Widerrufsformular</h2>
            <p>
              Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und
              senden Sie es zurück.
            </p>
            <div className="rounded-2xl border border-border bg-secondary/30 p-5 text-sm leading-7 text-foreground/85">
              <p>An {providerAddress}</p>
              <p>
                E-Mail: <a href={`mailto:${company.email}`}>{company.email}</a>
              </p>
              <br />
              <p>
                Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über
                die Erbringung der folgenden Dienstleistung:
              </p>
              <p>Bestellt am (*) / erhalten am (*):</p>
              <p>Name des/der Verbraucher(s):</p>
              <p>Anschrift des/der Verbraucher(s):</p>
              <p>Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier):</p>
              <p>Datum:</p>
              <p>(*) Unzutreffendes streichen.</p>
            </div>
          </section>

          <p className="text-xs text-muted-foreground">Stand: 8. August 2026</p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
