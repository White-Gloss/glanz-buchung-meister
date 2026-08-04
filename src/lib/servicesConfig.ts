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
  /** true = Preis ergibt sich aus der Entfernungsstaffel, nicht aus `price` */
  distanceBased?: boolean;
};

export const company = {
  name: "White Gloss Detailing",
  claim: "No Compromises. Only Results.",
  /**
   * Erst auf true setzen, wenn Inhaber, Anschrift, Steuerstatus und Bankdaten
   * geprüft wurden. Bis dahin bleiben Rechnungsdownloads gesperrt.
   */
  legalDetailsVerified: false,
  owner: "Lars Hägele",
  street: "Arnistal 27",
  city: "72160 Horb-Dettingen",
  country: "Deutschland",
  phone: "0152 33540284",
  phoneHref: "tel:+4915233540284",
  whatsappHref: "https://wa.me/4915233540284",
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

/**
 * Pflichtangabe nach Preisangabenverordnung (PAngV): Bei Angeboten gegenüber
 * Verbrauchern muss erkennbar sein, dass der Preis die Umsatzsteuer enthält.
 * Bei Kleinunternehmerregelung (`smallBusiness: true`) tritt der Hinweis nach
 * § 19 UStG an diese Stelle.
 */
export function vatNotice(): string {
  return taxConfig.smallBusiness
    ? taxConfig.smallBusinessNote
    : `Alle Preise sind Endpreise inkl. ${(taxConfig.vatRate * 100).toLocaleString("de-DE")} % MwSt.`;
}

/** Kurzform direkt unter einer Preisangabe. */
export function vatNoticeShort(): string {
  return taxConfig.smallBusiness
    ? "keine MwSt. (§ 19 UStG)"
    : `inkl. ${(taxConfig.vatRate * 100).toLocaleString("de-DE")} % MwSt.`;
}

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
      "Gründliches Aussaugen & Entstauben des Innenraums",
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
      "Einstufige Lackpolitur (Glanzaufbau)",
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
    description:
      "Abholung und Rückgabe – Preis nach Entfernungsstaffel, bei High-End Keramik inklusive",
    price: 0,
    flatPrice: true,
    distanceBased: true,
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
    text: "Mehrstufige Politur reduziert Swirls, Waschkratzer und Hologramme gezielt.",
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
/* Abholservice – Entfernungsstaffel (zentrale Preisauskunft)          */
/* ------------------------------------------------------------------ */

export type PickupTier = {
  /** Interne ID – entspricht `service_prices.item_id` mit item_type = "pickup" */
  id: string;
  /** Obergrenze der Entfernung in km (einschließlich) */
  maxKm: number;
  /** Bruttopreis in EUR */
  amount: number;
  label: string;
};

/**
 * Staffelpreise für den Hol- & Bringservice. Einzige Quelle für Website,
 * Buchungstool und Rechnung. Die Werte lassen sich im Admin-Bereich
 * überschreiben (Tabelle `service_prices`, item_type = "pickup").
 */
export const pickupPricing = {
  tiers: [
    { id: "tier_10", maxKm: 10, amount: 0, label: "Abholung bis 10 km" },
    { id: "tier_20", maxKm: 20, amount: 50, label: "Abholung bis 20 km" },
    { id: "tier_50", maxKm: 50, amount: 70, label: "Abholung bis 50 km" },
  ] as PickupTier[],
  /** Oberhalb dieser Entfernung erfolgt die Abholung nur auf Anfrage. */
  maxKm: 50,
  /** Im genannten Paket ist die Abholung bis `freeUpToKm` kostenfrei. */
  freeWithPackageId: "keramik",
  freeUpToKm: 60,
};

/** true, wenn die Abholung im gewählten Paket kostenfrei enthalten ist. */
export function isPickupIncluded(packageId: string | null | undefined, distanceKm: number) {
  return packageId === pickupPricing.freeWithPackageId && distanceKm <= pickupPricing.freeUpToKm;
}

/**
 * Preis der Abholung für eine Entfernung.
 * `null` bedeutet: außerhalb der Staffel, nur auf Anfrage.
 */
export function getPickupPrice(distanceKm: number): number | null {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return null;
  const tier = pickupPricing.tiers.find((t) => distanceKm <= t.maxKm);
  return tier ? tier.amount : null;
}

/** Preisangabe für eine konkrete Entfernung, z. B. „kostenlos“ oder „50,00 €“. */
export function pickupPriceText(distanceKm: number): string {
  const price = getPickupPrice(distanceKm);
  if (price === null) return "auf Anfrage";
  if (price === 0) return "kostenlos";
  return currency(price);
}

/** Kurzform der gesamten Staffel für Überschriften und Badges. */
export function pickupPriceRangeText(): string {
  const paid = pickupPricing.tiers.filter((t) => t.amount > 0);
  if (paid.length === 0) return "kostenlos";
  const max = Math.max(...paid.map((t) => t.amount));
  return `kostenlos bis ${currency(max)}`;
}

/** Vollständige Staffel als Aufzählung, z. B. für Info-Karten und FAQ. */
export function pickupTierSummary(): string {
  const parts = pickupPricing.tiers.map((tier) =>
    tier.amount === 0
      ? `bis ${tier.maxKm} km kostenlos`
      : `bis ${tier.maxKm} km ${currency(tier.amount)}`,
  );
  return `${parts.join(", ")}, über ${pickupPricing.maxKm} km auf Anfrage`;
}

/** Vollständiger Hinweis für Fließtext und Karten. */
export function pickupPriceNote(): string {
  return `Hol- & Bringservice nach Entfernung: ${pickupTierSummary()}. Im Paket High-End Keramik bis ${pickupPricing.freeUpToKm} km inklusive.`;
}

/* ------------------------------------------------------------------ */
/* Preis-Overrides aus der Datenbank (Admin-Panel)                     */
/* ------------------------------------------------------------------ */

export type ServicePriceRow = {
  item_type: "package" | "addon" | "vehicle" | "pickup";
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
    } else if (row.item_type === "pickup") {
      const tier = pickupPricing.tiers.find((t) => t.id === row.item_id);
      if (tier && row.amount >= 0) tier.amount = row.amount;
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
    ...addOns
      .filter((a) => !a.distanceBased)
      .map((a) => ({
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
    ...pickupPricing.tiers.map((t) => ({
      item_type: "pickup" as const,
      item_id: t.id,
      label: t.label,
      amount: t.amount,
    })),
  ];
}
