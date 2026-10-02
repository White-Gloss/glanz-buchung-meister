import { pickupPriceText, site, type City } from "../data/site.ts";

/** City hubs own the local vehicle-detailing intent; Horb's main intent stays on /. */
export function citySeoCopy(city: City) {
  const isHorb = city.slug === "horb-am-neckar";
  const local = city.blurb.includes(city.name) ? city.blurb : `${city.name}. ${city.blurb}`;
  return {
    title: isHorb
      ? `Autoaufbereitung: Abholung in Horb | ${site.name}`
      : `Fahrzeugaufbereitung ${city.name} | ${site.name}`,
    heading: isHorb
      ? `Fahrzeugaufbereitung mit Abholung in ${city.name}`
      : `Fahrzeugaufbereitung für ${city.name}`,
    description: `${local} Autoaufbereitung in unserer Werkstatt in Horb. Hol- und Bringservice ${pickupPriceText(city.km)}.`,
    linkLabel: isHorb
      ? "Fahrzeugaufbereitung: Abholung in Horb"
      : `Fahrzeugaufbereitung ${city.name}`,
    cluster: isHorb
      ? "autoaufbereitung abholung horb am neckar"
      : `fahrzeugaufbereitung ${city.name.toLowerCase()}`,
  };
}
