import { useState } from "react";
import { site } from "@/data/site";
import { ctaGhost, ctaPrimary } from "@/components/ui";

export function WorkshopMap({ className = "" }: { className?: string }) {
  const [live, setLive] = useState(false);
  const title = `Google Maps: ${site.street}, ${site.postalCode} ${site.city}`;

  return (
    <figure className={className}>
      <div className="workshop-map">
        {live ? (
          <iframe
            title={title}
            src={site.mapsGoogleEmbed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className="relative block w-full cursor-pointer text-left"
            onClick={() => setLive(true)}
            aria-label="Interaktive Google-Karte laden"
          >
            <picture>
              <source
                type="image/avif"
                srcSet="/media/map-800.avif 800w, /media/map.avif 1280w"
                sizes="100vw"
              />
              <source
                type="image/webp"
                srcSet="/media/map-800.webp 800w, /media/map.webp 1280w"
                sizes="100vw"
              />
              <img
                src="/media/map-800.webp"
                alt={`Karte zum Standort ${site.street}, ${site.postalCode} ${site.city}`}
                width={1280}
                height={768}
                className="h-full min-h-[18rem] w-full object-cover sm:min-h-[26rem]"
                loading="lazy"
                decoding="async"
                sizes="100vw"
              />
            </picture>
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-bg via-bg/70 to-transparent pb-6 pt-16">
              <span className={ctaPrimary}>Interaktive Karte laden</span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {site.street}, {site.postalCode} {site.city} · {site.region}
          <span className="mt-1 block text-xs text-subtle">
            Die Karte lädt Google Maps erst nach einem Klick. Danach können Sie
            zoomen und eine Route legen – auch auf dem Handy.
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={site.mapsGoogle}
            className={ctaPrimary}
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Maps
          </a>
          <a href={site.phoneHref} className={ctaGhost}>
            Anrufen
          </a>
        </div>
      </figcaption>
    </figure>
  );
}
