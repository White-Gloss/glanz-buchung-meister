import { currency, servicePackages, vehicleTypes } from "./servicesConfig";
import type { Booking } from "./bookings";

/**
 * TEXTE DER SOFORTBENACHRICHTIGUNGEN
 * ======================================
 * Bewusst von den Versandwegen getrennt: Diese Datei enthält nur
 * Zeichenketten und ist damit ohne Netzwerkzugriff testbar.
 *
 * WAS NICHT DRINSTEHT: E-Mail-Adresse und Telefonnummer der Kundschaft. Die
 * Nachricht läuft über Meta, und für den Zweck — „es ist etwas eingegangen"
 * — genügen Vorgangsnummer und Eckdaten. Die vollständigen Angaben stehen in
 * der E-Mail und im Adminbereich.
 *
 * LÄNGE: Eine Vorlagen-Variable bei Meta darf keine Zeilenumbrüche und keine
 * doppelten Leerzeichen enthalten, sonst weist die Schnittstelle die
 * Nachricht ab. Deshalb wird durchgehend mit „ · " getrennt statt mit
 * Umbrüchen.
 */

const TRENNER = " · ";

function paketName(id: string): string {
  return servicePackages.find((p) => p.id === id)?.name ?? id;
}

function fahrzeugName(id: string): string {
  return vehicleTypes.find((v) => v.id === id)?.name ?? id;
}

/** Datum als TT.MM.JJJJ — die Uhrzeit wird bewusst nicht genannt. */
function datum(iso: string): string {
  const [jahr, monat, tag] = iso.slice(0, 10).split("-");
  return tag && monat && jahr ? `${tag}.${monat}.${jahr}` : iso;
}

export function bookingNotifyText(booking: Booking): string {
  return [
    `Neue Terminanfrage ${booking.invoiceNumber}`,
    booking.customer.name,
    `${fahrzeugName(booking.vehicleId)}, ${paketName(booking.packageId)}`,
    `Wunschtermin ${datum(booking.date)}`,
    currency(booking.total),
    booking.pickupCity ? `Abholung ${booking.pickupCity}` : null,
  ]
    .filter(Boolean)
    .join(TRENNER)
    .replace(/\s+/g, " ")
    .trim();
}

export function conditionReportNotifyText(report: {
  name: string;
  vehicle: string;
  photoCount: number;
}): string {
  const fotos =
    report.photoCount === 0
      ? "ohne Aufnahmen"
      : report.photoCount === 1
        ? "1 Aufnahme"
        : `${report.photoCount} Aufnahmen`;

  return ["Neue Zustandsmeldung", report.name, report.vehicle || "Fahrzeug nicht angegeben", fotos]
    .join(TRENNER)
    .replace(/\s+/g, " ")
    .trim();
}
