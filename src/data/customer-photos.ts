export type CustomerPhotoCategory =
  | "Fahrzeugwäsche"
  | "Außenaufbereitung"
  | "Innenraumaufbereitung"
  | "Lackfinish";

export interface CustomerPhoto {
  id: string;
  title: string;
  alt: string;
  width: number;
  height: number;
  src: string;
  srcSet: string;
  category: CustomerPhotoCategory;
  position: string;
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
  position: photoPositions[id] ?? "50% 60%",
});

// Framing for the gallery; the full original remains available in the viewer.
const photoPositions: Record<string, string> = {
  "customer-01": "50% 70%", "customer-02": "50% 67%", "customer-03": "50% 64%",
  "customer-04": "50% 52%", "customer-05": "50% 62%", "customer-06": "50% 66%",
  "customer-07": "50% 68%", "customer-08": "50% 70%", "customer-09": "50% 63%",
  "customer-10": "50% 53%", "customer-11": "50% 58%", "customer-12": "50% 66%",
  "customer-13": "50% 61%", "customer-14": "50% 56%", "customer-15": "50% 68%",
  "customer-16": "50% 66%", "customer-17": "50% 62%", "customer-18": "50% 57%",
  "customer-19": "50% 67%",
};

export const featuredPhotoIds = ["customer-16", "customer-09", "customer-14", "customer-06", "customer-11", "customer-18"];

export const customerPhotos: CustomerPhoto[] = [
  photo(
    "customer-01",
    "Fahrzeugwäsche mit Schaumpflege",
    "Eingeschäumter schwarzer BMW während der Fahrzeugwäsche und Schaumpflege",
    "Fahrzeugwäsche",
  ),
  photo(
    "customer-02",
    "Außenaufbereitung mit Lackfinish",
    "Aufbereiteter schwarzer BMW mit glänzendem Lack im Seitenprofil",
    "Außenaufbereitung",
  ),
  photo(
    "customer-03",
    "Komplette Außenaufbereitung",
    "Schwarzer BMW mit geöffneten Türen, Motorhaube und Heckklappe nach der Außenaufbereitung",
    "Außenaufbereitung",
  ),
  photo(
    "customer-04",
    "Innenraumaufbereitung im Fond",
    "Gereinigter BMW-Fond mit schwarzen Sitzen und roten Akzenten nach der Innenraumaufbereitung",
    "Innenraumaufbereitung",
  ),
  photo(
    "customer-05",
    "Lackpolitur an der Front",
    "Glänzende Frontpartie eines schwarzen BMW nach der Lackpolitur",
    "Lackfinish",
  ),
  photo(
    "customer-06",
    "Außenaufbereitung an der Front",
    "Aufbereiteter schwarzer BMW in tiefer Frontansicht nach der Außenaufbereitung",
    "Außenaufbereitung",
  ),
  photo(
    "customer-07",
    "Lackfinish am Seitenprofil",
    "Schwarzer BMW im Seitenprofil mit gleichmäßig glänzendem Lack nach der Aufbereitung",
    "Außenaufbereitung",
  ),
  photo(
    "customer-08",
    "Außenaufbereitung vor der Übergabe",
    "Aufbereiteter schwarzer BMW vor einer Holzfassade unter blauem Himmel",
    "Außenaufbereitung",
  ),
  photo(
    "customer-09",
    "Felgen- und Lackaufbereitung",
    "Polierte Frontpartie mit aufbereitetem Leichtmetallrad und roter Bremse",
    "Lackfinish",
  ),
  photo(
    "customer-10",
    "Innenraumreinigung im Fahrerfußraum",
    "Gereinigter Fahrerfußraum mit schwarzer Fußmatte und roten Ziernähten",
    "Innenraumaufbereitung",
  ),
  photo(
    "customer-11",
    "Lackpolitur auf der Motorhaube",
    "Nahaufnahme einer polierten schwarzen Motorhaube mit klaren Reflexionen nach der Lackaufbereitung",
    "Lackfinish",
  ),
  photo(
    "customer-12",
    "Außenaufbereitung im Abendlicht",
    "Aufbereiteter schwarzer BMW mit Lackglanz in der Sonne vor einer Holzfassade",
    "Außenaufbereitung",
  ),
  photo(
    "customer-13",
    "Glas- und Lackpflege",
    "Nahaufnahme einer gereinigten Windschutzscheibe und des glänzenden Fahrzeuglacks nach der Aufbereitung",
    "Lackfinish",
  ),
  photo(
    "customer-14",
    "Innenraumreinigung an der Mittelkonsole",
    "Detailaufnahme der gereinigten Mittelkonsole eines BMW nach der Innenraumaufbereitung",
    "Innenraumaufbereitung",
  ),
  photo(
    "customer-15",
    "Lackfinish am Fahrzeugheck",
    "Glänzender schwarzer BMW aus hinterer Perspektive nach der Außenaufbereitung",
    "Außenaufbereitung",
  ),
  photo(
    "customer-16",
    "Komplette Fahrzeugaufbereitung",
    "Schwarzer BMW im vollständigen Seitenprofil nach der Fahrzeugaufbereitung",
    "Außenaufbereitung",
  ),
  photo(
    "customer-17",
    "Lackfinish am Heck",
    "Nahaufnahme des glänzenden Hecks eines schwarzen BMW nach der Lackaufbereitung",
    "Lackfinish",
  ),
  photo(
    "customer-18",
    "Innenraumaufbereitung mit Lederpflege",
    "Gereinigter BMW-Innenraum mit Mittelkonsole und roten Ziernähten",
    "Innenraumaufbereitung",
  ),
  photo(
    "customer-19",
    "Außenaufbereitung am Heck",
    "Aufbereiteter schwarzer BMW in schräger Heckansicht",
    "Außenaufbereitung",
  ),
];
