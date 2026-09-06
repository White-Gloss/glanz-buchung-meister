import { eur } from "../lib/utils.ts";

export const site = {
  name: "White Gloss",
  legalName: "White Gloss Detailing",
  tagline: "Fahrzeugaufbereitung. Kein Kompromiss. Sichtbare Ergebnisse.",
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
    "Unser Atelierfahrzeug in Horb am Neckar – kein Kundenauto, Kennzeichen entfernt.",
  invite:
    "Weitere Referenzen zeigen wir nur, wenn Sie sie freigeben, und immer ohne Kennzeichen.",
};

export const openingHours = {
  opens: "09:00",
  closes: "17:00",
  daysLabel: "Montag bis Freitag",
  dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const,
};

export const depositConfig = {
  rate: 0.1,
  label: "Anzahlung Neukunde (10 %)",
  note: "Nach Zusage wird bei Erstbuchungen eine Anzahlung von 10 % des Gesamtbetrags fällig. Der Rest nach Leistungserbringung. Kein automatischer Einzug.",
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
    hint: "Kleinwagen & Kompakte bis 4,30 m",
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
    hint: "Vans & Nutzfahrzeuge ab 5,00 m",
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
    kicker: "Innenraum und Handwäsche – wenn Politur noch nichts bringt",
    name: "Pur",
    searchLabel: "Basis Pflege",
    seoName: "Fahrzeugaufbereitung Pur – Innenraumreinigung in Horb am Neckar",
    body: "Pur ist die Werkstattwäsche mit Innenraum: Sitze, Teppiche, Felgen, Scheiben. Für Autos, die frisch wirken sollen, ohne Politurprogramm. Kein Duft statt Sauberkeit, keine Straße. Ab 149 € inkl. MwSt., rund drei Stunden in Horb.",
    price: 149,
    duration: "ca. 3 Std.",
    items: [
      "Handwäsche mit pH-neutralem Shampoo",
      "Felgen- und Reifenreinigung",
      "Innenraum: saugen, entstauben, materialgerecht reinigen",
      "Scheiben innen und außen",
      "Sprühversiegelung, etwa drei Monate",
    ],
  },
  {
    id: "premium",
    kicker: "Lackpolitur und Innenraum – das Hauspaket",
    name: "Signature",
    searchLabel: "Premium Glanz",
    seoName: "Fahrzeugaufbereitung Signature – Lackpolitur und Innenraumreinigung Horb",
    body: "Signature ist das, was die meisten brauchen: Innenraum, eine Stufe Politur gegen Waschkratzer, Wachs für den Glanz. Bevor jemand Keramik verkauft, gehört der Lack erst einmal klar. Ab 349 € inkl. MwSt., rund sechs Stunden.",
    price: 349,
    duration: "ca. 6 Std.",
    featured: true,
    items: [
      "Alles aus Pur",
      "Lackknete und Eisenentferner",
      "Einstufige Lackpolitur, Glanzaufbau",
      "Tiefenreinigung Innenraum und Textilien",
      "Wachs, etwa sechs Monate",
    ],
  },
  {
    id: "keramik",
    kicker: "Lackkorrektur und Beschichtung – Standzeit laut Produkt",
    name: "Keramik",
    searchLabel: "High-End Keramik",
    seoName: "Keramikversiegelung Auto Horb – Paket Keramik inkl. Lackkorrektur",
    body: "Keramik ohne Lackkorrektur ist Werbung. Bei uns kommt die Schicht erst, wenn der Klarlack trägt. Die Standzeit steht auf dem Produkt, nicht in der Anzeige. Glas, Felgen und Abholung bis 60 km sind im Preis. Ab 899 € inkl. MwSt., rund zwei Tage in Horb.",
    price: 899,
    duration: "ca. 2 Tage",
    includesPickup: true,
    items: [
      "Alles aus Signature",
      "Mehrstufige Lackkorrektur unter Werkstattlicht",
      "Keramikbeschichtung, Standzeit laut Produkt",
      "Glas- und Felgenversiegelung",
      "Leder-Konditionierung",
      "Hol- und Bringservice bis 60 km",
    ],
  },
];

