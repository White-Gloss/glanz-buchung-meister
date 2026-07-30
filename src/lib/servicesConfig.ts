/**
 * ZENTRALE KONFIGURATION
 * ----------------------
 * Hier können Fahrzeugklassen, Pakete, Zusatzleistungen, Zeitfenster und
 * Firmen-/Steuerdaten bequem angepasst oder erweitert werden.
 * Preise verstehen sich als Bruttopreise in EUR.
 */

export type VehicleType = {
  id: string;
  name: string;
  description: string;
  /** Preisfaktor: multipliziert Paket- und Add-on-Preise */
  factor: number;
};

export type ServicePackage = {
  id: string;
  name: string;
  tagline: string;
  basePrice: number;
  duration: string;
  features: string[];
  highlight?: boolean;
};

export type AddOn = {
  id: string;
  name: string;
  description: string;
  price: number;
  /** true = Pauschalpreis ohne Fahrzeug-Faktor */
  flatPrice?: boolean;
  /** Paket-IDs, in denen die Leistung bereits enthalten ist (Preis 0) */
  includedInPackages?: string[];
};

export const company = {
  name: "White Gloss Detailing",
  claim: "No Compromises. Only Results.",
  /**
   * Erst auf true setzen, wenn Inhaber, Anschrift, Steuerstatus und Bankdaten
   * geprüft wurden. Bis dahin bleiben Rechnungsdownloads gesperrt.
   */
  legalDetailsVerified: false,
  owner: "",
  street: "",
  city: "72160 Horb am Neckar",
  country: "Deutschland",
  phone: "",
  email: "info@whitegloss.de",
  web: "https://whitegloss.de",
  instagram: "",
  taxId: "", // USt-IdNr.
  taxNumber: "", // Steuernummer
  bank: {
    holder: "White Gloss Detailing",
    iban: "",
    bic: "",
  },
};

/** Steuer-Einstellungen: bei Kleinunternehmerregelung `smallBusiness` auf true setzen */
export const taxConfig = {
  vatRate: 0.19,
  smallBusiness: false,
  smallBusinessNote:
    "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).",
  paymentTerms: "Zahlbar innerhalb von 14 Tagen ohne Abzug nach Leistungserbringung.",
  invoicePrefix: "WGD-2026-",
  invoiceStartNumber: 1001,
};

/** Anzahlung für Neukunden */
export const depositConfig = {
  /** Anteil des Bruttobetrags, der von Neukunden im Voraus zu zahlen ist */
  rate: 0.2,
  label: "Anzahlung Neukunde (20 %)",
  note: "Bei Erstbuchungen wird eine Anzahlung von 20 % des Gesamtbetrags fällig. Der Restbetrag ist nach Leistungserbringung zu zahlen.",
};

export const vehicleTypes: VehicleType[] = [
  {
    id: "kompakt",
    name: "Kompaktklasse",
    description: "Kleinwagen & Kompakte bis 4,30 m",
    factor: 1,
  },
  {
    id: "suv",
    name: "SUV / Limousine",
    description: "Mittelklasse, Kombi, SUV bis 5,00 m",
    factor: 1.25,
  },
  {
    id: "transporter",
    name: "Transporter",
    description: "Vans & Nutzfahrzeuge ab 5,00 m",
    factor: 1.55,
  },
];

export const servicePackages: ServicePackage[] = [
  {
    id: "basis",
    name: "Basis Pflege",
    tagline: "Der saubere Neustart",
    basePrice: 149,
    duration: "ca. 3 Std.",
    features: [
      "Handwäsche mit pH-neutralem Shampoo",
      "Felgen- & Reifenreinigung",
      "Innenraumsaugen & Staubentfernung",
      "Scheibenreinigung innen & außen",
      "Sprühversiegelung (ca. 3 Monate)",
    ],
  },
  {
    id: "premium",
    name: "Premium Glanz",
    tagline: "Der Bestseller",
    basePrice: 349,
    duration: "ca. 6 Std.",
    highlight: true,
    features: [
      "Alles aus Basis Pflege",
      "Lackknete & Eisenentferner",
      "1-Stufen Lackpolitur (Glanzaufbau)",
      "Tiefenreinigung Innenraum & Textilien",
      "Hochwertiges Wachs (ca. 6 Monate)",
    ],
  },
  {
    id: "keramik",
    name: "High-End Keramik",
    tagline: "Maximaler Schutz",
    basePrice: 899,
    duration: "ca. 2 Tage",
    features: [
      "Alles aus Premium Glanz",
      "Mehrstufige Lackkorrektur",
      "Keramikversiegelung (bis 5 Jahre)",
      "Glas- & Felgenversiegelung",
      "Leder-Konditionierung & Schutz",
      "Hol- & Bringservice inklusive",
    ],
  },
];

