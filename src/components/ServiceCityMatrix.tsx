import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";

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
 * Alle Gruppen bleiben zunächst geschlossen, damit die regionale
 * SEO-Navigation visuell kompakt ist.
 */
export function ServiceCityMatrix({ headingLevel = "h2" }: { headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;

  return (
    <div className="mt-7 divide-y divide-border border-y border-border">
      {servicePages.map((service) => (
        <details key={service.slug} className="group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-md px-1 outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <Heading className="display-card text-sm uppercase">{service.name}</Heading>
            <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
              {pickupCitiesByDistance.length} Städte
              <ChevronDown
                aria-hidden
                className="size-3.5 transition-transform group-open:rotate-180"
              />
            </span>
          </summary>

          <ul className="grid gap-x-5 pb-5 pt-1 sm:grid-cols-2 lg:grid-cols-3">
            <li>
              <Link
                to="/leistungen/$service"
                params={{ service: service.slug }}
                className="flex min-h-10 items-center justify-between gap-3 border-b border-primary/30 px-1 text-sm text-primary transition-colors hover:text-foreground"
              >
                <span className="truncate">{service.shortName} – Übersicht</span>
              </Link>
            </li>
            {pickupCitiesByDistance.map((city) => (
              <li key={city.slug}>
                <Link
                  to="/leistungen/$service/$city"
                  params={{ service: service.slug, city: city.slug }}
                  className="flex min-h-10 items-center justify-between gap-3 border-b border-border px-1 text-sm text-muted-foreground transition-colors hover:text-primary"
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
