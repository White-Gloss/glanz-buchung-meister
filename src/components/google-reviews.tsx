import { QueryClient, useQuery } from "@tanstack/react-query";
import { googleProfile, fallbackGoogleReviews, type GoogleReviewsData } from "@/data/google-profile";

// Public review data only. Both placements share one browser request and cache.
const reviewsClient = new QueryClient();

function RatingStars({ rating = 5 }: { rating?: number }) {
  return (
    <div className="inline-flex items-center gap-1 text-amber-400" aria-label={`${rating} von 5 Sternen`}>
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          className={`size-4 ${i < rating ? "fill-current" : "fill-line text-muted/30"}`}
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

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
  // Fall back gracefully to curated reviews if live API tokens are not present
  const current =
    data && Date.now() - Date.parse(data.fetchedAt) < 60 * 60 * 1000
      ? data
      : fallbackGoogleReviews;

  const links = (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <a
        className="inline-flex min-h-11 items-center underline hover:text-fg text-muted"
        href={googleProfile.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Alle Bewertungen auf Google ansehen
      </a>
      {!compact ? (
        <a
          className="inline-flex min-h-11 items-center underline hover:text-fg text-muted"
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
        <div className="flex flex-wrap items-center gap-3">
          <RatingStars rating={Math.round(current.averageRating)} />
          <p className="text-lg font-medium">
            {current.averageRating.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{" "}
            von 5 Sternen · {current.totalReviewCount} Google-Bewertungen
          </p>
        </div>
        <div className="mt-2">{links}</div>
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
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <RatingStars rating={Math.round(current.averageRating)} />
        <p className="text-xl font-medium">
          {current.averageRating.toLocaleString("de-DE", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}{" "}
          von 5 Sternen · {current.totalReviewCount} Bewertungen
        </p>
      </div>
      <p className="mt-3 text-sm text-muted">
        Gesamtbewertung auf Google Maps. Stand:{" "}
        {new Date(current.fetchedAt).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}.
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {current.reviews.map((review) => (
          <article key={review.id} className="min-w-0 border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-medium">{review.author}</h3>
              <RatingStars rating={review.rating} />
            </div>
            <p className="mt-1 text-xs text-subtle">
              Google-Rezension ·{" "}
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
      <div className="mt-6">{links}</div>
      <p className="mt-3 text-xs text-subtle">
        Externe Links öffnen Google. Auf dieser Seite werden keine Google-Profilbilder geladen.
      </p>
    </section>
  );
}

