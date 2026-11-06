import { Link } from "@tanstack/react-router";
import { packageServiceSlug, packages, site } from "@/data/site";
import { customerPhotos } from "@/data/customer-photos";
import { money } from "@/lib/utils";
import { IconArrowRight } from "./icons";
import { RevealLines } from "./reveal-lines";

const photos = ["customer-14", "customer-05", "customer-09"].map((id) =>
  customerPhotos.find((photo) => photo.id === id)!,
);
const focalPoints = ["50% 58%", "50% 64%", "50% 66%"];
const packageGoals = [
  "Frisch im Alltag – für sichtbar gepflegten Innenraum und Lack.",
  "Der spürbare Unterschied – für deutlich mehr Glanz und ein rundum gepflegtes Fahrzeug.",
  "Langfristig besonders – für anspruchsvolle Lackkorrektur und dauerhaften Schutz.",
];
// Bento-Breiten aus studio.css: Container min(90vw, 1380px), ab 760 px zwei
// Spalten (Abstand 1.25rem), Keramikschutz über die volle Breite mit 1.15/2.15
// Bildanteil. Die 12 % Parallaxe-Überskalierung ist eingerechnet.
const cardPhotoSizes =
  "(min-width: 760px) calc((min(90vw, 1380px) - 1.25rem) / 2 * 1.12), calc(100vw - 2.5rem)";
const featurePhotoSizes =
  "(min-width: 760px) calc(min(90vw, 1380px) * 0.6), calc(100vw - 2.5rem)";

/**
 * Drei Pakete als Bento: 01 und 02 nebeneinander, 03 (Keramikschutz) als
 * breite Abschlusskarte mit Lichtkante. Die DOM-Reihenfolge bleibt 01 → 03,
 * damit Tastatur und Screenreader der Preisstaffel folgen. Die Bildparallaxe
 * steuert HomePolish über `data-parallax-frame`.
 */
export function PackageShowcase() {
  return (
    <section id="pakete" className="atelier-packages" aria-labelledby="packages-title">
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
      <div className="pack-bento">
        {packages.map((pack, index) => {
          const photo = photos[index];
          const feature = index === packages.length - 1;
          return (
            <article className="pack-card glass glass-interactive" key={pack.id}>
              <figure className="pack-card-media" data-parallax-frame>
                <img
                  style={{ objectPosition: focalPoints[index] }}
                  src={photo.src}
                  srcSet={photo.srcSet}
                  sizes={feature ? featurePhotoSizes : cardPhotoSizes}
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
              <div className="pack-card-body">
                <div className="package-eyebrow">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{pack.searchLabel}</span>
                  {pack.featured && <span className="package-recommendation">Empfohlen</span>}
                </div>
                <h3>{pack.name}</h3>
                <p className="package-goal">{packageGoals[index]}</p>
                <p className="package-description">{pack.kicker}</p>
                <div className="pack-card-foot">
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