export const packageSearchAlias: Record<string, PackageId> = {
  basis: "basis",
  pur: "basis",
  premium: "premium",
  signature: "premium",
  glanz: "premium",
  keramik: "keramik",
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
    name: "Felgen Gloss",
    hint: "Felgen demontiert, tiefengereinigt und versiegelt",
    price: 119,
    group: "pflege",
  },
  {
    id: "ozon",
    name: "Air Pure",
    hint: "Nikotin, Tier, Feuchtigkeit – ohne Duftmaske",
    price: 99,
    group: "pflege",
  },
  {
    id: "motor",
    name: "Engine Finish",
    hint: "Schonend nass, danach Kunststoffpflege",
    price: 99,
    group: "pflege",
  },
  {
    id: "leder",
    name: "Lederatelier",
    hint: "Tiefenreinigung und Imprägnierung aller Lederflächen",
    price: 149,
    group: "pflege",
  },
  {
    id: "alcantara",
    name: "Alcantara Care",
    hint: "Sitze, Lenkrad, Himmel – faserschonend",
    price: 99,
    group: "pflege",
  },
  {
    id: "dachhimmel",
    name: "Himmel Finish",
    hint: "Flecken und Grauschleier, soweit das Material mitmacht",
    price: 139,
    group: "pflege",
    inspect: true,
  },
  {
    id: "scheinwerfer",
    name: "Lichtklar",
    hint: "Vergilbung runter, UV-Schutz drauf – Paarpreis",
    price: 99,
    group: "pflege",
  },
  {
    id: "glas",
    name: "Glass Coat",
    hint: "Front und Seiten, Wasser perlt, die Wischer quietschen weniger",
    price: 99,
    group: "pflege",
  },
  {
    id: "keramik-ultra",
    name: "Keramik Extra",
    hint: "Dichterer Schichtaufbau, nur nach Lackprüfung",
    price: 699,
    group: "pflege",
    inspect: true,
  },
  {
    id: "cabrio",
    name: "Soft Top Care",
    hint: "Reinigen und Imprägnieren, Stoff oder Vinyl",
    price: 179,
    group: "pflege",
    inspect: true,
  },
  {
    id: "tierhaar",
    name: "Tierhaarfrei",
    hint: "Polster, Teppiche, Kofferraum – extra Aufwand",
    price: 99,
    group: "pflege",
  },
  {
    id: "leder-repair",
    name: "Lederrestauration",
    hint: "Brandloch, Riss, kleines Loch – nur wenn haltbar",
    price: 139,
    group: "reparatur",
    inspect: true,
  },
  {
    id: "stoff-loch",
    name: "Textilrestauration",
    hint: "Sitz, Teppich oder Himmel – nur wenn das Gewebe hält",
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
      "Horb am Neckar ist unser Standort. Die Werkstatt liegt in Arnistal 27. Viele Kunden bringen das Fahrzeug selbst vorbei.",
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
      "Aus Freudenstadt im Nordschwarzwald holen wir mit rund 35 Minuten Fahrzeit ab. Sinnvoll, wenn Sie keine Lackpolitur in einer Waschstraße riskieren wollen.",
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
      "Herrenberg liegt an der A81. Die Abholung dauert rund 40 Minuten. Für Pendler ein üblicher Ablauf: morgens übergeben, abends zurück.",
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
      "Aus Balingen auf der Zollernalb holen wir in rund 50 Minuten ab. Gut planbar vor Verkauf oder Leasingrückgabe, wenn Gutachterspuren priorisiert werden sollen.",
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
      "Aus Reutlingen holen wir in rund 55 Minuten ab. Sinnvoll, wenn Lackkorrektur und Innenraum nicht in einer Schnellwäsche enden sollen.",
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
  return `Im Paket Keramik ist die Abholung bis ${pickupPricing.freeUpToKm} km enthalten`;
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
    title: "Fahrzeugaufbereitung in Horb am Neckar",
    nav: "Signature Finish",
    metaTitle: "Fahrzeugaufbereitung Horb am Neckar | White Gloss",
    description:
      "Fahrzeugaufbereitung in Horb am Neckar: Handwäsche, Innenraum und Lackpflege. Wir richten uns nach dem Zustand, nicht nach einem Waschstraßenprogramm.",
    teaser: "Handwäsche, Innenraum, Lack – nach Zustand, nicht nach Programm.",
    group: "atelier",
    fromPrice: 149,
    image: "/media/hero.webp",
    imageAlt: "Weißes Atelierfahrzeug von White Gloss in Horb am Neckar, Kennzeichen entfernt",
    bullets: [
      "Von der Handwäsche bis zum Innenraum, in einem Ablauf",
      "Zuerst Lack, Material und Schmutz anschauen, dann entscheiden",
      "Ein Auto nach dem anderen, unter Werkstattlicht",
      "Kontrolle, bevor das Auto rausgeht – nicht nach der Waschstraße",
    ],
    body: [
      "Aufbereitung ist keine schnelle Wäsche. Wir schauen Lack und Innenraum an, hören, was Sie wollen, und arbeiten nur so weit, wie es nötig ist.",
      "Die Arbeit bleibt in Horb. Aus 13 Städten holen wir das Auto ab und bringen es wieder.",
    ],
    steps: [
      {
        title: "Anschauen",
        text: "Lack, Innenraum, Felgen. Was stört, was bleibt, was Politur noch trägt.",
      },
      {
        title: "Umfang",
        text: "Pur, Signature oder Keramik – nach dem Auto, nicht nach einer Liste.",
      },
      {
        title: "Werkstatt",
        text: "Ein Auto nach dem anderen, unter Licht. Keine Straße, keine Waschanlage.",
      },
      {
        title: "Abgabe",
        text: "Kontrolle, dann raus. Wenn etwas nicht sitzt, bleibt es hier.",
      },
    ],
  },
  {
    slug: "innenraumreinigung",
    title: "Innenraumreinigung",
    nav: "Interior Gloss",
    metaTitle: "Innenraumreinigung Auto Horb | White Gloss",
    description:
      "Innenraumreinigung in Horb: Sitze, Teppiche, Kunststoffe. Gegen Gerüche optional Ozon. Wir arbeiten am Material, nicht mit Duft.",
    teaser: "Schmutz lösen, nicht überdecken. Duft ist kein Ergebnis.",
    group: "atelier",
    fromPrice: 149,
    image: "/media/leder.webp",
    imageAlt: "Ledersitze nach der Innenraumreinigung",
    bullets: [
      "Sitze, Teppiche, Fußräume – Schmutz lösen, nicht überdecken",
      "Kunststoff und Verkleidungen passend zum Material",
      "Flecken und Gebrauchsspuren gezielt, nicht pauschal",
      "Geruch: erst Ursache, optional Ozon ab 99 €",
    ],
    body: [
      "Der Innenraum ist das Erste, das man merkt. Deshalb lösen wir den Schmutz, statt ihn zu überdecken.",
      "Bei Gerüchen zuerst die Ursache. Bleibt etwas, kommt Ozon dazu – das zerlegt Moleküle und parfümiert nichts.",
    ],
    steps: [
      {
        title: "Material",
        text: "Leder, Stoff, Alcantara, Kunststoff – jedes bekommt das, was es verträgt.",
      },
      {
        title: "Lösen",
        text: "Fußräume, Sitze, Fugen. Nicht nass wischen und für sauber erklären.",
      },
      {
        title: "Pflegen",
        text: "Kunststoff und Leder danach behandeln, damit es nicht sofort wieder stumpf wird.",
      },
      {
        title: "Geruch",
        text: "Nur wenn nötig. Erst trocken und sauber, dann Ozon – kein Spray.",
      },
    ],
  },
  {
    slug: "lackkorrektur",
    title: "Lackkorrektur",
    nav: "Lackatelier",
    metaTitle: "Lackkorrektur & Politur Horb | White Gloss",
    description:
      "Lackkorrektur in Horb: Swirls und Waschkratzer rausarbeiten, Farbe und Glanz zurückholen – ohne unnötig Lack abzutragen.",
    teaser: "So viel Politur wie nötig. Den Rest lassen wir.",
    group: "atelier",
    fromPrice: 349,
    image: "/media/lack.webp",
    imageAlt: "Poliermaschine auf dem Lack",
    bullets: [
      "Swirls und Waschkratzer, soweit der Klarlack das hergibt",
      "Mehr Tiefe, gleichmäßigere Spiegelung",
      "So viel Politur wie nötig, nicht pauschal über alles",
      "Die Grundlage für Wachs oder Keramik – nicht die Werbung dafür",
    ],
    body: [
      "Nicht jeder Kratzer geht weg. Deshalb sagen wir vorher, was geht – bevor unnötig Lack abgetragen wird.",
      "Eine Stufe Politur steckt in Signature. Mehrstufig gehört zur Keramik, wenn der Lack das trägt.",
    ],
    steps: [
      {
        title: "Licht und Stärke",
        text: "Unter Werkstattlicht und mit Messung. Was der Klarlack noch hergibt, sagen wir vorher.",
      },
      {
        title: "Dekontamination",
        text: "Beläge runter, bevor die Maschine den Lack berührt.",
      },
      {
        title: "Politur",
        text: "Eine Stufe oder mehrere. Nur so weit, bis das Bild stimmt.",
      },
      {
        title: "Schutz",
        text: "Wachs in Signature. Keramik nur, wenn das Auto danach bleibt.",
      },
    ],
  },
  {
    slug: "keramikversiegelung",
    title: "Keramikversiegelung",
    nav: "Ceramic Gloss",
    metaTitle: "Keramikversiegelung Auto Horb | White Gloss",
    description:
      "Keramikversiegelung in Horb am Neckar ab 899 €: erst Lackkorrektur, dann die Schicht. Standzeit laut Produkt, keine pauschalen Werbejahre.",
    teaser: "Erst Korrektur, dann die Schicht. Standzeit laut Produkt.",
    group: "atelier",
    fromPrice: 899,
    image: "/media/keramik.webp",
    imageAlt: "Keramikversiegelung wird von Hand auf den Lack aufgetragen",
    bullets: [
      "Wasser perlt, das Auto bleibt länger sauber",
      "Glanz, weil der Lack vorher wirklich vorbereitet wird",
      "Schutz vor Vogelkot, Insekten und Alltagsbelastung",
      "Standzeit laut Produkt und Pflege, kein Jahresversprechen",
    ],
    body: [
      "Ob Keramik hält, entscheidet die Vorbereitung. Erst wenn der Lack sauber und gleichmäßig ist, kommt die Schicht drauf – in der Werkstatt, nicht an der Straße.",
      "Wir sagen vorher, welches Produkt wir nehmen und was es leistet. Pauschale fünf Jahre verkaufen wir nicht. Keramik ist nicht kratzfest. Sieben Tage nicht waschen; Regen in dieser Zeit ist kein Problem.",
      "Planen Sie rund zwei Tage ein. Glas, Felgen und Abholung bis 60 km sind im Paket.",
    ],
    steps: [
      {
        title: "Vorreinigung",
        text: "Lack, Felgen und die kniffligen Stellen werden komplett sauber und von Belägen befreit, bevor irgendetwas beschichtet wird.",
      },
      {
        title: "Lack vorbereiten",
        text: "Je nach Zustand polieren wir, und danach entfetten wir rückstandsfrei, damit die Keramik wirklich hält.",
      },
      {
        title: "Keramik auftragen",
        text: "Die Schicht kommt kontrolliert drauf. Wir prüfen, ob sie gleichmäßig ablüftet, bevor es weitergeht.",
      },
      {
        title: "Aushärten",
        text: "Das Auto bleibt geschützt, bis die Keramik steht. Dann schauen wir noch einmal drüber und übergeben.",
      },
    ],
  },
  {
    slug: "lederpflege",
    title: "Lederpflege",
    nav: "Lederatelier",
    metaTitle: "Auto-Lederpflege Horb am Neckar | White Gloss",
    description:
      "Lederreinigung und Lederpflege fürs Auto in Horb: Verschmutzungen lösen, Glanzstellen reduzieren, Flächen schützen.",
    teaser: "Reinigen, dann pflegen. Keine aggressive Chemie.",
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
      "Lederatelier (ab 149 €) geht tiefer in Imprägnierung und Schutz – entweder als Extra oder im Paket Keramik.",
    ],
  },
  {
    slug: "smart-repair",
    title: "Dellenentfernung & Smart Repair",
    nav: "Paintless Finish",
    metaTitle: "Dellenentfernung & Hagelschaden Horb | White Gloss",
    description:
      "Parkdellen, Karosseriedellen und Hagelschäden lackschadenfrei ausbeulen – sofern technisch möglich. Preis nach Begutachtung.",
    teaser: "Dellen raus, wenn es hält. Sonst sagen wir nein.",
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
      "Parkdellen, kleinere Dellen und Hagelschäden holen wir lackschadenfrei raus, wenn es technisch geht – also ohne gleich die ganze Fläche zu lackieren.",
      "Einen Preis und eine Zusage gibt es erst, wenn wir den Schaden gesehen haben und Sie zustimmen. Bei kleinen Stellen reicht oft ein Foto zur ersten Einschätzung.",
    ],
  },
  {
    slug: "leasingrueckgabe",
    title: "Leasingrückläufer-Aufbereitung",
    nav: "Leasing Gloss",
    metaTitle: "Leasingrückgabe-Aufbereitung Horb | White Gloss",
    description:
      "Aufbereitung vor der Leasingrückgabe in Horb: Innenreinigung, Lackpflege, punktuelle Nacharbeit – ehrlich priorisiert.",
    teaser: "Was der Gutachter sieht – nicht das Instagram-Ideal.",
    group: "finish",
    fromPrice: 349,
    image: "/media/hero.webp",
    imageAlt: "Atelierfahrzeug von White Gloss in Horb, vor der Übergabe",
    bullets: [
      "Zuerst die Stellen, die bei der Rückgabe auffallen",
      "Innenraum, Lackpflege und punktuelle Nacharbeit",
      "Wir sagen vorher, was bleibt",
      "Termin, der vor dem Rückgabedatum sitzt",
    ],
    body: [
      "Wir arbeiten das ab, was Gutachter bei der Rückgabe wirklich sehen – nicht an einem Showroom-Ideal vorbei. Das spart Geld und unnötige Positionen.",
      "Autohäuser und Flotten rechnen wir im B2B, ohne Pauschalpreis, passend zu Anzahl und Zustand.",
    ],
  },
  {
    slug: "lederreparatur",
    title: "Lederreparatur im Auto",
    nav: "Lederrestauration",
    metaTitle: "Lederreparatur Auto Horb – Brandloch, Riss, Loch | White Gloss",
    description:
      "Lederreparatur in Horb am Neckar: Brandlöcher, Risse, kleine Löcher. Nur wenn es wirklich haltbar ist – sonst sagen wir ehrlich nein.",
    teaser: "Brandloch und Riss, nur wenn die Stelle trägt.",
    group: "finish",
    fromPrice: 119,
    image: "/media/leder.webp",
    imageAlt: "Ledersitz nach der Pflege in der Werkstatt Horb",
    bullets: [
      "Brandlöcher, kleine Löcher, Risse und offene Nähte",
      "Nur wenn das Leder die Reparatur trägt – sonst keine Arbeit",
      "Farbe so nah wie möglich, kein Versprechen auf unsichtbar",
      "Fotos zuerst, Preis erst nach Prüfung am Auto",
    ],
    honestNote:
      "Wir machen die Reparatur nur, wenn sie hält. Ist das Leder zu dünn, rissig in der Fläche oder das Loch zu groß, sagen wir das vorher. Dann zahlen Sie nichts für einen Versuch, der hinterher nicht passt.",
    priceRows: [
      { name: "Brandloch / kleines Loch", price: 139, note: "eine Stelle, nach Prüfung" },
      { name: "Riss oder offene Naht", price: 159, note: "eine Stelle, nach Prüfung" },
      { name: "Lenkrad-Leder", price: 179, note: "Abrieb, kleine Risse" },
      { name: "Farbauffrischung Sitzfläche", price: 189, note: "wenn das Leder noch fest ist" },
      { name: "Brandloch Textil / Himmel", price: 119, note: "nur bei tragfähigem Gewebe" },
    ],
    body: [
      "Ein Brandloch oder ein Riss im Ledersitz sieht schnell nach teurem Neubezug aus. Oft geht eine punktuelle Reparatur – aber nicht immer. Genau das prüfen wir, bevor jemand Geld ausgibt.",
      "Wir schauen auf Material, Dicke, Kanten und ob die Stelle belastet wird. Sitzwange und Einstieg halten weniger als eine Fläche, auf der niemand sitzt. Wenn die Reparatur nach ein paar Wochen wieder aufgeht, lassen wir sie.",
      "Farbe mischen wir an. Bei älterem, ausgebleichtem Leder bleibt ein feiner Unterschied sichtbar. Das sagen wir vorher. Wer eine unsichtbare Stelle will, braucht oft einen Sattler und einen Neubezug – das ist nicht unser Job.",
      "Schicken Sie Fotos bei Tageslicht, ohne Blitz. Wenn es machbar wirkt, schauen wir das Auto in Horb an und nennen den Preis. Abholung aus 13 Städten ist möglich.",
    ],
    steps: [
      {
        title: "Fotos",
        text: "Stelle, Abstand und Umgebung. Wir sagen schon da, ob sich der Weg lohnt.",
      },
      {
        title: "Prüfung am Auto",
        text: "Material, Größe, Belastung. Erst dann ein fester Preis – oder ein klares Nein.",
      },
      {
        title: "Reparatur",
        text: "Nur den Umfang, den wir zugesagt haben. Trocknen lassen, Kontrolle, Abgabe.",
      },
    ],
  },
  {
    slug: "geruchsneutralisation",
    title: "Geruchsneutralisation mit Ozon",
    nav: "Air Pure",
    metaTitle: "Geruchsneutralisation Auto Ozon Horb | White Gloss",
    description:
      "Ozonbehandlung gegen Nikotin, Tier- und Feuchtigkeitsgeruch in Horb am Neckar ab 99 €. Erst Ursache, dann Ozon – kein Duftspray.",
    teaser: "Erst Ursache, dann Ozon. Kein Spray.",
    group: "finish",
    fromPrice: 99,
    image: "/media/atelier.webp",
    imageAlt: "Werkstattinnenraum von White Gloss in Horb",
    bullets: [
      "Zuerst die Ursache: Schmutz, Nässe, Filter, Polster",
      "Ozon zerlegt Geruchsmoleküle, parfümiert nichts",
      "Nikotin, Tier, Feuchtigkeit – oft in Kombination mit Innenraumreinigung",
      "Ab 99 €, bei starker Belastung nach Absprache",
    ],
    body: [
      "Duftspray überdeckt. Ozon arbeitet anders: es spaltet die Moleküle, die den Geruch machen. Vorher muss der Innenraum aber sauber und trocken sein, sonst kommt der Geruch zurück.",
      "Starker Nikotin- oder Schimmelgeruch braucht oft Innenraumreinigung plus Ozon, manchmal zwei Durchgänge. Das sagen wir, bevor wir starten – nicht hinterher als Überraschung.",
    ],
  },
  {
    slug: "scheinwerferaufbereitung",
    title: "Scheinwerferaufbereitung",
    nav: "Lichtklar",
    metaTitle: "Scheinwerfer aufbereiten Horb am Neckar | White Gloss",
    description:
      "Vergilbte Scheinwerfer aufbereiten in Horb: Politur und UV-Schutz, ab 99 € das Paar. Sicht und Optik, ohne gleich neue Streuscheiben.",
    teaser: "Klar und UV-geschützt. Oder wir lassen die Politur.",
    group: "finish",
    fromPrice: 99,
    image: "/media/finish.webp",
    imageAlt: "Lack und Licht unter Prüflicht nach der Aufbereitung",
    bullets: [
      "Matte, gelbe Streuscheiben wieder klar",
      "UV-Schutz, damit es nicht in drei Monaten zurückkommt",
      "Paarpreis ab 99 €, inkl. MwSt.",
      "Wenn der Kunststoff durch ist, sagen wir das – dann hilft nur tauschen",
    ],
    honestNote:
      "Ist die Streuscheibe rissig oder der Kunststoff zu weit, polieren wir nicht. Eine Politur, die zwei Wochen hält, machen wir nicht.",
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
    a: "Bei White Gloss beginnt die Keramikversiegelung im Paket Keramik ab 899 Euro. Der endgültige Preis hängt von der Fahrzeugklasse und vom Zustand des Lacks ab. Den verbindlichen Preis nennen wir Ihnen, nachdem wir das Fahrzeug gesehen haben.",
  },
  {
    group: "Dauer",
    q: "Wie lange dauert eine Keramikversiegelung?",
    a: "Rechnen Sie mit rund zwei Tagen. Der größere Teil entfällt auf Reinigung, Dekontamination und Lackkorrektur. Anschließend muss die Keramik geschützt aushärten.",
  },
  {
    group: "Dauer",
    q: "Wie lange dauert eine komplette Fahrzeugaufbereitung?",
    a: "Pur etwa drei Stunden, Signature rund sechs Stunden, Keramik etwa zwei Tage. Bei starker Verschmutzung oder Gerüchen kann mehr Zeit nötig sein.",
  },
  {
    group: "Keramikversiegelung",
    q: "Was ist der Unterschied zwischen Wachs, Versiegelung und Keramik?",
    a: "Wachs hält je nach Nutzung einige Monate. Eine Sprühversiegelung ist dünner. Keramik verbindet sich mit dem Klarlack und hält länger – wenn der Lack vorbereitet ist und danach gepflegt wird.",
  },
  {
    group: "Keramikversiegelung",
    q: "Wie lange hält die Keramikversiegelung?",
    a: "So lange, wie Produkt und Pflege hergeben. Pauschale fünf Jahre verkaufen wir nicht. Vorher sagen wir, welches System wir nehmen und was es realistisch leistet. Mit Bürstenanlage wird jede Schicht früher stumpf.",
  },
  {
    group: "Keramikversiegelung",
    q: "Darf ich mit einer Keramikversiegelung in die Waschanlage?",
    a: "Technisch ja, sinnvoll nur bedingt. Bürstenanlagen erzeugen feine Kratzer. Wir empfehlen Handwäsche mit pH-neutralem Shampoo. Wenn es schnell gehen muss: berührungslose Anlage.",
  },
  {
    group: "Keramikversiegelung",
    q: "Kann ich mein Auto nach der Versiegelung sofort waschen?",
    a: "Nein. In den ersten etwa sieben Tagen sollte das Fahrzeug nicht gewaschen werden. Regen schadet in dieser Zeit nicht.",
  },
  {
    group: "Keramikversiegelung",
    q: "Lohnt sich eine Keramikversiegelung auch bei einem Gebrauchtwagen?",
    a: "Oft mehr als beim Neuwagen, weil der Unterschied deutlicher ist. Voraussetzung ist ein Lack, der die Vorbereitung noch trägt. Wir prüfen die Lackstärke vorab.",
  },
  {
    group: "Keramikversiegelung",
    q: "Ist eine Keramikversiegelung kratzfest?",
    a: "Nein. Sie erleichtert die Pflege und schützt vor vielen Umwelteinflüssen, macht den Lack aber nicht unempfindlich gegen mechanische Kratzer oder Steinschläge.",
  },
  {
    group: "Innenraumreinigung",
    q: "Bekommen Sie Gerüche aus dem Innenraum wieder heraus?",
    a: "In den meisten Fällen ja. Zuerst wird die Ursache beseitigt. Bleibt etwas zurück, hilft eine Ozonbehandlung für 99 Euro zusätzlich.",
  },
  {
    group: "Lederreparatur",
    q: "Reparieren Sie Brandlöcher und Risse im Leder?",
    a: "Ja, wenn das Material die Reparatur trägt. Brandlöcher, kleine Löcher, Risse und offene Nähte ab 139 Euro die Stelle. Ist das Leder zu dünn, flächig rissig oder das Loch zu groß, machen wir die Arbeit nicht – dann zahlen Sie auch nichts für einen Versuch.",
  },
  {
    group: "Lederreparatur",
    q: "Wird die Stelle hinterher unsichtbar?",
    a: "Nah dran, selten unsichtbar. Wir mischen die Farbe an. Bei älterem, ausgebleichtem Leder bleibt ein feiner Unterschied. Das sagen wir vorher. Wer eine neue Sitzfläche will, braucht einen Sattler.",
  },
  {
    group: "Abholservice",
    q: "Holen Sie mein Fahrzeug ab?",
    a: `Ja. Ausgeführt wird immer in unserer Werkstatt in Horb am Neckar. ${pickupTierSummary()}. ${pickupKeramikNote()}.`,
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
    title: "Anschauen",
    text: "Zuerst sitzen wir kurz zusammen, schauen uns Lack und Innenraum in Ruhe an und hören, was Sie sich wünschen. Erst danach sagen wir, was wirklich Sinn macht.",
  },
  {
    n: "02.",
    title: "Vorbereiten",
    text: "Dann wird gründlich gereinigt, und alles, was empfindlich ist, wird geschützt – damit hinterher nichts leidet, was nicht leiden soll.",
  },
  {
    n: "03.",
    title: "Arbeiten",
    text: "Wir machen genau den Umfang, den wir besprochen haben. Nichts aufblasen, nichts weglassen.",
  },
  {
    n: "04.",
    title: "Abgeben",
    text: "Zum Schluss prüfen wir unter Licht. Sie sehen das Ergebnis, und das Auto geht sauber raus.",
  },
];

