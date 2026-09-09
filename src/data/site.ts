import { eur } from "../lib/utils.ts";

export const site = {
  name: "White Gloss",
  legalName: "White Gloss Detailing",
  tagline: "Fahrzeugaufbereitung in Horb am Neckar.",
  owner: "Lars Hägele",
  street: "Arnistal 27",
  postalCode: "72160",
  city: "Horb am Neckar",
  region: "Baden-Württemberg",
  country: "Deutschland",
  origin: "https://white-gloss.de",
  phoneDisplay: "0152 33540284",
  phoneHref: "tel:+4915233540284",
  email: "info@white-gloss.de",
  instagram: "https://www.instagram.com/white_gloss.detailing/",
  instagramHandle: "white_gloss.detailing",
  whatsapp:
    "https://wa.me/4915233540284?text=Hallo%20White%20Gloss%2C%20ich%20interessiere%20mich%20f%C3%BCr%20eine%20Fahrzeugaufbereitung.",
  whatsappHref: "https://api.whatsapp.com/send?phone=4915233540284",
  vatNote: "inkl. 19 % MwSt.",
  vatRate: 0.19,
  vatId: "",
  hoursLabel: "Mo–Fr 09:00–17:00 Uhr",
  lat: 48.445,
  lng: 8.691,
  mapsGoogle:
    "https://www.google.com/maps/search/?api=1&query=Arnistal%2027%2C%2072160%20Horb%20am%20Neckar",
  mapsGoogleEmbed:
    "https://www.google.com/maps?q=Arnistal+27,+72160+Horb+am+Neckar&hl=de&z=16&output=embed",
  mapsOsmEmbed:
    "https://www.openstreetmap.org/export/embed.html?bbox=8.671%2C48.435%2C8.711%2C48.455&layer=mapnik&marker=48.445%2C8.691",
};

export const atelierPhotos = {
  caption:
    "Die Bilder zeigen unser eigenes Fahrzeug in Horb am Neckar. Das Kennzeichen wurde entfernt.",
  invite:
    "Bilder von Kundenfahrzeugen veröffentlichen wir nur mit Zustimmung und ohne sichtbare Kennzeichen.",
};

export const openingHours = {
  opens: "09:00",
  closes: "17:00",
  daysLabel: "Montag bis Freitag",
  dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const,
};

// Inhaltlich zu klären: AGB formulieren die Anzahlung als optional, der Buchungshinweis als fällig.
export const depositConfig = {
  rate: 0.1,
  label: "Anzahlung bei Erstbuchung (10 %)",
  note: "Nach Ihrer Zusage werden bei der ersten Buchung 10 % des Gesamtbetrags als Anzahlung fällig. Den Rest zahlen Sie nach Abschluss der Leistung. Der Betrag wird nicht automatisch eingezogen.",
};

export const timeSlots = ["09:00", "11:00", "13:00", "15:00"];

export type VehicleClass = {
  id: "kompakt" | "suv" | "transporter";
  label: string;
  hint: string;
  factor: number;
};

export const vehicleClasses: VehicleClass[] = [
  {
    id: "kompakt",
    label: "Kompaktklasse",
    hint: "Kleinwagen und Kompaktwagen bis 4,30 m",
    factor: 1,
  },
  {
    id: "suv",
    label: "SUV / Limousine",
    hint: "Mittelklasse, Kombi, SUV bis 5,00 m",
    factor: 1.25,
  },
  {
    id: "transporter",
    label: "Transporter",
    hint: "Vans und Nutzfahrzeuge ab 5,00 m",
    factor: 1.55,
  },
];

export type PackageId = "basis" | "premium" | "keramik";

export type Package = {
  id: PackageId;
  kicker: string;
  name: string;
  searchLabel: string;
  seoName: string;
  body: string;
  price: number;
  duration: string;
  featured?: boolean;
  items: string[];
  includesPickup?: boolean;
};

export const packages: Package[] = [
  {
    id: "basis",
    kicker: "Handwäsche und Innenraumreinigung",
    name: "Basisreinigung",
    searchLabel: "Reinigung innen und außen",
    seoName: "Fahrzeugaufbereitung Pur – Innenraumreinigung in Horb am Neckar",
    body: "Das Paket Basisreinigung umfasst eine Handwäsche sowie die Reinigung von Innenraum, Felgen, Reifen und Scheiben. Eine Sprühversiegelung ergänzt die Pflege. Eine Lackpolitur ist nicht enthalten. Ab 149 € inkl. MwSt., Dauer ca. 3 Std.",
    price: 149,
    duration: "ca. 3 Std.",
    items: [
      "Handwäsche mit pH-neutralem Shampoo",
      "Felgen- und Reifenreinigung",
      "Innenraum: saugen, entstauben, materialgerecht reinigen",
      "Scheiben innen und außen",
      "Sprühversiegelung, Haltbarkeit ca. 3 Monate",
    ],
  },
  {
    id: "premium",
    kicker: "Innenraum-Tiefenreinigung und einstufige Lackpolitur",
    name: "Reinigung & Politur",
    searchLabel: "Reinigung und Lackpflege",
    seoName: "Fahrzeugaufbereitung Signature – Lackpolitur und Innenraumreinigung Horb",
    body: "Das Paket Reinigung & Politur ergänzt die Basisreinigung um eine gründliche Lackreinigung, eine einstufige Politur und die Tiefenreinigung von Innenraum und Textilien. Anschließend schützt Wachs den Lack. Ab 349 € inkl. MwSt., Dauer ca. 6 Std.",
    price: 349,
    duration: "ca. 6 Std.",
    featured: true,
    items: [
      "Alle Leistungen des Pakets Basisreinigung",
      "Entfernung von Lackablagerungen mit Reinigungsknete und Eisenentferner",
      "Einstufige Lackpolitur für gleichmäßigen Glanz",
      "Tiefenreinigung von Innenraum und Textilien",
      "Wachs, Haltbarkeit ca. 6 Monate",
    ],
  },
  {
    id: "keramik",
    kicker: "Mehrstufige Lackkorrektur und Keramikversiegelung",
    name: "Keramikschutz",
    searchLabel: "Lackkorrektur und Versiegelung",
    seoName: "Keramikversiegelung Auto Horb – Paket Keramik inkl. Lackkorrektur",
    body: "Das Paket Keramikschutz umfasst zusätzlich eine mehrstufige Lackkorrektur und Keramikversiegelung. Glas- und Felgenversiegelung, Lederpflege sowie der Hol- und Bringservice bis 60 km sind enthalten. Die Haltbarkeit der Beschichtung richtet sich nach dem Produkt. Ab 899 € inkl. MwSt., Dauer ca. 2 Tage.",
    price: 899,
    duration: "ca. 2 Tage",
    includesPickup: true,
    items: [
      // Inhaltlich zu klären: Wird Wachs bei Keramik durch die Beschichtung ersetzt?
      "Alle Leistungen des Pakets Reinigung & Politur",
      "Mehrstufige Lackkorrektur unter Werkstattlicht",
      "Keramikversiegelung mit Haltbarkeit laut Produktangabe",
      "Glas- und Felgenversiegelung",
      "Lederpflege",
      "Hol- und Bringservice bis 60 km",
    ],
  },
];

