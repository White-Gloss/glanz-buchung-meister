import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { googleProfile, type GoogleReviewsData } from "@/data/google-profile";
import { IconArrowRight } from "./icons";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type ReviewsSnapshot = {
  checkedAt: string;
  source: string;
  averageRating: number;
  totalReviewCount: number;
  excerpts: { author: string; rating: number; text: string }[];
};

export function ReviewsSpotlight({
  data,
  snapshot,
}: {
  data?: GoogleReviewsData | null;
  snapshot?: ReviewsSnapshot;
}) {
  const root = useRef<HTMLElement>(null);
  const rating = snapshot ?? data;
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".reviews-spotlight-copy, .reviews-spotlight-source", {
          y: 30,
          duration: 1.1,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: { trigger: root.current, start: "top 88%", once: true },
        });
      });
      return () => media.revert();
    },
    { scope: root },
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
        {rating && (
          <p className="reviews-verified-rating">
            {rating.averageRating.toLocaleString("de-DE", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{" "}
            <span>von 5 Sternen · {rating.totalReviewCount} Google-Bewertungen</span>
          </p>
        )}
      </div>
      <div className="reviews-spotlight-source">
        <p className="reviews-google-word">Google</p>
        <a
          href={snapshot?.source ?? googleProfile.url}
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
          {snapshot && (
            <>
              Ausgewählte Originalauszüge. Stand:{" "}
              <time dateTime={snapshot.checkedAt}>
                {new Date(`${snapshot.checkedAt}T12:00:00Z`).toLocaleDateString("de-DE")}
              </time>
              .{" "}
            </>
          )}
          Externer Link zu Google Maps.
        </p>
      </div>
      {snapshot && (
        <div className="reviews-excerpts">
          {snapshot.excerpts.map((review) => (
            <figure key={review.author}>
              <p className="review-stars" aria-label={`${review.rating} von 5 Sternen`}>
                {"★".repeat(review.rating)}
              </p>
              <blockquote>
                <p>„{review.text}“</p>
              </blockquote>
              <figcaption>
                {review.author}
                <span>Google-Rezension · Auszug</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </aside>
  );
}
