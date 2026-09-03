import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { ctaGhost, ctaPrimary } from "@/components/ui";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";

type ThanksSearch = {
  vorgang?: string;
  zusage?: string;
};

export const Route = createFileRoute("/danke")({
  validateSearch: (search: Record<string, unknown>): ThanksSearch => ({
    vorgang:
      typeof search.vorgang === "string" && /^WG-\d+$/.test(search.vorgang)
        ? search.vorgang
        : undefined,
    zusage: search.zusage === "1" ? "1" : undefined,
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
  const { vorgang, zusage } = Route.useSearch();
  const confirmed = zusage === "1";

  return (
    <main id="main-content" tabIndex={-1}>
      <PageHero
        shot="atelier"
        alt="Werkstatt von White Gloss in Horb am Neckar"
        kicker={confirmed ? "Termin zugesagt" : "Bestätigung"}
        title={confirmed ? "Termin ist zugesagt." : "Anfrage erhalten."}
        lead={
          confirmed
            ? `Der Wunschtermin ist frei${vorgang ? ` (${vorgang})` : ""}. Der Preis bleibt nach Begutachtung.`
            : "Unverbindlich vorgemerkt. Wir melden uns zur Abstimmung, in der Regel noch am selben Werktag."
        }
        crumbs={[
          { label: "Startseite", to: "/" },
          { label: "Danke" },
        ]}
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
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-sm text-muted">
          Rückfragen: <a href={site.phoneHref}>{site.phoneDisplay}</a> oder{" "}
          <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
      </div>
    </main>
  );
}
