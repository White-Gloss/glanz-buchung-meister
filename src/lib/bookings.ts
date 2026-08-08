import {
  addOns,
  currency,
  depositConfig,
  getPickupPrice,
  isPickupIncluded,
  servicePackages,
  taxConfig,
  vehicleTypes,
  type AddOn,
} from "./servicesConfig";
import { getPickupDistanceKm } from "./pickupLocations";

/**
 * TERMINE SIND DATUMSBASIERT.
 * Es werden bewusst keine Uhrzeiten erhoben oder angezeigt — die genaue
 * Zeit für Bringung und Abholung wird wenige Tage vor dem Termin
 * persönlich abgestimmt. Dieser Hinweis gehört in jede Kunden-Mail.
 */
export const TIME_NOTICE =
  "Die genaue Uhrzeit für die Bringung/Abholung stimmen wir wenige Tage vor Ihrem Termin individuell mit Ihnen ab.";

/** Höchstzahl aktiver Buchungen pro Kalendertag – identisch zur Datenbankregel. */
export const MAX_BOOKINGS_PER_DAY = 3;

export type BookingStatus =
  | "Wartend auf Prüfung"
  | "Gegenangebot gesendet"
  | "Bestätigt"
  | "Ausstehend"
  | "Bezahlt"
  | "Storniert";

export const bookingStatuses: BookingStatus[] = [
  "Wartend auf Prüfung",
  "Gegenangebot gesendet",
  "Bestätigt",
  "Ausstehend",
  "Bezahlt",
  "Storniert",
];

/** Bevorzugter Weg für die Uhrzeit-Absprache. */
export const contactChannels = ["WhatsApp", "Telefon", "E-Mail"] as const;
export type ContactChannel = (typeof contactChannels)[number];

export type DepositStatus = "nicht_erforderlich" | "offen" | "bezahlt";

export type Booking = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  vehicleId: string;
  packageId: string;
  addOnIds: string[];
  date: string; // ISO yyyy-mm-dd
  /**
   * Nur noch für Altbuchungen gefüllt. Neue Termine sind rein
   * datumsbasiert; die Uhrzeit wird persönlich abgestimmt.
   */
  time: string | null;
  /** Slug der Abholstadt – nur gesetzt, wenn der Hol- & Bringservice gebucht wurde */
  pickupCity: string | null;
  customer: {
    name: string;
    email: string;
    phone: string;
    plate: string;
  };
  /** Bevorzugter Kontaktweg für die Uhrzeit-Absprache */
  preferredContact: ContactChannel;
  total: number;
  /** Abweichender Preis aus einem Gegenangebot; null = Standardpreis gilt */
  agreedPrice: number | null;
  /** Begründung des Gegenangebots, z. B. Mehraufwand laut Fotos */
  offerNote: string | null;
  /** Bis zu drei Ersatztermine, die dem Kunden angeboten wurden */
  offerAltDates: string[];
  status: BookingStatus;
  isNewCustomer: boolean;
  depositAmount: number;
  depositStatus: DepositStatus;
  accessToken: string;
};

/** Der tatsächlich gültige Preis: Gegenangebot schlägt Standardpreis. */
export function effectivePrice(booking: Pick<Booking, "total" | "agreedPrice">): number {
  return booking.agreedPrice ?? booking.total;
}

export type LineItem = { label: string; qty: number; unit: number; total: number };

export function calcLineItems(input: {
  vehicleId: string;
  packageId: string;
  addOnIds: string[];
  pickupCity?: string | null;
}): LineItem[] {
  const vehicle = vehicleTypes.find((v) => v.id === input.vehicleId);
  const pkg = servicePackages.find((p) => p.id === input.packageId);
  const items: LineItem[] = [];
  const factor = vehicle?.factor ?? 1;

  if (pkg) {
    const price = Math.round(pkg.basePrice * factor);
    items.push({
      label: `${pkg.name} – ${vehicle?.name ?? "Fahrzeug"}`,
      qty: 1,
      unit: price,
      total: price,
    });
  }

  input.addOnIds.forEach((id) => {
    const add: AddOn | undefined = addOns.find((a) => a.id === id);
    if (!add) return;

    // Entfernungsabhängige Leistungen (Abholservice) folgen der Staffel,
    // nicht dem Pauschalpreis aus der Add-on-Liste.
    if (add.distanceBased) {
      const distanceKm = getPickupDistanceKm(input.pickupCity);
      if (distanceKm === null) return;
      if (isPickupIncluded(input.packageId, distanceKm)) {
        items.push({ label: `${add.name} (inklusive)`, qty: 1, unit: 0, total: 0 });
        return;
      }
      const price = getPickupPrice(distanceKm);
      if (price === null) return; // außerhalb der Staffel – nur auf Anfrage
      items.push({
        label: `${add.name} · ${distanceKm} km`,
        qty: 1,
        unit: price,
        total: price,
      });
      return;
    }

    const included = add.includedInPackages?.includes(input.packageId) ?? false;
    const price = included ? 0 : Math.round(add.price * (add.flatPrice ? 1 : factor));
    items.push({
      label: included ? `${add.name} (inklusive)` : add.name,
      qty: 1,
      unit: price,
      total: price,
    });
  });

  return items;
}

export function calcTotals(items: LineItem[]) {
  const gross = items.reduce((sum, i) => sum + i.total, 0);
  if (taxConfig.smallBusiness) {
    return { gross, net: gross, vat: 0 };
  }
  const net = gross / (1 + taxConfig.vatRate);
  return { gross, net, vat: gross - net };
}

/** Anzahlung für Neukunden (Standard: 20 % des Bruttobetrags) */
export function calcDeposit(total: number, isNewCustomer: boolean) {
  if (!isNewCustomer) return 0;
  return Math.round(total * depositConfig.rate * 100) / 100;
}

/** Normalisiert ein Kennzeichen für den Neukunden-Abgleich */
export function normalizePlate(plate: string) {
  return plate.replace(/[\s-]/g, "").toUpperCase();
}

export { currency };