export const addOns: AddOn[] = [
  {
    id: "felgen",
    name: "Felgen-Spezial",
    description: "Felgen demontiert, tiefengereinigt & versiegelt",
    price: 89,
  },
  {
    id: "ozon",
    name: "Innenraum-Ozon",
    description: "Geruchsneutralisierung & Desinfektion",
    price: 59,
  },
  {
    id: "motor",
    name: "Motorwäsche",
    description: "Schonende Reinigung & Kunststoffpflege im Motorraum",
    price: 69,
  },
  {
    id: "leder",
    name: "Lederpflege Deluxe",
    description: "Tiefenreinigung & Imprägnierung aller Lederflächen",
    price: 119,
  },
  {
    id: "scheinwerfer",
    name: "Scheinwerfer-Aufbereitung",
    description: "Politur vergilbter Streuscheiben inkl. UV-Schutz",
    price: 79,
  },
  {
    id: "hol",
    name: "Hol- & Bringservice (Abholservice)",
    description: "Abholung und Rückgabe im Umkreis von 25 km – bei High-End Keramik inklusive",
    price: 60,
    flatPrice: true,
    includedInPackages: ["keramik"],
  },
];

/** Verfügbare Zeitfenster pro Tag */
export const timeSlots = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];

/** Beispielhaft belegte Slots (Platzhalterdaten) */
export const blockedSlots: Record<string, string[]> = {
  // "2026-08-03": ["08:00", "10:00"],
};

export const features = [
  {
    id: "innen",
    slug: "innenraumreinigung",
    name: "Innenreinigung",
    text: "Tiefenreinigung von Textilien, Kunststoff und Verkleidungen – bis in jede Fuge.",
  },
  {
    id: "lack",
    slug: "lackkorrektur",
    name: "Lackkorrektur",
    text: "Mehrstufige Politur entfernt Swirls, Kratzer und Hologramme dauerhaft.",
  },
  {
    id: "keramik",
    slug: "keramikversiegelung",
    name: "Keramikversiegelung",
    text: "Härtender Schutzfilm für extremen Glanz und jahrelangen Abperleffekt.",
  },
  {
    id: "leder",
    slug: "lederpflege",
    name: "Lederpflege",
    text: "Schonende Reinigung und Rückfettung für geschmeidige, geschützte Oberflächen.",
  },
];

export function currency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

/* ------------------------------------------------------------------ */
/* Abholservice – zentrale Preisauskunft für alle Seiten               */
/* ------------------------------------------------------------------ */

/** Pauschalpreis des Hol- & Bringservice (unabhängig von der Fahrzeugklasse). */
export function getPickupPrice(): number {
  return addOns.find((a) => a.id === "hol")?.price ?? 60;
}

/** Kurzform, z. B. „60,00 €" */
export function pickupPriceText(): string {
  return currency(getPickupPrice());
}

/** Vollständiger Hinweis für Fließtext und Karten. */
export function pickupPriceNote(): string {
  return `Hol- & Bringservice: ${pickupPriceText()} pauschal – im Paket High-End Keramik inklusive.`;
}

/* ------------------------------------------------------------------ */
/* Preis-Overrides aus der Datenbank (Admin-Panel)                     */
/* ------------------------------------------------------------------ */

export type ServicePriceRow = {
  item_type: "package" | "addon" | "vehicle";
  item_id: string;
  label: string;
  amount: number;
};

/**
 * Überschreibt die oben hinterlegten Standardpreise mit den im Admin-Panel
 * gepflegten Werten. Wird sowohl beim Server-Rendering als auch im Browser
 * aufgerufen, damit überall dieselben Preise gelten.
 */
export function applyPriceOverrides(rows: ServicePriceRow[] | undefined | null) {
  if (!rows?.length) return;
  rows.forEach((row) => {
    if (!Number.isFinite(row.amount)) return;
    if (row.item_type === "package") {
      const pkg = servicePackages.find((p) => p.id === row.item_id);
      if (pkg) pkg.basePrice = row.amount;
    } else if (row.item_type === "addon") {
      const add = addOns.find((a) => a.id === row.item_id);
      if (add) add.price = row.amount;
    } else if (row.item_type === "vehicle") {
      const veh = vehicleTypes.find((v) => v.id === row.item_id);
      if (veh && row.amount > 0) veh.factor = row.amount;
    }
  });
}

/** Aktuelle Preisliste im Format der Datenbank (für das Admin-Panel) */
export function currentPriceRows(): ServicePriceRow[] {
  return [
    ...servicePackages.map((p) => ({
      item_type: "package" as const,
      item_id: p.id,
      label: p.name,
      amount: p.basePrice,
    })),
    ...addOns.map((a) => ({
      item_type: "addon" as const,
      item_id: a.id,
      label: a.name,
      amount: a.price,
    })),
    ...vehicleTypes.map((v) => ({
      item_type: "vehicle" as const,
      item_id: v.id,
      label: `${v.name} (Faktor)`,
      amount: v.factor,
    })),
  ];
}