export const nav = [
  { to: "/leistungen", label: "Leistungen" },
  { to: "/luxusfahrzeuge", label: "Luxusfahrzeuge" },
  { to: "/preise", label: "Preise & Pakete" },
  { to: "/qualitaet", label: "Qualitätsanspruch" },
  { to: "/abholservice", label: "Hol- & Bringservice" },
  { to: "/", label: "Individuelles Angebot", hash: "buchung" },
  { to: "/ratgeber", label: "Ratgeber" },
  { to: "/faq", label: "Häufige Fragen" },
  { to: "/galerie", label: "Werkstatt" },
  { to: "/kontakt", label: "Kontakt" },
  { to: "/b2b", label: "B2B" },
] as const;

export const sheetPrimary = [
  { to: "/preise", label: "Preise & Pakete" },
  { to: "/qualitaet", label: "Qualitätsanspruch" },
  { to: "/abholservice", label: "Hol- & Bringservice" },
] as const;

export const sheetSecondary = [
  { to: "/ratgeber", label: "Ratgeber" },
  { to: "/faq", label: "Häufige Fragen" },
  { to: "/galerie", label: "Werkstatt" },
  { to: "/kontakt", label: "Kontakt" },
  { to: "/b2b", label: "B2B & Flottenkunden" },
] as const;

export const footerExplore = [
  { to: "/abholservice", label: "Abholservice" },
  { to: "/ratgeber", label: "Ratgeber" },
  { to: "/galerie", label: "Werkstatt" },
  { to: "/kontakt", label: "Kontakt" },
  { to: "/faq", label: "FAQ" },
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
