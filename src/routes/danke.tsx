import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { ctaGhost, ctaPrimary } from "@/components/ui";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";
import { BookingPhotoUpload } from "@/components/booking-photo-upload";
import { BookingStatus } from "@/components/booking-status";

type ThanksSearch = {
  vorgang?: string;
};

function asVorgang(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const ref = value.replace(/['"]/g, "").trim();
  return /^WG-\d+$/.test(ref) ? ref : undefined;
}

export const Route = createFileRoute("/danke")({
  validateSearch: (search: Record<string, unknown>): ThanksSearch => ({
    vorgang: asVorgang(search.vorgang),
  }),
  component: ThanksPage,
  head: () =>
    pageHead({
      title: `Anfrage erhalten | ${site.name}`,
      description: "Ihre Terminanfrage ist eingegangen.",
      path: "/danke",
      robots: "noindex,nofollow",
    }),
});

function ThanksPage() {
  const { vorgang } = Route.useSearch();

  const steps = [
    [
      "01",
      "Anfrage eingegangen",
      "Ihre Angaben und ausgewählten Fotos sind bei uns eingegangen. Preis und Wunschtermin sind noch nicht verbindlich bestätigt.",
    ],
    [
      "02",
      "Fotos, Fixpreis und Termin prüfen",
      "Wir begutachten Ihre Fotos und klären die Leistungen, den vollständigen Endpreis und den Termin. Bei Rückfragen melden wir uns bei Ihnen.",
    ],
    [
      "03",
      "Auftrag prüfen und unterschreiben",
      "Nach unserer Freigabe erhalten Sie die Bestätigung mit dem Link zur Auftragsannahme. Prüfen Sie Leistungen, Fixpreis und Termin und unterschreiben Sie selbst über den Link.",
    ],
    [
      "04",
      "Aufbereitung und Rechnung",
      "Wir führen die vereinbarten Arbeiten aus. Die Rechnung erhalten Sie nach erbrachter Leistung; dann wird die Zahlung fällig.",
    ],
  ];

  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="atelier"
        alt="Werkstatt von White Gloss in Horb am Neckar"
        kicker="Anfrage eingegangen"
        title="Danke. Anfrage erhalten."
        lead="Ihre Anfrage ist eingegangen. Wir prüfen jetzt Ihre Angaben und Fotos. Den Fixpreis und den Termin bestätigen wir nach der Begutachtung."
        crumbs={[{ label: "Startseite", to: "/" }, { label: "Danke" }]}
        actions={
          <>
            <Link to="/" className={ctaPrimary}>
              Zur Startseite
            </Link>
            <a href={site.whatsapp} className={ctaGhost} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </>
        }
      />

      <section className="section mx-auto max-w-3xl px-4 sm:px-6">
        {vorgang ? (
          <>
            <p className="border border-line bg-surface px-5 py-4">
              <span className="block text-xs uppercase tracking-[0.18em] text-subtle">Vorgang</span>
              <span className="mt-2 block font-display text-3xl tracking-tight">{vorgang}</span>
            </p>
            <BookingPhotoUpload vorgang={vorgang} />
            <BookingStatus id={Number(vorgang.slice(3))} />
          </>
        ) : null}

        <ol className="mt-12 divide-y divide-line border-y border-line">
          {steps.map(([n, title, text]) => (
            <li key={n} className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 py-6">
              <span className="font-display text-2xl tabular-nums text-subtle">{n}</span>
              <p className="font-display text-xl tracking-tight">{title}</p>
              <p className="col-start-2 text-sm leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ol>

        <dl className="mt-12 grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-subtle">Telefon</dt>
            <dd className="mt-2">
              <a href={site.phoneHref} className="text-fg hover:text-accent">
                {site.phoneDisplay}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.18em] text-subtle">E-Mail</dt>
            <dd className="mt-2">
              <a href={`mailto:${site.bookingEmail}`} className="text-fg hover:text-accent">
                {site.bookingEmail}
              </a>
            </dd>
          </div>
        </dl>

        <p className="mt-14 border-t border-line pt-8 text-sm text-muted">
          Hinweise zu Ihrem Widerrufsrecht finden Sie in der{" "}
          <Link to="/widerruf" className="underline hover:text-fg">
            Widerrufsbelehrung
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
