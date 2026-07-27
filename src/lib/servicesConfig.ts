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
};

export const company = {
  name: "White Gloss Detailing",
  claim: "No Compromises. Only Results.",
  owner: "Max Mustermann",
  street: "Musterstraße 12",
  city: "53111 Bonn",
  country: "Deutschland",
  phone: "+49 176 12345678",
  email: "info@whitegloss.de",
  web: "www.whiteglossdetailing.de",
  instagram: "@whiteglossdetailing",
  taxId: "DE123456789", // USt-IdNr.
  taxNumber: "205/5001/0123", // Steuernummer
  bank: {
    holder: "White Gloss Detailing",
    iban: "DE02 3705 0198 0000 1234 56",
    bic: "COLSDE33XXX",
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
    name: "Hol- & Bringservice",
    description: "Abholung und Rückgabe im Umkreis von 25 km",
    price: 49,
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
    name: "Innenreinigung",
    text: "Tiefenreinigung von Textilien, Kunststoff und Verkleidungen – bis in jede Fuge.",
  },
  {
    id: "lack",
    name: "Lackkorrektur",
    text: "Mehrstufige Politur entfernt Swirls, Kratzer und Hologramme dauerhaft.",
  },
  {
    id: "keramik",
    name: "Keramikversiegelung",
    text: "Härtender Schutzfilm für extremen Glanz und jahrelangen Abperleffekt.",
  },
  {
    id: "leder",
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
