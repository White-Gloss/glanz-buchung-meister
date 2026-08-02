import { Link } from "@tanstack/react-router";

import { pickupCitiesByDistance } from "@/lib/pickupLocations";
import { servicePages } from "@/lib/servicePages";

/**
 * Übersichtsraster der Local-SEO-Matrix.
 *
 * Bewusst ohne JavaScript umgesetzt: Die Aufklappfunktion nutzt das native
 * <details>/<summary>-Paar des Browsers. Dadurch stehen alle Links bereits im
 * ausgelieferten HTML (Crawler folgen ihnen ohne Hydration) und die Seite
 * bekommt keinen zusätzlichen Client-JS-Overhead.
 *
 * `defaultOpenServiceSlug` klappt genau einen Block auf, damit die Seite nicht
 * mit über 90 sichtbaren Links startet.
 */
export function ServiceCityMatrix({
  defaultOpenServiceSlug,
  headingLevel = "h2",
}: {
  defaultOpenServiceSlug?: string;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;

  return (
    <div className="mt-8 space-y-3">
      {servicePages.map((service) => (
        <details
          key={service.slug}
          open={service.slug === defaultOpenServiceSlug}
          className="glass group rounded-2xl px-5 py-4"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Heading className="display-card text-sm uppercase">{service.name}</Heading>
            <span className="shrink-0 text-xs text-muted-foreground">
              {pickupCitiesByDistance.length} Städte
            </span>
          </summary>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <li>
              <Link
                to="/leistungen/$service"
                params={{ service: service.slug }}
                className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/15"
              >
                <span className="truncate">{service.shortName} – Übersicht</span>
              </Link>
            </li>
            {pickupCitiesByDistance.map((city) => (
              <li key={city.slug}>
                <Link
                  to="/leistungen/$service/$city"
                  params={{ service: service.slug, city: city.slug }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <span className="truncate">
                    {service.shortName} {city.short}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {city.distanceKm} km
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
