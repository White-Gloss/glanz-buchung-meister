import { createBusinessDocumentPdf } from "./document-pdf.ts";
import { packages, extras, vehicleClasses, site } from "../data/site.ts";
import { documentLogoBase64 } from "./document-logo.generated.ts";
import { formatBerlinRange } from "./booking-time.ts";
import type { OperationsBooking } from "./booking-operations.ts";

function extraNames(raw: string | null | undefined) {
  try {
    const value: unknown = JSON.parse(raw || "[]");
    return Array.isArray(value)
      ? value
          .filter((id): id is string => typeof id === "string")
          .map((id) => extras.find((item) => item.id === id)?.name || id)
      : [];
  } catch {
    return [];
  }
}

export type ConfirmationPdfInput = Pick<
  OperationsBooking,
  | "id"
  | "customer_name"
  | "phone"
  | "email"
  | "package_id"
  | "class_id"
  | "extra_ids"
  | "city_slug"
  | "note"
  | "agreed_price_cents"
  | "total_cents"
  | "work_start_at"
  | "work_end_at"
  | "preferred_date"
  | "preferred_slot"
  | "vehicle_make"
  | "vehicle_model"
  | "vehicle_plate"
  | "confirmation_pdf_version"
> & {
  payment_method?: string | null;
  final_rows?: { name: string; quantity: number; grossCents: number }[];
};

export async function createBookingConfirmationPdf(booking: ConfirmationPdfInput): Promise<string> {
  const amount = booking.agreed_price_cents ?? booking.total_cents ?? 0;
  const start = booking.work_start_at ? new Date(booking.work_start_at) : null;
  const end = booking.work_end_at ? new Date(booking.work_end_at) : null;
  const when =
    start && end && !Number.isNaN(start.getTime())
      ? formatBerlinRange(start, end)
      : `${booking.preferred_date || "offen"} ${booking.preferred_slot || ""}`.trim();
  const rows = booking.final_rows?.length
    ? booking.final_rows.map((row) => ({ ...row, taxRate: 19 }))
    : [
        {
          name: [
            packages.find((item) => item.id === booking.package_id)?.name || booking.package_id,
            ...extraNames(booking.extra_ids),
          ].join(" · "),
          quantity: 1,
          grossCents: amount,
          taxRate: 19,
        },
      ];
  return createBusinessDocumentPdf({
    title: "Buchungsbestätigung",
    reference: `WG-${booking.id}`,
    logo: documentLogoBase64,
    company: `${site.legalName} · ${site.owner}`,
    address: `${site.street}, ${site.postalCode} ${site.city}`,
    email: site.bookingEmail,
    customer: [booking.customer_name, booking.phone, booking.email || ""],
    metadata: [
      `Buchungsreferenz: WG-${booking.id}`,
      `Dokumentversion: ${Math.max(1, booking.confirmation_pdf_version || 1)}`,
    ],
    introduction:
      "Vielen Dank für deine Buchung. Nach unserer Prüfung bestätigen wir die folgenden Leistungen und den vereinbarten Termin:",
    vehicle: [
      booking.vehicle_make,
      booking.vehicle_model,
      booking.vehicle_plate,
      vehicleClasses.find((item) => item.id === booking.class_id)?.label,
    ]
      .filter(Boolean)
      .join(" · "),
    rows,
    amountCents: amount,
    details: [
      `Bestätigter Zeitraum: ${when}`,
      `Leistungsort: ${site.street}, ${site.postalCode} ${site.city}`,
      booking.note ? `Hinweise: ${booking.note.slice(0, 800)}` : "",
      "Diese Buchungsbestätigung ist keine Rechnung. Die Rechnung wird nach der Durchführung der Dienstleistung separat erstellt. Zahlung fällig nach erbrachter Dienstleistung; Zahlungsart und Zahlungsziel stehen in der Rechnung.",
    ],
    footerRight: ["white-gloss.de", `Buchungsreferenz WG-${booking.id}`],
  });
}

export function receiptEmailCopy(name: string, reference: string) {
  return [
    `Hallo ${name},`,
    "",
    "Vielen Dank für deine Buchungsanfrage bei White-Gloss Detailing. Deine Anfrage ist bei uns eingegangen. Wir prüfen deine Angaben und Fahrzeugfotos, um den Fahrzeugzustand, den genauen Preis und die benötigte Arbeitszeit einzuschätzen. Dein Wunschtermin ist noch nicht verbindlich bestätigt. Die endgültige Buchungsbestätigung erhältst du nach unserer manuellen Prüfung und Freigabe.",
    "",
    `Vorgang: ${reference}`,
    "",
    "White Gloss Detailing",
    `${site.street}, ${site.postalCode} ${site.city}`,
    site.phoneDisplay,
    site.bookingEmail,
  ].join("\n");
}

export function confirmationEmailCopy(
  name: string,
  reference: string,
  when: string,
  price: string,
) {
  return [
    `Hallo ${name},`,
    "",
    "dein Termin bei White Gloss Detailing ist jetzt verbindlich bestätigt.",
    `Bestätigter Zeitraum: ${when}`,
    `Vereinbarter Preis: ${price}`,
    `Vorgang: ${reference}`,
    "",
    "Im Anhang findest du die Buchungsbestätigung als PDF. Das ist keine Rechnung.",
    "Die Rechnung erhältst du erst, nachdem die Leistung erbracht und von uns abgeschlossen wurde.",
    "",
    `Leistungsort: ${site.street}, ${site.postalCode} ${site.city}`,
    "",
    "White Gloss Detailing",
    site.phoneDisplay,
    site.bookingEmail,
  ].join("\n");
}
