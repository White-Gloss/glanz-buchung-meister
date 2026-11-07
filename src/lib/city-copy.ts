import { cityPickupPriceText, pickupFee, site, type City } from "../data/site.ts";

export function cityJourneyText(city: City) {
  return city.km !== null && city.minutes !== null
    ? `ca. ${city.km} km · ca. ${city.minutes} Min.`
    : "Entfernung und Fahrzeit nach Abholadresse";
}

/** City hubs own the local vehicle-detailing intent; Horb's main intent stays on /. */
export function citySeoCopy(city: City) {
  const isHorb = city.slug === "horb-am-neckar";
  return {
    title: isHorb
      ? `Autoaufbereitung: Abholung in Horb | ${site.name}`
      : `Fahrzeugaufbereitung ${city.name} | ${site.name}`,
    heading: isHorb
      ? `Fahrzeugaufbereitung mit Abholung in ${city.name}`
      : `Fahrzeugaufbereitung für ${city.name}`,
    description: `Autoaufbereitung für ${city.name}: Innenraumreinigung, Politur und Keramik. Werkstatt in Horb am Neckar. Hol- und Bringservice ${cityPickupPriceText(city)}.`,
    linkLabel: isHorb
      ? "Fahrzeugaufbereitung: Abholung in Horb"
      : `Fahrzeugaufbereitung ${city.name}`,
    cluster: isHorb
      ? "autoaufbereitung abholung horb am neckar"
      : `fahrzeugaufbereitung ${city.name.toLowerCase()}`,
  };
}

/** Entfernungs-Plakette der Abholort-Chips; Wortlaut wie auf den Ortsseiten. */
export function pickupDistanceLabel(city: Pick<City, "km">) {
  if (city.km === null) return "Nach Adresse";
  if (city.km === 0) return "Standort";
  return `ca. ${city.km} km`;
}

export type PickupStatus = "free" | "fixed" | "request";

/** Status-Plakette: dieselbe Preislogik wie pickupPriceText (Basispaket). */
export function pickupStatus(km: number | null): PickupStatus {
  const fee = pickupFee(km, "basis");
  if (fee === null) return "request";
  return fee === 0 ? "free" : "fixed";
}

