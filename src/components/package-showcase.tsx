import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { packageServiceSlug, packages, site } from "@/data/site";
import { customerPhotos } from "@/data/customer-photos";
import { money } from "@/lib/utils";
import { IconArrowRight } from "./icons";
import { RevealLines } from "./reveal-lines";
import "@/styles/package-editorial.css";

const photos = ["customer-14", "customer-05", "customer-09"].map((id) =>
  customerPhotos.find((photo) => photo.id === id)!,
);
const focalPoints = ["50% 58%", "50% 64%", "50% 66%"];
const packageGoals = [
  "Frisch im Alltag – für sichtbar gepflegten Innenraum und Lack.",
  "Der spürbare Unterschied – für deutlich mehr Glanz und ein rundum gepflegtes Fahrzeug.",
  "Langfristig besonders – für anspruchsvolle Lackkorrektur und dauerhaften Schutz.",
];
const photoSizes =
  "(min-width: 960px) min(36vw, 640px), (min-width: 640px) 90vw, calc(100vw - 2.5rem)";

/**
 * Each package keeps its own image and complete copy in DOM order. Desktop
 * progressively places those same images in one sticky stage; no duplicated
 * content, scroll hijacking or animation dependency is needed. Without JS,
 * on mobile and with reduced motion, all three chapters remain static.
 */
export function PackageShowcase() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const media = window.matchMedia(
      "(min-width: 960px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)",
    );
    const chapters = [...section.querySelectorAll<HTMLElement>(".package-editorial-body")];
    const pictures = [...section.querySelectorAll<HTMLElement>(".package-editorial-media")];
    const atmosphere = [...section.querySelectorAll<HTMLElement>(".package-editorial-atmosphere img")];
    let frame = 0;
    let nearby = true;
    let current = -1;

    const paint = () => {
      frame = 0;
      if (!media.matches || !nearby) return;
      const readingLine = window.innerHeight * 0.55;
      let next = 0;
      chapters.forEach((chapter, index) => {
        if (chapter.getBoundingClientRect().top <= readingLine) next = index;
      });
      if (current === next) return;
      current = next;
      pictures.forEach((picture, index) => {
        picture.dataset.active = String(index === current);
        if (atmosphere[index]) atmosphere[index].dataset.active = String(index === current);
      });
    };
    const schedule = () => {
      if (!frame && nearby && media.matches) frame = window.requestAnimationFrame(paint);
    };
    const syncMotion = () => {
      current = -1;
      if (media.matches) {
        section.dataset.packageMotion = "scroll";
        paint();
      } else {
        delete section.dataset.packageMotion;
        pictures.forEach((picture) => delete picture.dataset.active);
        atmosphere.forEach((picture) => delete picture.dataset.active);
      }
    };
    const visibility = new IntersectionObserver(
      ([entry]) => {
        nearby = entry.isIntersecting;
        if (nearby) schedule();
      },
      { rootMargin: "100% 0px" },
    );
    visibility.observe(section);
    const resize = new ResizeObserver(schedule);
    resize.observe(section);
    syncMotion();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    media.addEventListener("change", syncMotion);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      media.removeEventListener("change", syncMotion);
      visibility.disconnect();
      resize.disconnect();
      delete section.dataset.packageMotion;
      pictures.forEach((picture) => delete picture.dataset.active);
        atmosphere.forEach((picture) => delete picture.dataset.active);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="pakete"
      className="atelier-packages package-editorial"
      aria-labelledby="packages-title"
    >
      <header className="atelier-heading">
        <div>
          <p className="kicker">Pakete</p>
          <h2 id="packages-title" data-lines>
            <RevealLines
              lines={[
                <>
                  Drei Pakete für die
                  <br className="package-title-break" /> Fahrzeugaufbereitung.
                </>,
              ]}
            />
          </h2>
        </div>
        <Link to="/preise" className="atelier-text-link">
          Preise und Zusatzleistungen <IconArrowRight aria-hidden />
        </Link>
      </header>
      <div className="package-editorial-atmosphere" aria-hidden="true">
        {photos.map((photo) => (
          <img
            key={photo.id}
            src={photo.src}
            srcSet={photo.srcSet}
            sizes="480px"
            alt=""
            width={photo.width}
            height={photo.height}
            loading="lazy"
            decoding="async"
          />
        ))}
      </div>
      <div className="package-editorial-track">
        {packages.map((pack, index) => {
          const photo = photos[index];
          return (
            <article className="package-editorial-chapter" key={pack.id}>
              <figure className="package-editorial-media">
                <img
                  style={{ objectPosition: focalPoints[index] }}
                  src={photo.src}
                  srcSet={photo.srcSet}
                  sizes={photoSizes}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  loading="lazy"
                  decoding="async"
                />
                <figcaption aria-hidden="true">
                  <span>White Gloss · Horb am Neckar</span>
                  <span>{String(index + 1).padStart(2, "0")} / 03</span>
                </figcaption>
              </figure>
              <div className="package-editorial-body">
                <div className="package-eyebrow">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{pack.searchLabel}</span>
                  {pack.featured && <span className="package-recommendation">Empfohlen</span>}
                </div>
                <h3>{pack.name}</h3>
                <p className="package-goal">{packageGoals[index]}</p>
                <p className="package-description">{pack.kicker}</p>
                <div className="package-editorial-foot">
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
                    Paket {pack.name} ansehen{" "}
                    <span className="atelier-arrow">
                      <IconArrowRight aria-hidden />
                    </span>
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
