import {
  addOns,
  currency,
  servicePackages,
  taxConfig,
  vehicleTypes,
  type AddOn,
} from "./servicesConfig";

export type BookingStatus = "Ausstehend" | "Bezahlt" | "Storniert";

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
};

export type LineItem = { label: string; qty: number; unit: number; total: number };

const STORAGE_KEY = "wgd.bookings.v1";

export function loadBookings(): Booking[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Booking[]) : [];
  } catch {
    return [];
  }
}

export function saveBookings(bookings: Booking[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
}

export function nextInvoiceNumber(existing: Booking[]) {
  const num = taxConfig.invoiceStartNumber + existing.length;
  return `${taxConfig.invoicePrefix}${num}`;
}

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
    const price = Math.round(add.price * factor);
    items.push({ label: add.name, qty: 1, unit: price, total: price });
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

export { currency };
