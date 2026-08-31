import { createFileRoute, Link } from "@tanstack/react-router";
import { site } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/danke")({
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
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-subtle">Bestätigung</p>
      <h1 className="mt-3 font-display text-5xl">Anfrage erhalten.</h1>
      <p className="mt-5 text-lg leading-relaxed text-muted">
        Unverbindlich vorgemerkt. Wir melden uns zur Terminbestätigung – in der Regel
        noch am selben Werktag.
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
