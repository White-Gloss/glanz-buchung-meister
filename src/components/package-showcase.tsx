import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { packageServiceSlug, packages, site } from "@/data/site";
import { customerPhotos } from "@/data/customer-photos";
import { DESKTOP_MOTION, useScrollMotion } from "@/lib/scroll-motion";
import { money } from "@/lib/utils";
import { IconArrowRight } from "./icons";

const photos = ["customer-14", "customer-05", "customer-09"].map((id) =>
  customerPhotos.find((photo) => photo.id === id)!,
);
const focalPoints = ["50% 58%", "50% 64%", "50% 66%"];

export function PackageShowcase() {
  const root = useRef<HTMLElement>(null);
  // The stage is sticky in CSS; scroll only crossfades the three original photos.
  useScrollMotion(
    DESKTOP_MOTION,
    ({ gsap }) => {
      const section = root.current;
      if (!section) return;
      const frames = gsap.utils.toArray<HTMLElement>(".package-frame", section);
      const chapters = gsap.utils.toArray<HTMLElement>(".package-chapter", section);
      chapters.slice(1).forEach((chapter, index) => {
        const frame = frames[index + 1];
        if (!frame) return;
        gsap
          .timeline({
            scrollTrigger: {
              trigger: chapter,
              start: "top 80%",
              end: "top 40%",
              scrub: 0.45,
              invalidateOnRefresh: true,
            },
          })
          .fromTo(frame, { opacity: 0 }, { opacity: 1, ease: "none" }, 0)
          .fromTo(frame.querySelector("img"), { scale: 1.025 }, { scale: 1, ease: "none" }, 0);
      });
    },
    root,
  );

  return (
    <section ref={root} id="pakete" className="atelier-packages" aria-labelledby="packages-title">
      <header className="atelier-heading">
        <div>
          <p className="kicker">Pakete</p>
          <h2 id="packages-title">
            Drei Pakete für die
            <br className="package-title-break" /> Fahrzeugaufbereitung.
          </h2>
        </div>
        <Link to="/preise" className="atelier-text-link">
          Preise und Zusatzleistungen <IconArrowRight aria-hidden />
        </Link>
      </header>
      <div className="package-track">
        <div className="package-stage" aria-hidden="true">
          {photos.map((photo, index) => (
            <figure key={photo.id} className="package-frame">
              <img
                style={{ objectPosition: focalPoints[index] }}
                src={photo.src}
                srcSet={photo.srcSet}
                sizes="(min-width: 1440px) 600px, 45vw"
                alt=""
                width={photo.width}
                height={photo.height}
                loading="lazy"
                decoding="async"
              />
              <figcaption>
                <span>White Gloss · Horb am Neckar</span>
                <span>{String(index + 1).padStart(2, "0")} / 03</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="package-chapters">
          {packages.map((pack, index) => (
            <article className="package-chapter" key={pack.id}>
              <img
                className="package-mobile-photo"
                style={{ objectPosition: focalPoints[index] }}
                src={photos[index].src}
                srcSet={photos[index].srcSet}
                sizes="90vw"
                alt={photos[index].alt}
                width={photos[index].width}
                height={photos[index].height}
                loading="lazy"
                decoding="async"
              />
              <div className="package-chapter-inner">
                <div className="package-eyebrow">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{pack.searchLabel}</span>
                  {pack.featured && <span className="package-recommendation">Empfohlen</span>}
                </div>
                <h3>{pack.name}</h3>
                <p className="package-description">{pack.kicker}</p>
                <div className="package-price">
                  <span>ab</span>
                  <strong>{money(pack.price)} €</strong>
                </div>
                <p className="package-terms">
                  {site.vatNote} · {pack.duration}
                </p>
                <Link
                  to="/leistungen/$slug"
                  params={{ slug: packageServiceSlug[pack.id] }}
                  className="atelier-text-link"
                >
                  Paket ansehen{" "}
                  <span className="atelier-arrow">
                    <IconArrowRight aria-hidden />
                  </span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
