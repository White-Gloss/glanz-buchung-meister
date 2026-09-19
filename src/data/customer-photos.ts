export type CustomerPhotoCategory =
  | "Fahrzeugwäsche"
  | "Außenansicht"
  | "Innenraum"
  | "Lackdetails";

export interface CustomerPhoto {
  id: string;
  title: string;
  alt: string;
  width: number;
  height: number;
  src: string;
  srcSet: string;
  category: CustomerPhotoCategory;
}

const photo = (
  id: string,
  title: string,
  alt: string,
  category: CustomerPhotoCategory,
): CustomerPhoto => ({
  id,
  title,
  alt,
  width: 1200,
  height: 1600,
  src: `/media/customer-photos/${id}-1400.webp`,
  srcSet: [
    `/media/customer-photos/${id}-480.webp 480w`,
    `/media/customer-photos/${id}-900.webp 900w`,
    `/media/customer-photos/${id}-1400.webp 1200w`,
  ].join(", "),
  category,
});

export const customerPhotos: CustomerPhoto[] = [
  photo(
    "customer-01",
    "Gründliche Fahrzeugwäsche",
    "Eingeschäumter schwarzer BMW während einer gründlichen Fahrzeugwäsche",
    "Fahrzeugwäsche",
  ),
  photo(
    "customer-02",
    "Gepflegtes Seitenprofil",
    "Aufbereiteter schwarzer BMW im Seitenprofil vor einer Holzfassade",
    "Außenansicht",
  ),
  photo(
    "customer-03",
    "Aufbereitung bis ins Detail",
    "Schwarzer BMW mit geöffneten Türen, Motorhaube und Heckklappe nach der Aufbereitung",
    "Außenansicht",
  ),
  photo(
    "customer-04",
    "Sauberer Fond",
    "Gereinigter Fond mit schwarzen Sitzen und roten Akzenten",
    "Innenraum",
  ),
  photo(
    "customer-05",
    "Glanz an der Front",
    "Glänzende Frontpartie eines schwarzen BMW mit poliertem Lack",
    "Lackdetails",
  ),
  photo(
    "customer-06",
    "Sportliche Frontansicht",
    "Aufbereiteter schwarzer BMW in tiefer Frontansicht",
    "Außenansicht",
  ),
  photo(
    "customer-07",
    "Klares Lackfinish",
    "Schwarzer BMW im Seitenprofil mit gleichmäßig glänzendem Lack",
    "Außenansicht",
  ),
  photo(
    "customer-08",
    "Elegantes Seitenprofil",
    "Aufbereiteter schwarzer BMW vor einer Holzfassade unter blauem Himmel",
    "Außenansicht",
  ),
  photo(
    "customer-09",
    "Detailfinish an Rad und Front",
    "Polierte Frontpartie mit sauberem Leichtmetallrad und roter Bremse",
    "Lackdetails",
  ),
  photo(
    "customer-10",
    "Gereinigter Fahrerfußraum",
    "Sauberer Fahrerfußraum mit schwarzer Fußmatte und roten Ziernähten",
    "Innenraum",
  ),
  photo(
    "customer-11",
    "Spiegelglatte Motorhaube",
    "Nahaufnahme einer polierten schwarzen Motorhaube mit klaren Reflexionen",
    "Lackdetails",
  ),
  photo(
    "customer-12",
    "Glänzende Front im Abendlicht",
    "Aufbereiteter schwarzer BMW in der Sonne vor einer Holzfassade",
    "Außenansicht",
  ),
  photo(
    "customer-13",
    "Klare Scheiben und Lackreflexionen",
    "Nahaufnahme von gereinigter Windschutzscheibe und glänzendem Fahrzeuglack",
    "Lackdetails",
  ),
  photo(
    "customer-14",
    "Saubere Mittelkonsole",
    "Detailaufnahme der gereinigten Mittelkonsole eines BMW",
    "Innenraum",
  ),
  photo(
    "customer-15",
    "Heckansicht im Abendlicht",
    "Glänzender schwarzer BMW aus hinterer Perspektive bei Abendlicht",
    "Außenansicht",
  ),
  photo(
    "customer-16",
    "Aufbereitetes Gesamtbild",
    "Schwarzer BMW im vollständigen Seitenprofil nach der Fahrzeugaufbereitung",
    "Außenansicht",
  ),
  photo(
    "customer-17",
    "Lackglanz am Heck",
    "Nahaufnahme des glänzenden Hecks eines schwarzen BMW bei Sonnenuntergang",
    "Lackdetails",
  ),
  photo(
    "customer-18",
    "Innenraum mit roten Akzenten",
    "Gereinigter BMW Innenraum mit Mittelkonsole und roten Ziernähten",
    "Innenraum",
  ),
  photo(
    "customer-19",
    "Gepflegte Heckansicht",
    "Aufbereiteter schwarzer BMW in schräger Heckansicht",
    "Außenansicht",
  ),
];