export const packageSearchAlias: Record<string, PackageId> = {
  basis: "basis",
  pur: "basis",
  basisreinigung: "basis",
  premium: "premium",
  signature: "premium",
  "reinigung & politur": "premium",
  "reinigung-politur": "premium",
  glanz: "premium",
  keramik: "keramik",
  keramikschutz: "keramik",
  "high-end": "keramik",
  highend: "keramik",
};

export function parsePackageSearch(raw: unknown): PackageId | undefined {
  const key = String(raw ?? "").trim().toLowerCase();
  return packageSearchAlias[key];
}

export const packageServiceSlug: Record<PackageId, string> = {
  basis: "innenraumreinigung",
  premium: "lackkorrektur",
  keramik: "keramikversiegelung",
};

export function packageAnchor(id: PackageId) {
  return `paket-${id}`;
}

export type Extra = {
  id: string;
  name: string;
  hint: string;
  price: number;
  group: "pflege" | "reparatur";
  inspect?: boolean;
};

export const extras: Extra[] = [
  {
    id: "felgen",
    name: "Felgenreinigung und Versiegelung",
    hint: "Felgen demontiert, tiefengereinigt und versiegelt",
    price: 119,
    group: "pflege",
  },
  {
    id: "ozon",
    name: "Geruchsbehandlung mit Ozon",
    hint: "Ozonbehandlung gegen Nikotin-, Tier- und Feuchtigkeitsgerüche",
    price: 99,
    group: "pflege",
  },
  {
    id: "motor",
    name: "Motorraumreinigung",
    hint: "Schonende Nassreinigung des Motorraums mit anschließender Kunststoffpflege",
    price: 99,
    group: "pflege",
  },
  {
    id: "leder",
    name: "Lederpflege",
    hint: "Tiefenreinigung und Imprägnierung aller Lederflächen",
    price: 149,
    group: "pflege",
  },
  {
    id: "alcantara",
    name: "Alcantarareinigung",
    hint: "Faserschonende Reinigung von Sitzen, Lenkrad und Dachhimmel",
    price: 99,
    group: "pflege",
  },
  {
    id: "dachhimmel",
    name: "Dachhimmelreinigung",
    hint: "Entfernung von Flecken und Grauschleiern, soweit der Materialzustand es zulässt",
    price: 139,
    group: "pflege",
    inspect: true,
  },
  {
    id: "scheinwerfer",
    name: "Scheinwerferaufbereitung",
    hint: "Politur vergilbter Scheinwerfer mit UV-Schutz; Preis pro Paar",
    price: 99,
    group: "pflege",
  },
  {
    id: "glas",
    name: "Scheibenversiegelung",
    hint: "Versiegelung von Front- und Seitenscheiben für besseres Abperlen und weniger Wischergeräusche",
    price: 99,
    group: "pflege",
  },
  {
    id: "keramik-ultra",
    name: "Zusätzliche Keramikschichten",
    hint: "Zusätzlicher Schichtaufbau, nur nach Prüfung des Lacks",
    price: 699,
    group: "pflege",
    inspect: true,
  },
  {
    id: "cabrio",
    name: "Cabrioverdeckpflege",
    hint: "Reinigung und Imprägnierung von Stoff- oder Vinylverdecken",
    price: 179,
    group: "pflege",
    inspect: true,
  },
  {
    id: "tierhaar",
    name: "Tierhaarentfernung",
    hint: "Zusätzliche Entfernung von Tierhaaren aus Polstern, Teppichen und Kofferraum",
    price: 99,
    group: "pflege",
  },
  {
    id: "leder-repair",
    name: "Lederreparatur",
    hint: "Reparatur von Brandlöchern, Rissen und kleinen Löchern nach Materialprüfung",
    price: 139,
    group: "reparatur",
    inspect: true,
  },
  {
    id: "stoff-loch",
    name: "Textilreparatur",
    hint: "Reparatur an Sitz, Teppich oder Dachhimmel, sofern das Gewebe geeignet ist",
    price: 119,
    group: "reparatur",
    inspect: true,
  },
];

export type City = {
  slug: string;
  name: string;
  km: number;
  minutes: number;
  blurb: string;
};

