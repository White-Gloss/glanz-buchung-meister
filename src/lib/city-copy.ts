import { pickupPriceText, site, type City } from "../data/site.ts";

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
    description: `Autoaufbereitung für ${city.name}: Innenraumreinigung, Politur und Keramik. Werkstatt in Horb am Neckar. Hol- und Bringservice ${pickupPriceText(city.km)}.`,
    linkLabel: isHorb
      ? "Fahrzeugaufbereitung: Abholung in Horb"
      : `Fahrzeugaufbereitung ${city.name}`,
    cluster: isHorb
      ? "autoaufbereitung abholung horb am neckar"
      : `fahrzeugaufbereitung ${city.name.toLowerCase()}`,
  };
}
