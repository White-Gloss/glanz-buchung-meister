import { useRef } from "react";
import { googleProfile, type GoogleReviewsData } from "@/data/google-profile";
import { DESKTOP_MOTION, useScrollMotion } from "@/lib/scroll-motion";
import { IconArrowRight } from "./icons";

const EXCERPT_LENGTH = 240;

// Shortens at a word boundary; the full review stays one click away on Google.
function excerpt(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= EXCERPT_LENGTH) return { text: clean, shortened: false };
  const cut = clean.slice(0, EXCERPT_LENGTH);
  const space = cut.lastIndexOf(" ");
  return { text: `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()} …`, shortened: true };
}

const dateFormat = { timeZone: "Europe/Berlin" } as const;

/**
 * Only fresh, verified Google API data is shown as rating or customer review.
 * Without it, the section links to the public profile instead of inventing quotes.
 */
export function ReviewsSpotlight({ data }: { data?: GoogleReviewsData | null }) {
  const root = useRef<HTMLElement>(null);
  const reviews = (data?.reviews ?? []).filter((review) => review.text.trim()).slice(0, 3);
  useScrollMotion(
    DESKTOP_MOTION,
    ({ gsap }) => {
      const section = root.current;
      if (!section) return;
      gsap.from(section.querySelectorAll(".reviews-spotlight-copy, .reviews-spotlight-source"), {
        y: 30,
        duration: 1.1,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: { trigger: section, start: "top 88%", once: true },
      });
    },
    root,
  );
  return (
    <aside ref={root} className="reviews-spotlight" aria-label="Google-Kundenbewertungen">
      <div className="reviews-spotlight-copy">
        <p className="kicker">Kundenstimmen</p>
        <h2>
          Erfahrungen
          <br />
          unserer Kunden.
        </h2>
        {data && (
          <p className="reviews-verified-rating">
            {data.averageRating.toLocaleString("de-DE", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{" "}
            <span>von 5 Sternen · {data.totalReviewCount} Google-Bewertungen</span>
          </p>
        )}
      </div>
      <div className="reviews-spotlight-source">
        <p className="reviews-google-word">Google</p>
        <a
          href={googleProfile.url}
          target="_blank"
          rel="noopener noreferrer"
          className="reviews-source-link"
        >
          Alle Bewertungen auf Google ansehen{" "}
          <span className="atelier-arrow">
            <IconArrowRight aria-hidden />
          </span>
        </a>
        <p className="reviews-source-note">
          {data && (
            <>
              Gesamtbewertung und Rezensionen aus Google Maps. Stand:{" "}
              <time dateTime={data.fetchedAt}>
                {new Date(data.fetchedAt).toLocaleDateString("de-DE", dateFormat)}
              </time>
              .{" "}
            </>
          )}
          Externer Link zu Google Maps.
        </p>
      </div>
      {reviews.length > 0 && (
        <div className="reviews-excerpts">
          {reviews.map((review) => {
            const quote = excerpt(review.text);
            return (
              <figure key={review.id}>
                <p
                  className="review-stars"
                  role="img"
                  aria-label={`${review.rating} von 5 Sternen`}
                >
                  {"★".repeat(review.rating)}
                </p>
                <blockquote cite={googleProfile.url}>
                  <p>„{quote.text}“</p>
                </blockquote>
                <figcaption>
                  {review.author}
                  <span>
                    Google-Rezension{quote.shortened ? " · Auszug" : ""} ·{" "}
                    <time dateTime={review.date}>
                      {new Date(review.date).toLocaleDateString("de-DE", dateFormat)}
                    </time>
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </aside>
  );
}