export const cities: City[] = [
  {
    slug: "horb-am-neckar",
    name: "Horb am Neckar",
    km: 0,
    minutes: 10,
    blurb:
      "Horb am Neckar ist unser Standort. Die Werkstatt befindet sich an der Adresse Arnistal 27. Viele Kunden bringen das Fahrzeug selbst vorbei.",
  },
  {
    slug: "nagold",
    name: "Nagold",
    km: 20,
    minutes: 25,
    blurb:
      "Aus Nagold holen wir über die B28 ab – rund 25 Minuten bis zur Werkstatt.",
  },
  {
    slug: "rottenburg-am-neckar",
    name: "Rottenburg am Neckar",
    km: 25,
    minutes: 30,
    blurb:
      "Rottenburg liegt am Neckar Richtung Tübingen. Die Fahrt zur Werkstatt in Horb dauert etwa 30 Minuten.",
  },
  {
    slug: "freudenstadt",
    name: "Freudenstadt",
    km: 30,
    minutes: 35,
    blurb:
      "Für die Abholung aus Freudenstadt im Nordschwarzwald beträgt die Fahrzeit ca. 35 Min. Die Aufbereitung erfolgt in unserer Werkstatt in Horb.",
  },
  {
    slug: "oberndorf-am-neckar",
    name: "Oberndorf am Neckar",
    km: 30,
    minutes: 35,
    blurb:
      "Oberndorf am Neckar erreichen wir in etwa 35 Minuten. Übergabe an der vereinbarten Adresse, Rückgabe nach Kontrolle unter Werkstattlicht in Horb.",
  },
  {
    slug: "herrenberg",
    name: "Herrenberg",
    km: 35,
    minutes: 40,
    blurb:
      "Herrenberg liegt an der A81. Die Fahrzeit für die Abholung beträgt ca. 40 Min. Abholung und Rückgabe stimmen wir passend zur Dauer der Aufbereitung mit Ihnen ab.",
  },
  {
    slug: "tuebingen",
    name: "Tübingen",
    km: 35,
    minutes: 40,
    blurb:
      "Aus Tübingen holen wir in etwa 40 Minuten ab. Die Ausführung bleibt in Horb – dort haben wir gleichmäßiges Licht, Wasseraufbereitung und keine Straßenverschmutzung.",
  },
  {
    slug: "calw",
    name: "Calw",
    km: 40,
    minutes: 45,
    blurb:
      "Calw liegt rund 45 Minuten von der Werkstatt entfernt.",
  },
  {
    slug: "balingen",
    name: "Balingen",
    km: 45,
    minutes: 50,
    blurb:
      "Die Fahrzeit für die Abholung aus Balingen auf der Zollernalb beträgt ca. 50 Min. Vor einem Verkauf oder einer Leasingrückgabe stimmen wir die nötigen Arbeiten mit Ihnen ab.",
  },
  {
    slug: "rottweil",
    name: "Rottweil",
    km: 45,
    minutes: 50,
    blurb:
      "Rottweil erreichen wir in etwa 50 Minuten. Ausführung ausschließlich in der Horber Werkstatt.",
  },
  {
    slug: "boeblingen",
    name: "Böblingen",
    km: 50,
    minutes: 55,
    blurb:
      "Böblingen liegt an der Grenze des regelmäßigen Abholradius. Die Fahrt dauert rund 55 Minuten.",
  },
  {
    slug: "reutlingen",
    name: "Reutlingen",
    km: 50,
    minutes: 55,
    blurb:
      "Die Fahrzeit für die Abholung aus Reutlingen beträgt ca. 55 Min. Lackkorrektur und Innenraumreinigung erfolgen in unserer Werkstatt in Horb.",
  },
  {
    slug: "sindelfingen",
    name: "Sindelfingen",
    km: 52,
    minutes: 60,
    blurb:
      "Sindelfingen liegt knapp außerhalb des festen Abholradius. Die Ausführung bleibt in Horb.",
  },
];

export const pickupPricing = {
  tiers: [
    { id: "tier_10", maxKm: 10, amount: 0, label: "Abholung bis 10 km" },
    { id: "tier_20", maxKm: 20, amount: 50, label: "Abholung bis 20 km" },
    { id: "tier_50", maxKm: 50, amount: 70, label: "Abholung bis 50 km" },
  ],
  maxKm: 50,
  freeWithPackageId: "keramik" as PackageId,
  freeUpToKm: 60,
};

export function pickupFee(km: number, packageId?: PackageId) {
  if (packageId === pickupPricing.freeWithPackageId && km <= pickupPricing.freeUpToKm)
    return 0;
  const tiers = [...pickupPricing.tiers].sort((a, b) => a.maxKm - b.maxKm);
  for (const tier of tiers) {
    if (km <= tier.maxKm) return tier.amount;
  }
  return null;
}

export function pickupPriceText(km: number, packageId?: PackageId) {
  if (packageId === pickupPricing.freeWithPackageId && km <= pickupPricing.freeUpToKm) {
    return `inklusive bis ${pickupPricing.freeUpToKm} km`;
  }
  const fee = pickupFee(km, packageId ?? "basis");
  if (fee === null) return "auf Anfrage";
  if (fee === 0) return "kostenlos";
  return eur(fee);
}

