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