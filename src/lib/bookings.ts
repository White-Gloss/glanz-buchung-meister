import {
  addOns,
  currency,
  depositConfig,
  servicePackages,
  taxConfig,
  vehicleTypes,
  type AddOn,
} from "./servicesConfig";

export type BookingStatus = "Angefragt" | "Bestätigt" | "Ausstehend" | "Bezahlt" | "Storniert";

export const bookingStatuses: BookingStatus[] = [
  "Angefragt",
  "Bestätigt",
  "Ausstehend",
  "Bezahlt",
  "Storniert",
];

export type DepositStatus = "nicht_erforderlich" | "offen" | "bezahlt";

export type Booking = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  vehicleId: string;
  packageId: string;
  addOnIds: string[];
  date: string; // ISO yyyy-mm-dd
  time: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    plate: string;
  };
  total: number;
  status: BookingStatus;
  isNewCustomer: boolean;
  depositAmount: number;
  depositStatus: DepositStatus;
  accessToken: string;
};

export type LineItem = { label: string; qty: number; unit: number; total: number };

export function calcLineItems(input: {
  vehicleId: string;
  packageId: string;
  addOnIds: string[];
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
