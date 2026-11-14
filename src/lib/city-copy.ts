import { cityPickupPriceText, pickupFee, pickupKeramikNote, site, type City } from "../data/site.ts";

export function cityJourneyText(city: City) {
  return city.km !== null && city.minutes !== null
    ? `ca. ${city.km} km · ca. ${city.minutes} Min.`
    : "Entfernung und Fahrzeit nach Abholadresse";
}

/** City hubs own the local vehicle-detailing intent; Horb's main intent stays on /. */
export function citySeoCopy(city: City) {
  const isHorb = city.slug === "horb-am-neckar";
  const pickup = cityPickupPriceText(city);
  const localDescriptions: Partial<Record<string, string>> = {
    "horb-am-neckar": `Fahrzeugpflege in unserer Werkstatt in ${site.city}, ${site.street}. Fahrzeug nach Termin selbst bringen oder kostenlose Abholung vereinbaren.`,
    "sulz-am-neckar": `Fahrzeugaufbereitung für Sulz am Neckar in unserer Werkstatt in Horb. Abholung mit Classic oder Signature: ${pickup}. Teilort bei der Anfrage angeben.`,
    empfingen: `Werkstatt in Horb und Abholung aus Empfingen: ${pickup} ab Ortsmitte. Für Wiesenstetten oder Dommelsberg bitte die genaue Adresse angeben.`,
    voehringen: `Fahrzeugpflege in der Werkstatt in Horb mit Abholung in Vöhringen im Landkreis Rottweil: ${pickup} mit Classic oder Signature. Ortsteil bitte angeben.`,
    dornhan: `Fahrzeugaufbereitung in der Werkstatt in Horb und Hol- und Bringservice für Dornhan: ${pickup}. Adresse und Stadtteil bei der Anfrage angeben.`,
    dornstetten: `Fahrzeugaufbereitung in der Werkstatt in Horb. Abholung aus Dornstetten: ${pickup}. Für Aach und Hallwangen die genaue Adresse angeben.`,
    schopfloch: `Abholung in Schopfloch im Landkreis Freudenstadt: ${pickup} mit Classic oder Signature. Fahrzeugaufbereitung in der Werkstatt in Horb.`,
    nagold: `Fahrzeugaufbereitung in der Werkstatt in Horb mit Abholung aus Nagold über die B28. Hol- und Bringservice: ${pickup}.`,
    "rottenburg-am-neckar": `Innenraumreinigung, Politur und Keramik in der Werkstatt in Horb. Hol- und Bringservice für Rottenburg am Neckar: ${pickup}.`,
    freudenstadt: `Hol- und Bringservice aus Freudenstadt im Nordschwarzwald für ${pickup}. Wir planen Abholung und Rückgabe rund um die Aufbereitung in der Werkstatt in Horb.`,
    "oberndorf-am-neckar": `Hol- und Bringservice für Oberndorf am Neckar: ${pickup}. Abholung und Rückgabe an der vereinbarten Adresse, Endkontrolle in der Werkstatt in Horb.`,
    herrenberg: `Hol- und Bringservice für Herrenberg: ${pickup}. Fahrzeugaufbereitung in der Werkstatt in Horb, Übergabe und Rückgabe nach Terminabsprache.`,
    tuebingen: "Autoaufbereitung für Tübingen mit Abholung und Rückgabe. Werkstatt in Horb für Innenraumreinigung, Lackkorrektur und Keramikversiegelung.",
    calw: `Für Calw bieten wir Abholung für ${pickup} oder Selbstanlieferung nach Termin an. Die Aufbereitung erfolgt in unserer Werkstatt in Horb.`,
    balingen: `Autoaufbereitung für Balingen, auch vor der Leasingrückgabe oder dem Verkauf. Hol- und Bringservice für ${pickup}, Werkstatt in Horb.`,
    rottweil: `Innenraumreinigung oder Lackkorrektur in der Werkstatt in Horb. Abholung und Rückgabe für Rottweil: ${pickup} mit Classic oder Signature.`,
    boeblingen: `Abholung für Böblingen am Rand des festen Radius: ${pickup} mit Classic oder Signature. Die Aufbereitung erfolgt in der Werkstatt in Horb.`,
    reutlingen: `Lackkorrektur und Innenraumreinigung für Reutlingen in der Werkstatt in Horb. Abholung und Rückgabe für ${pickup} mit Classic oder Signature.`,
    sindelfingen: `Werkstatt in Horb und Abholung aus Sindelfingen ${pickup} mit Classic oder Signature. ${pickupKeramikNote()}.`,
  };
  return {
    title: isHorb
      ? `Autoaufbereitung: Abholung in Horb | ${site.name}`
      : `Fahrzeugaufbereitung ${city.name} mit Abholung | ${site.name}`,
    heading: isHorb
      ? `Fahrzeugaufbereitung mit Abholung in ${city.name}`
      : `Fahrzeugaufbereitung für ${city.name}`,
    description:
      localDescriptions[city.slug] ??
      `Innenraumreinigung, Lackpolitur und Keramikversiegelung in der Werkstatt in Horb. Hol- und Bringservice für ${city.name}: ${pickup}.`,
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
