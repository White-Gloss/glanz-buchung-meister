import { Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, Timer } from "lucide-react";
import { pickupCitiesByDistance, type PickupCity } from "@/lib/pickupLocations";

type Props = {
  /** Optionale Auswahl (z. B. Nachbarstädte); Standard: alle Städte */
  cities?: PickupCity[];
  compact?: boolean;
};

/**
 * Zentrale Übersicht aller Abholservice-Städte als Bento-Grid.
 * Wird auf der Startseite und auf den Städte-Seiten wiederverwendet.
 */
export function PickupCityGrid({ cities = pickupCitiesByDistance, compact = false }: Props) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cities.map((city) => (
        <li key={city.slug}>
          <Link
            to="/abholservice/$city"
            params={{ city: city.slug }}
            className="hairline-gold group flex h-full flex-col justify-between rounded-2xl bg-card/70 p-5 backdrop-blur-xl transition-colors hover:border-primary/60"
          >
            <div>
              <p className="display-card flex items-center gap-2 uppercase text-foreground">
                <MapPin className="size-4 shrink-0 text-primary" />
                {city.name}
              </p>
              {!compact && <p className="mt-2 text-sm text-muted-foreground">{city.district}</p>}
            </div>
            <p className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Timer className="size-3.5 text-primary" />
                {city.distanceKm === 0
                  ? "Werkstatt vor Ort"
                  : `${city.distanceKm} km · ca. ${city.driveMinutes} Min.`}
              </span>
              <ArrowRight className="size-4 text-primary transition-transform group-hover:translate-x-1" />
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
