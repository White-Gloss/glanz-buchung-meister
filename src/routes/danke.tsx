import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { ctaGhost, ctaPrimary } from "@/components/ui";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";
import { BookingPhotoUpload } from "@/components/booking-photo-upload";

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
      "Anfrage ist da",
      "Unverbindlich vorgemerkt. Noch kein Vertrag, noch kein fester Termin.",
    ],
    [
      "02",
      "Wir prüfen den Slot",
      "In der Regel Rückmeldung noch am selben Werktag – Telefon, Mail oder WhatsApp.",
    ],
    [
      "03",
      "Erst die Zusage gilt",
      "Fest wird der Termin, wenn wir zusagen. Danach gilt die Widerrufsbelehrung.",
    ],
  ];

  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="atelier"
        alt="Werkstatt von White Gloss in Horb am Neckar"
        kicker="Anfrage eingegangen"
        title="Danke. Anfrage erhalten."
        lead="Ihr Wunschtermin wartet auf unsere persönliche Bestätigung. Wir melden uns zur Abstimmung, in der Regel noch am selben Werktag."
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
              <a href={`mailto:${site.email}`} className="text-fg hover:text-accent">
                {site.email}
              </a>
            </dd>
          </div>
        </dl>

        <p className="mt-14 border-t border-line pt-8 text-sm text-muted">
          Noch kein Vertrag. Sobald wir zusagen, gilt die{" "}
          <Link to="/widerruf" className="underline hover:text-fg">
            Widerrufsbelehrung
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
