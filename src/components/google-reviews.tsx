import { QueryClient, useQuery } from "@tanstack/react-query";
import { googleProfile, type GoogleReviewsData } from "@/data/google-profile";

// Public review data only. Both placements share one browser request and cache.
const reviewsClient = new QueryClient();

export function GoogleReviews({ compact = false }: { compact?: boolean }) {
  const { data } = useQuery(
    {
      queryKey: ["google-reviews"],
      queryFn: async () => {
        const response = await fetch("/api/google-reviews");
        if (!response.ok) return null;
        return ((await response.json()) as { data: GoogleReviewsData | null }).data;
      },
      staleTime: 60 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      refetchInterval: 60 * 60 * 1000,
      retry: false,
    },
    reviewsClient,
  );
  // A later read failure must not leave a cached rating indefinitely on screen.
  const current = data && Date.now() - Date.parse(data.fetchedAt) < 60 * 60 * 1000 ? data : null;
  const links = (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <a
        className="inline-flex min-h-11 items-center underline"
        href={googleProfile.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Alle Bewertungen auf Google ansehen
      </a>
      {!compact ? (
        <a
          className="inline-flex min-h-11 items-center underline"
          href={googleProfile.writeReviewUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Auf Google bewerten
        </a>
      ) : null}
    </div>
  );
  if (compact)
    return (
      <aside aria-label="Google-Kundenbewertungen" className="mt-8 border-y border-line py-5">
        <p className="text-lg">
          {current
            ? `${current.averageRating.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} von 5 Sternen · ${current.totalReviewCount} Google-Bewertungen`
            : "Kundenstimmen auf Google"}
        </p>
        {links}
      </aside>
    );
  return (
    <section
      className="section mx-auto max-w-7xl px-4 sm:px-6"
      aria-labelledby="google-reviews-heading"
    >
      <p className="kicker">Kundenstimmen</p>
      <h2 id="google-reviews-heading" className="heading-2 mt-4">
        Bewertungen auf Google
      </h2>
      {current ? (
        <>
          <p className="mt-5 text-xl">
            {current.averageRating.toLocaleString("de-DE", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{" "}
            von 5 Sternen · {current.totalReviewCount} Bewertungen
          </p>
          <p className="mt-3 text-sm text-muted">
            Auswahl der zuletzt aktualisierten Rezensionen, von Google geliefert. Gesamtbewertung
            aus allen Google-Bewertungen. Stand:{" "}
            {new Date(current.fetchedAt).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
            .
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {current.reviews.map((review) => (
              <article key={review.id} className="min-w-0 border border-line bg-surface p-5">
                <h3 className="text-lg font-medium">{review.author}</h3>
                <p className="mt-2 text-sm">
                  {review.rating} von 5 Sternen ·{" "}
                  <time dateTime={review.date}>
                    {new Date(review.date).toLocaleDateString("de-DE", {
                      timeZone: "Europe/Berlin",
                    })}
                  </time>
                </p>
                {review.text.length > 320 ? (
                  <details className="mt-4">
                    <summary className="min-h-11 cursor-pointer">Rezension lesen</summary>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                      {review.text}
                    </p>
                  </details>
                ) : review.text ? (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{review.text}</p>
                ) : (
                  <p className="mt-4 text-sm text-muted">Bewertung ohne Text</p>
                )}
                <a
                  href={googleProfile.url}
                  className="mt-4 inline-flex min-h-11 items-center text-sm underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Quelle: Google
                </a>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-5 text-muted">
          Die Rezensionen zu White-Gloss Detailing können Sie direkt auf Google lesen.
        </p>
      )}
      <div className="mt-6">{links}</div>
      <p className="mt-3 text-xs text-subtle">
        Externe Links öffnen Google. Auf dieser Seite werden keine Google-Profilbilder geladen.
      </p>
    </section>
  );
}
