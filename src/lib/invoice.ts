import type { Booking } from "./bookings";
import { servicePackages, vehicleTypes } from "./servicesConfig";

/**
 * Der frühere lokale Rechnungs-PDF-Generator ist absichtlich deaktiviert.
 *
 * Eine offizielle Endrechnung darf bei White Gloss erst nach dem ausgeführten
 * Termin entstehen und wird künftig ausschließlich über den kontrollierten
 * Lexware-Ablauf erzeugt. Vor dem Termin gibt es nur Auftrags-/Terminunterlagen
 * und gegebenenfalls eine getrennte Anzahlung.
 */
export async function generateInvoicePdf(_booking: Booking): Promise<void> {
  window.alert(
    "Der alte Rechnungsdownload ist deaktiviert. Vor dem Termin bitte „Unterlagen & Preis“ verwenden. Die offizielle Endrechnung wird erst nach dem Termin über den Abrechnungsablauf erstellt.",
  );
}

export function bookingSummary(booking: Booking) {
  const vehicle = vehicleTypes.find((v) => v.id === booking.vehicleId);
  const pkg = servicePackages.find((p) => p.id === booking.packageId);
  return { vehicle, pkg };
}