export function pickupTierSummary(): string {
  const parts = [...pickupPricing.tiers]
    .sort((a, b) => a.maxKm - b.maxKm)
    .map((t) => `bis ${t.maxKm} km ${t.amount === 0 ? "kostenlos" : eur(t.amount)}`);
  const text = `${parts.join(", ")}, darüber auf Anfrage`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function pickupKeramikNote(): string {
  return `Im Paket Keramikschutz ist die Abholung bis ${pickupPricing.freeUpToKm} km enthalten`;
}

export function quoteTotal(opts: {
  packageId: PackageId;
  classId: VehicleClass["id"];
  extraIds: string[];
  citySlug?: string;
}) {
  const pack = packages.find((p) => p.id === opts.packageId)!;
  const klass = vehicleClasses.find((c) => c.id === opts.classId)!;
  const extrasSum = extras
    .filter((e) => opts.extraIds.includes(e.id))
    .reduce((s, e) => s + e.price, 0);
  const city = opts.citySlug ? cities.find((c) => c.slug === opts.citySlug) : undefined;
  const pickup = city ? pickupFee(city.km, opts.packageId) : opts.citySlug ? null : 0;
  const scaled = (pack.price + extrasSum) * klass.factor;
  const pickupValue = pickup === null ? 0 : pickup;
  return {
    pack,
    klass,
    city,
    pickup,
    extrasSum: extrasSum * klass.factor,
    subtotal: scaled,
    total: scaled + pickupValue,
    pickupOnRequest: pickup === null,
  };
}

export type ServicePage = {
  /** Existing search title label; kept stable while visible labels are edited. */
  seoNav: string;
  slug: string;
  title: string;
  nav: string;
  metaTitle: string;
  description: string;
  teaser: string;
  group: "atelier" | "finish";
  fromPrice?: number;
  image: string;
  imageAlt: string;
  bullets: string[];
  body: string[];
  steps?: { title: string; text: string }[];
  priceRows?: { name: string; price: number; note?: string }[];
  honestNote?: string;
};

export const services: ServicePage[] = [
  {
    slug: "fahrzeugaufbereitung",
    seoNav: "Signature Finish",
    title: "Fahrzeugaufbereitung in Horb am Neckar",
    nav: "Fahrzeugaufbereitung",
    metaTitle: "Fahrzeugaufbereitung Horb am Neckar | White Gloss",
    description:
      "Fahrzeugaufbereitung in Horb am Neckar: Handwäsche, Innenraum und Lackpflege. Wir richten uns nach dem Zustand, nicht nach einem Waschstraßenprogramm.",
    teaser: "Handwäsche, Innenraumreinigung und Lackpflege passend zu Ihrem Fahrzeug.",
    group: "atelier",
    fromPrice: 149,
    image: "/media/hero.webp",
    imageAlt: "Weißes Fahrzeug von White Gloss in Horb am Neckar, Kennzeichen entfernt",
    bullets: [
      "Handwäsche und Innenraumreinigung aus einer Hand",
      "Prüfung von Lack, Materialien und Verschmutzung vor Beginn",
      "Individuelle Aufbereitung unter Werkstattlicht",
      "Abschließende Kontrolle vor der Fahrzeugübergabe",
    ],
    body: [
      "Wir prüfen Lack und Innenraum und besprechen Ihre Wünsche. So legen wir gemeinsam fest, welche Reinigung und Pflege Ihr Fahrzeug benötigt.",
      "Die Arbeit bleibt in Horb. Aus 13 Städten holen wir das Auto ab und bringen es wieder.",
    ],
    steps: [
      {
        title: "Fahrzeug prüfen",
        text: "Wir prüfen Lack, Innenraum und Felgen und erklären, welche Gebrauchsspuren sich behandeln lassen.",
      },
      {
        title: "Umfang",
        text: "Wir wählen mit Ihnen das passende Paket: Basisreinigung, Reinigung & Politur oder Keramikschutz.",
      },
      {
        title: "Werkstatt",
        text: "Wir bereiten Ihr Fahrzeug einzeln in unserer Werkstatt unter geeigneter Beleuchtung auf.",
      },
      {
        title: "Übergabe",
        text: "Vor der Übergabe kontrollieren wir das Ergebnis und bessern bei Bedarf nach.",
      },
    ],
  },
  {
    slug: "innenraumreinigung",
    seoNav: "Interior Gloss",
    title: "Innenraumreinigung",
    nav: "Innenraumreinigung",
    metaTitle: "Innenraumreinigung Auto Horb | White Gloss",
    description:
      "Innenraumreinigung in Horb: Sitze, Teppiche, Kunststoffe. Gegen Gerüche optional Ozon. Wir arbeiten am Material, nicht mit Duft.",
    teaser: "Gründliche Reinigung von Sitzen, Teppichen und Verkleidungen.",
    group: "atelier",
    fromPrice: 149,
    image: "/media/leder.webp",
    imageAlt: "Ledersitze nach der Innenraumreinigung",
    bullets: [
      "Gründliche Reinigung von Sitzen, Teppichen und Fußräumen",
      "Kunststoff und Verkleidungen passend zum Material",
      "Gezielte Behandlung von Flecken und Gebrauchsspuren",
      "Prüfung der Geruchsursache; Ozonbehandlung optional ab 99 €",
    ],
    body: [
      "Wir entfernen Verschmutzungen aus Sitzen, Teppichen und Verkleidungen. Die Reinigungsmethode stimmen wir auf das jeweilige Material ab.",
      "Bei Gerüchen behandeln wir zuerst die Ursache. Falls nötig, kann eine zusätzliche Ozonbehandlung geruchsbildende Moleküle abbauen.",
    ],
    steps: [
      {
        title: "Material",
        text: "Wir wählen für Leder, Stoff, Alcantara und Kunststoff jeweils geeignete Reinigungsmittel.",
      },
      {
        title: "Lösen",
        text: "Wir lösen Verschmutzungen in Fußräumen, auf Sitzen und in Fugen.",
      },
      {
        title: "Pflegen",
        text: "Nach der Reinigung pflegen wir Kunststoff- und Lederflächen passend zum Material.",
      },
      {
        title: "Geruch",
        text: "Bei Bedarf behandeln wir verbleibende Gerüche mit Ozon. Dafür muss der Innenraum sauber und trocken sein.",
      },
    ],
  },
  {
    slug: "lackkorrektur",
    seoNav: "Lackatelier",
    title: "Lackkorrektur",
    nav: "Lackkorrektur",
    metaTitle: "Lackkorrektur & Politur Horb | White Gloss",
    description:
      "Lackkorrektur in Horb: Swirls und Waschkratzer rausarbeiten, Farbe und Glanz zurückholen – ohne unnötig Lack abzutragen.",
    teaser: "Lackpolitur zur Reduzierung feiner Kratzer und für gleichmäßigen Glanz.",
    group: "atelier",
    fromPrice: 349,
    image: "/media/lack.webp",
    imageAlt: "Poliermaschine auf dem Lack",
    bullets: [
      "Reduzierung feiner Waschkratzer, soweit die Klarlackschicht es zulässt",
      "Mehr Tiefe, gleichmäßigere Spiegelung",
      "Politur abgestimmt auf Lackzustand und Schichtstärke",
      "Vorbereitung des Lacks für Wachs oder Keramikversiegelung",
    ],
    body: [
      "Nicht jeder Kratzer lässt sich auspolieren. Wir prüfen den Lack vorab und erklären Ihnen die Möglichkeiten und Grenzen der Behandlung.",
      "Das Paket Reinigung & Politur enthält eine einstufige Lackpolitur. Im Paket Keramikschutz ist eine mehrstufige Lackkorrektur enthalten, sofern die Lackschicht dafür geeignet ist.",
    ],
    steps: [
      {
        title: "Lackprüfung",
        text: "Wir prüfen den Lack unter Werkstattlicht und messen die Schichtstärke, um den möglichen Umfang der Politur zu bestimmen.",
      },
      {
        title: "Entfernung von Ablagerungen",
        text: "Wir entfernen haftende Ablagerungen, bevor wir mit der Maschinenpolitur beginnen.",
      },
      {
        title: "Politur",
        text: "Je nach Paket und Lackzustand polieren wir in einem oder mehreren Arbeitsschritten.",
      },
      {
        title: "Schutz",
        text: "Das Paket Reinigung & Politur enthält Wachs. Eine Keramikversiegelung ist besonders für Fahrzeuge sinnvoll, die Sie länger nutzen möchten.",
      },
    ],
  },
  {
    slug: "keramikversiegelung",
    seoNav: "Ceramic Gloss",
    title: "Keramikversiegelung",
    nav: "Keramikversiegelung",
    metaTitle: "Keramikversiegelung Auto Horb | White Gloss",
    description:
      "Keramikversiegelung in Horb am Neckar ab 899 €: erst Lackkorrektur, dann die Schicht. Standzeit laut Produkt, keine pauschalen Werbejahre.",
    teaser: "Lackkorrektur und anschließende Keramikversiegelung.",
    group: "atelier",
    fromPrice: 899,
    image: "/media/keramik.webp",
    imageAlt: "Keramikversiegelung wird von Hand auf den Lack aufgetragen",
    bullets: [
      "Wasser perlt, das Auto bleibt länger sauber",
      "Gleichmäßiger Glanz durch gründliche Lackvorbereitung",
      "Schutz vor Vogelkot, Insekten und Alltagsbelastung",
      "Haltbarkeit abhängig von Produkt und Pflege",
    ],
    body: [
      "Für die Haftung der Keramikversiegelung ist eine gründliche Vorbereitung entscheidend. Wir reinigen und korrigieren den Lack, bevor wir die Beschichtung in unserer Werkstatt auftragen.",
      "Vor der Behandlung erklären wir Ihnen, welches Produkt wir verwenden und welche Haltbarkeit zu erwarten ist. Keramikversiegelung macht den Lack nicht kratzfest. In den ersten 7 Tagen sollte das Fahrzeug nicht gewaschen werden; Regen ist in dieser Zeit kein Problem.",
      "Planen Sie ca. 2 Tage ein. Glas- und Felgenversiegelung sowie der Hol- und Bringservice bis 60 km sind im Paket enthalten.",
    ],
    steps: [
      {
        title: "Vorreinigung",
        text: "Wir reinigen Lack und Felgen gründlich und entfernen haftende Ablagerungen auch an schwer zugänglichen Stellen.",
      },
      {
        title: "Lack vorbereiten",
        text: "Wir polieren den Lack entsprechend seinem Zustand und entfetten ihn anschließend rückstandsfrei.",
      },
      {
        title: "Keramik auftragen",
        text: "Wir tragen die Beschichtung gleichmäßig auf und kontrollieren das Ablüften vor dem nächsten Arbeitsschritt.",
      },
      {
        title: "Aushärten",
        text: "Die Beschichtung härtet geschützt aus. Anschließend kontrollieren wir das Ergebnis und übergeben Ihnen das Fahrzeug.",
      },
    ],
  },
  {
    slug: "lederpflege",
    seoNav: "Lederatelier",
    title: "Lederpflege",
    nav: "Lederpflege",
    metaTitle: "Auto-Lederpflege Horb am Neckar | White Gloss",
    description:
      "Lederreinigung und Lederpflege fürs Auto in Horb: Verschmutzungen lösen, Glanzstellen reduzieren, Flächen schützen.",
    teaser: "Gründliche Reinigung und materialgerechte Pflege für Autoleder.",
    group: "atelier",
    fromPrice: 149,
    image: "/media/leder.webp",
    imageAlt: "Leder nach der Pflege",
    bullets: [
      "Beanspruchtes Leder sauber bekommen, ohne es anzugreifen",
      "Glanzstellen durch Schmutz reduzieren",
      "Danach pflegen und schützen",
      "Sitzwangen und Kontaktflächen extra im Blick",
    ],
    body: [
      "Leder braucht die richtige Pflege, keine aggressive Chemie. Wir reinigen zuerst gründlich und lassen die Pflege danach einziehen.",
      "Die Lederpflege ab 149 € umfasst Tiefenreinigung und Imprägnierung. Sie ist als Zusatzleistung erhältlich. Das Paket Keramikschutz enthält ebenfalls Lederpflege.",
    ],
  },
  {
    slug: "smart-repair",
    seoNav: "Paintless Finish",
    title: "Dellenentfernung & Smart Repair",
    nav: "Dellenentfernung",
    metaTitle: "Dellenentfernung & Hagelschaden Horb | White Gloss",
    description:
      "Parkdellen, Karosseriedellen und Hagelschäden lackschadenfrei ausbeulen – sofern technisch möglich. Preis nach Begutachtung.",
    teaser: "Lackschadenfreie Dellenentfernung, sofern technisch möglich.",
    group: "finish",
    image: "/media/dellen.webp",
    imageAlt: "Parkdelle unter Streiflicht, bevor wir ausbeulen",
    bullets: [
      "Einzelne Stellen, nicht gleich die ganze Fläche lackieren",
      "Erst anschauen, dann ehrlich sagen, was geht",
      "Passt gut zu Lackkorrektur und Aufbereitung",
      "Oft sinnvoll vor Verkauf oder Leasingrückgabe",
    ],
    body: [
      "Wir entfernen Parkdellen, kleinere Karosseriedellen und Hagelschäden ohne Neulackierung, sofern der Schaden und der Lackzustand dies zulassen.",
      "Einen Preis und eine Zusage gibt es erst, wenn wir den Schaden gesehen haben und Sie zustimmen. Bei kleinen Stellen reicht oft ein Foto zur ersten Einschätzung.",
    ],
  },
  {
    slug: "leasingrueckgabe",
    seoNav: "Leasing Gloss",
    title: "Leasingrückläufer-Aufbereitung",
    nav: "Leasingaufbereitung",
    metaTitle: "Leasingrückgabe-Aufbereitung Horb | White Gloss",
    description:
      "Aufbereitung vor der Leasingrückgabe in Horb: Innenreinigung, Lackpflege, punktuelle Nacharbeit – ehrlich priorisiert.",
    teaser: "Gezielte Aufbereitung vor der Leasingrückgabe.",
    group: "finish",
    fromPrice: 349,
    image: "/media/hero.webp",
    imageAlt: "Eigenes Fahrzeug von White Gloss in Horb, vor der Übergabe",
    bullets: [
      "Zuerst die Stellen, die bei der Rückgabe auffallen",
      "Innenraum, Lackpflege und punktuelle Nacharbeit",
      "Wir sagen vorher, was bleibt",
      "Terminabstimmung passend zur geplanten Leasingrückgabe",
    ],
    body: [
      "Vor der Leasingrückgabe konzentrieren wir uns auf relevante Gebrauchsspuren. Wir besprechen mit Ihnen, welche Arbeiten sinnvoll sind und welche Spuren bleiben.",
      "Für Autohäuser und Flotten erstellen wir ein individuelles Angebot nach Fahrzeuganzahl und Zustand.",
    ],
  },
  {
    // Inhaltlich zu klären: 119 € ist die Textilposition; Lederpositionen beginnen bei 139 €.
    slug: "lederreparatur",
    seoNav: "Lederrestauration",
    title: "Lederreparatur im Auto",
    nav: "Lederreparatur",
    metaTitle: "Lederreparatur Auto Horb – Brandloch, Riss, Loch | White Gloss",
    description:
      "Lederreparatur in Horb am Neckar: Brandlöcher, Risse, kleine Löcher. Nur wenn es wirklich haltbar ist – sonst sagen wir ehrlich nein.",
    teaser: "Reparatur von Brandlöchern und Rissen nach Materialprüfung.",
    group: "finish",
    fromPrice: 119,
    image: "/media/leder.webp",
    imageAlt: "Ledersitz nach der Pflege in der Werkstatt Horb",
    bullets: [
      "Brandlöcher, kleine Löcher, Risse und offene Nähte",
      "Reparatur nur bei geeignetem Materialzustand",
      "Farbanpassung an das vorhandene Leder; Unterschiede können sichtbar bleiben",
      "Fotos zuerst, Preis erst nach Prüfung am Auto",
    ],
    honestNote:
      "Wir reparieren nur, wenn das Material eine dauerhafte Reparatur zulässt. Ist das Leder zu dünn, großflächig rissig oder das Loch zu groß, erklären wir Ihnen das vorab. Für einen ungeeigneten Reparaturversuch entstehen Ihnen keine Kosten.",
    priceRows: [
      { name: "Brandloch / kleines Loch", price: 139, note: "eine Stelle, nach Prüfung" },
      { name: "Riss oder offene Naht", price: 159, note: "eine Stelle, nach Prüfung" },
      { name: "Lenkrad-Leder", price: 179, note: "Abrieb, kleine Risse" },
      { name: "Farbauffrischung Sitzfläche", price: 189, note: "wenn das Leder noch fest ist" },
      { name: "Brandloch Textil / Himmel", price: 119, note: "nur bei tragfähigem Gewebe" },
    ],
    body: [
      "Bei Brandlöchern und Rissen im Ledersitz kann eine punktuelle Reparatur möglich sein. Ob sie für Ihr Fahrzeug geeignet ist, prüfen wir vor der Beauftragung.",
      "Wir prüfen Material, Dicke, Schadensränder und die Belastung der Stelle. Sitzwangen und Einstiegsbereiche sind besonders beansprucht. Ist keine dauerhafte Reparatur zu erwarten, führen wir sie nicht aus.",
      "Wir passen die Farbe an das vorhandene Leder an. Bei älterem oder ausgebleichtem Leder kann ein Unterschied sichtbar bleiben. Für ein vollständig einheitliches Ergebnis ist unter Umständen ein Neubezug durch eine Sattlerei nötig.",
      "Schicken Sie Fotos bei Tageslicht, ohne Blitz. Wenn es machbar wirkt, schauen wir das Auto in Horb an und nennen den Preis. Abholung aus 13 Städten ist möglich.",
    ],
    steps: [
      {
        title: "Fotos",
        text: "Senden Sie eine Nahaufnahme und ein Übersichtsbild der beschädigten Stelle. Damit können wir eine erste Einschätzung geben.",
      },
      {
        title: "Prüfung am Auto",
        text: "Wir prüfen Material, Schadensgröße und Belastung. Danach nennen wir einen verbindlichen Preis oder erklären, warum eine Reparatur nicht möglich ist.",
      },
      {
        title: "Reparatur",
        text: "Wir führen die vereinbarte Reparatur aus. Nach der Trocknung und abschließenden Kontrolle übergeben wir das Fahrzeug.",
      },
    ],
  },
  {
    slug: "geruchsneutralisation",
    seoNav: "Air Pure",
    title: "Geruchsneutralisation mit Ozon",
    nav: "Geruchsbehandlung mit Ozon",
    metaTitle: "Geruchsneutralisation Auto Ozon Horb | White Gloss",
    description:
      "Ozonbehandlung gegen Nikotin, Tier- und Feuchtigkeitsgeruch in Horb am Neckar ab 99 €. Erst Ursache, dann Ozon – kein Duftspray.",
    teaser: "Geruchsursache behandeln und bei Bedarf mit Ozon nacharbeiten.",
    group: "finish",
    fromPrice: 99,
    image: "/media/atelier.webp",
    imageAlt: "Werkstattinnenraum von White Gloss in Horb",
    bullets: [
      "Zuerst die Ursache: Schmutz, Nässe, Filter, Polster",
      "Ozon baut geruchsbildende Moleküle ab",
      "Behandlung von Nikotin-, Tier- und Feuchtigkeitsgerüchen, häufig ergänzend zur Innenraumreinigung",
      "Ab 99 €, bei starker Belastung nach Absprache",
    ],
    body: [
      "Ozon baut geruchsbildende Moleküle ab. Die Behandlung setzt einen sauberen, trockenen Innenraum voraus. Bleibt die Ursache bestehen, kann der Geruch zurückkehren.",
      "Bei starkem Nikotin- oder Schimmelgeruch können eine Innenraumreinigung und mehrere Ozonbehandlungen nötig sein. Den voraussichtlichen Aufwand besprechen wir vor Beginn mit Ihnen.",
    ],
  },
  {
    slug: "scheinwerferaufbereitung",
    seoNav: "Lichtklar",
    title: "Scheinwerferaufbereitung",
    nav: "Scheinwerferaufbereitung",
    metaTitle: "Scheinwerfer aufbereiten Horb am Neckar | White Gloss",
    description:
      "Vergilbte Scheinwerfer aufbereiten in Horb: Politur und UV-Schutz, ab 99 € das Paar. Sicht und Optik, ohne gleich neue Streuscheiben.",
    teaser: "Aufbereitung vergilbter Scheinwerfer mit Politur und UV-Schutz.",
    group: "finish",
    fromPrice: 99,
    image: "/media/finish.webp",
    imageAlt: "Lack und Licht unter Prüflicht nach der Aufbereitung",
    bullets: [
      "Matte, gelbe Streuscheiben wieder klar",
      "Anschließender UV-Schutz gegen erneute Vergilbung",
      "Paarpreis ab 99 €, inkl. MwSt.",
      "Bei stark geschädigtem Kunststoff ist ein Austausch nötig",
    ],
    honestNote:
      "Rissige oder stark geschädigte Streuscheiben bereiten wir nicht auf. Wir prüfen vorab, ob das Material für eine Politur geeignet ist.",
    priceRows: [
      { name: "Scheinwerfer-Paar", price: 99, note: "Politur und UV-Schutz" },
    ],
    body: [
      "Vergilbte Scheinwerfer nehmen Licht und Wert. Oft reicht Aufbereitung statt neuer Streuscheiben. Der UV-Schutz ist der Teil, der die Haltbarkeit entscheidet.",
      "Passt gut zur Lackkorrektur oder zur Verkaufsvorbereitung. Hol- und Bringservice aus 13 Städten.",
    ],
  },
];

export const faqs = [
  {
    group: "Kosten",
    q: "Was kostet eine Keramikversiegelung?",
    a: "Bei White Gloss beginnt die Keramikversiegelung im Paket Keramikschutz ab 899 €. Der endgültige Preis hängt von der Fahrzeugklasse und vom Zustand des Lacks ab. Den verbindlichen Preis nennen wir Ihnen, nachdem wir das Fahrzeug gesehen haben.",
  },
  {
    group: "Dauer",
    q: "Wie lange dauert eine Keramikversiegelung?",
    a: "Planen Sie ca. 2 Tage ein. Der größere Teil entfällt auf Reinigung, Entfernung von Ablagerungen und Lackkorrektur. Anschließend muss die Keramik geschützt aushärten.",
  },
  {
    group: "Dauer",
    q: "Wie lange dauert eine komplette Fahrzeugaufbereitung?",
    a: "Basisreinigung: ca. 3 Std.; Reinigung & Politur: ca. 6 Std.; Keramikschutz: ca. 2 Tage. Bei starker Verschmutzung oder Gerüchen kann mehr Zeit nötig sein.",
  },
  {
    group: "Keramikversiegelung",
    q: "Was ist der Unterschied zwischen Wachs, Versiegelung und Keramik?",
    a: "Wachs hält je nach Nutzung einige Monate. Eine Sprühversiegelung ist dünner. Keramik verbindet sich mit dem Klarlack und hält länger – wenn der Lack vorbereitet ist und danach gepflegt wird.",
  },
  {
    group: "Keramikversiegelung",
    q: "Wie lange hält die Keramikversiegelung?",
    a: "Die Haltbarkeit hängt vom verwendeten Produkt, der Nutzung und der Pflege ab. Vor der Behandlung erklären wir Ihnen die zu erwartende Haltbarkeit. Bürstenanlagen können die Beschichtung schneller beanspruchen.",
  },
  {
    group: "Keramikversiegelung",
    q: "Darf ich mit einer Keramikversiegelung in die Waschanlage?",
    a: "Grundsätzlich ist das möglich. Bürstenanlagen können jedoch feine Kratzer verursachen. Wir empfehlen eine Handwäsche mit pH-neutralem Shampoo oder eine berührungslose Waschanlage.",
  },
  {
    group: "Keramikversiegelung",
    q: "Kann ich mein Auto nach der Versiegelung sofort waschen?",
    a: "Nein. In den ersten etwa sieben Tagen sollte das Fahrzeug nicht gewaschen werden. Regen schadet in dieser Zeit nicht.",
  },
  {
    group: "Keramikversiegelung",
    q: "Lohnt sich eine Keramikversiegelung auch bei einem Gebrauchtwagen?",
    a: "Ja, sofern der Lack für die nötige Vorbereitung geeignet ist. Bei Gebrauchtwagen kann der sichtbare Unterschied größer sein als bei Neuwagen. Wir prüfen die Lackstärke vorab.",
  },
  {
    group: "Keramikversiegelung",
    q: "Ist eine Keramikversiegelung kratzfest?",
    a: "Nein. Sie erleichtert die Pflege und schützt vor vielen Umwelteinflüssen, macht den Lack aber nicht unempfindlich gegen mechanische Kratzer oder Steinschläge.",
  },
  {
    group: "Innenraumreinigung",
    q: "Bekommen Sie Gerüche aus dem Innenraum wieder heraus?",
    a: "In den meisten Fällen ja. Zuerst wird die Ursache beseitigt. Bleibt etwas zurück, hilft eine Ozonbehandlung für 99 € zusätzlich.",
  },
  {
    group: "Lederreparatur",
    q: "Reparieren Sie Brandlöcher und Risse im Leder?",
    a: "Ja, sofern der Materialzustand eine dauerhafte Reparatur zulässt. Die Preise beginnen bei 139 € pro Stelle. Ist das Leder zu dünn, großflächig rissig oder das Loch zu groß, führen wir die Reparatur nicht aus. Für einen ungeeigneten Reparaturversuch entstehen Ihnen keine Kosten.",
  },
  {
    group: "Lederreparatur",
    q: "Wird die Stelle hinterher unsichtbar?",
    a: "Wir passen die Farbe an das vorhandene Leder an. Besonders bei älterem oder ausgebleichtem Leder kann ein feiner Unterschied sichtbar bleiben. Für eine vollständig neue Sitzfläche ist eine Sattlerei der richtige Ansprechpartner.",
  },
  {
    group: "Abholservice",
    q: "Holen Sie mein Fahrzeug ab?",
    a: `Ja. Die Aufbereitung erfolgt in unserer Werkstatt in Horb am Neckar. ${pickupTierSummary()}. ${pickupKeramikNote()}.`,
  },
  {
    group: "Allgemein",
    q: "Wie oft sollte ich mein Auto aufbereiten lassen?",
    a: "Eine vollständige Aufbereitung ist meist einmal jährlich sinnvoll, ohne Garage eher häufiger. Mit Keramikversiegelung bleiben über Jahre regelmäßige Wäsche und gelegentliche Auffrischung entscheidend.",
  },
];

export const processSteps = [
  {
    n: "01.",
    title: "Fahrzeug prüfen",
    text: "Wir besprechen Ihre Wünsche und prüfen Lack und Innenraum. Anschließend empfehlen wir die Arbeiten, die zum Zustand Ihres Fahrzeugs passen.",
  },
  {
    n: "02.",
    title: "Vorbereiten",
    text: "Wir reinigen das Fahrzeug gründlich und schützen empfindliche Bereiche vor der weiteren Bearbeitung.",
  },
  {
    n: "03.",
    title: "Aufbereiten",
    text: "Wir führen die vereinbarten Arbeiten mit den zum Material passenden Verfahren aus.",
  },
  {
    n: "04.",
    title: "Kontrolle und Übergabe",
    text: "Wir kontrollieren das Ergebnis unter Werkstattlicht und zeigen es Ihnen bei der Übergabe.",
  },
];

export const nav = [
  { to: "/leistungen", label: "Leistungen" },
  { to: "/luxusfahrzeuge", label: "Luxusfahrzeuge" },
  { to: "/preise", label: "Preise & Pakete" },
  { to: "/qualitaet", label: "Arbeitsweise" },
  { to: "/abholservice", label: "Hol- und Bringservice" },
  { to: "/", label: "Individuelles Angebot", hash: "buchung" },
  { to: "/ratgeber", label: "Ratgeber" },
  { to: "/faq", label: "Häufige Fragen" },
  { to: "/galerie", label: "Werkstatt" },
  { to: "/kontakt", label: "Kontakt" },
  { to: "/b2b", label: "Geschäftskunden" },
] as const;

export const sheetPrimary = [
  { to: "/preise", label: "Preise & Pakete" },
  { to: "/qualitaet", label: "Arbeitsweise" },
  { to: "/abholservice", label: "Hol- und Bringservice" },
] as const;

export const sheetSecondary = [
  { to: "/ratgeber", label: "Ratgeber" },
  { to: "/faq", label: "Häufige Fragen" },
  { to: "/galerie", label: "Werkstatt" },
  { to: "/kontakt", label: "Kontakt" },
  { to: "/b2b", label: "Geschäftskunden" },
] as const;

export const footerExplore = [
  { to: "/abholservice", label: "Hol- und Bringservice" },
  { to: "/ratgeber", label: "Ratgeber" },
  { to: "/galerie", label: "Werkstatt" },
  { to: "/kontakt", label: "Kontakt" },
  { to: "/faq", label: "Häufige Fragen" },
] as const;

export const bookingStatuses = [
  { id: "neu", label: "Wartet auf Bestätigung" },
  { id: "bestaetigt", label: "Bestätigt" },
  { id: "abgelehnt", label: "Abgelehnt" },
  { id: "storniert", label: "Storniert" },
  { id: "erledigt", label: "Erledigt" },
  { id: "nicht_erschienen", label: "Nicht erschienen" },
] as const;

export type BookingStatus = (typeof bookingStatuses)[number]["id"];
