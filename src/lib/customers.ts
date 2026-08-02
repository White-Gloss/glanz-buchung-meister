import type { Booking } from "./bookings";

/**
 * KUNDENAKTEN – ABGELEITET, NICHT DUPLIZIERT
 * --------------------------------------------
 * Es gibt bewusst keine eigene Kundentabelle. Ein "Kunde" ist hier eine
 * Zusammenfassung aller Buchungen mit derselben (normalisierten) E-Mail-
 * Adresse. Vorteile gegenüber einer separaten Tabelle:
 *   - keine zwei Datensätze, die auseinanderlaufen können
 *   - eine Buchung löschen entfernt automatisch den Kundenbezug mit,
 *     ohne dass an zweiter Stelle nachgeräumt werden muss (relevant für
 *     DSGVO-Löschanfragen)
 *   - kein Migrationsaufwand, keine neue Tabelle mit RLS-Policies
 *
 * Wer nie gebucht hat, taucht hier folgerichtig nicht auf – das ist bei
 * einer Werkstatt mit Buchungspflicht kein praktischer Nachteil.
 */

export type CustomerSummary = {
  /** normalisierte E-Mail, dient als stabile ID */
  email: string;
  name: string;
  phone: string;
  plates: string[];
  bookingCount: number;
  totalRevenue: number;
  firstBookingDate: string;
  lastBookingDate: string;
  lastPackageId: string;
  bookings: Booking[];
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase();
}

/**
 * Fasst Buchungen zu Kunden zusammen. Stornierte Buchungen zählen für
 * `bookingCount`/`totalRevenue` nicht mit, tauchen aber in der Historie
 * auf – ein stornierter Termin ist trotzdem ein Kundenkontakt.
 */
export function deriveCustomers(bookings: Booking[]): CustomerSummary[] {
  const byEmail = new Map<string, Booking[]>();

  for (const booking of bookings) {
    const key = normalizeEmail(booking.customer.email);
    const list = byEmail.get(key) ?? [];
    list.push(booking);
    byEmail.set(key, list);
  }

  const customers: CustomerSummary[] = [];
  for (const [email, group] of byEmail) {
    const sorted = [...group].sort((a, b) => (a.date < b.date ? -1 : 1));
    const active = sorted.filter((b) => b.status !== "Storniert");
    const latest = sorted[sorted.length - 1];
    const plates = Array.from(new Set(group.map((b) => normalizePlate(b.customer.plate))));

    customers.push({
      email,
      name: latest.customer.name,
      phone: latest.customer.phone,
      plates,
      bookingCount: active.length,
      totalRevenue: active.reduce((sum, b) => sum + b.total, 0),
      firstBookingDate: sorted[0].date,
      lastBookingDate: latest.date,
      lastPackageId: latest.packageId,
      bookings: sorted,
    });
  }

  // Zuletzt aktive Kunden zuerst – die für den Alltag relevanteste Sortierung.
  return customers.sort((a, b) => (a.lastBookingDate < b.lastBookingDate ? 1 : -1));
}

/** Anzahl Tage seit der letzten Buchung – Grundlage für Wiedervorlage-Hinweise. */
export function daysSinceLastBooking(customer: CustomerSummary): number {
  const last = new Date(customer.lastBookingDate);
  const now = new Date();
  return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}
