import { createFileRoute, Link } from "@tanstack/react-router";
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
    <main id="main-content" className="page-doc mx-auto max-w-3xl px-4 pb-20 sm:px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">
        {confirmed ? "Termin zugesagt" : "Bestätigung"}
      </p>
      <h1 className="mt-3 font-display text-5xl">
        {confirmed ? "Termin ist zugesagt." : "Anfrage erhalten."}
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-muted">
        {confirmed
          ? `Der Wunschtermin ist frei und damit zugesagt${vorgang ? ` (${vorgang})` : ""}. Der verbindliche Preis bleibt nach Begutachtung. Anzahlung nur nach Absprache, kein automatischer Einzug.`
          : "Unverbindlich vorgemerkt. Der Wunschtermin war nicht frei oder fehlte – wir melden uns zur Abstimmung, in der Regel noch am selben Werktag."}
      </p>
      <p className="mt-4 text-sm text-muted">
        Rückfragen: <a href={site.phoneHref}>{site.phoneDisplay}</a> oder{" "}
        <a href={`mailto:${site.email}`}>{site.email}</a>.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center rounded-sm bg-accent px-5 text-sm font-medium text-accent-fg"
        >
          Zur Startseite
        </Link>
        <a
          href={site.whatsapp}
          className="inline-flex min-h-11 items-center rounded-sm border border-line px-5 text-sm"
        >
          WhatsApp
        </a>
      </div>
    </main>
  );
}
