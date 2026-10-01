import { useRef } from "react";
import { googleProfile, type GoogleReviewsData } from "@/data/google-profile";
import { DESKTOP_MOTION, useScrollMotion } from "@/lib/scroll-motion";
import { IconArrowRight } from "./icons";

/** Only fresh, verified Google API data is shown as a rating; no quotes are invented. */
export function ReviewsSpotlight({ data }: { data?: GoogleReviewsData | null }) {
  const root = useRef<HTMLElement>(null);
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
        <p className="reviews-source-note">Externer Link zu Google Maps.</p>
      </div>
    </aside>
  );
}
