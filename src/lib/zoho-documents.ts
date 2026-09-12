import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { packages, extras, vehicleClasses, site } from "../data/site.ts";
import { documentLogoBase64 } from "./document-logo.generated.ts";
import { formatBerlinRange } from "./zoho-time.ts";
import type { ZohoBooking } from "./zoho-ops.ts";

function clean(font: { encodeText: (value: string) => unknown }, value: string) {
  return Array.from(value.normalize("NFC").replace(/\s+/g, " "), (char) => {
    try {
      font.encodeText(char);
      return char;
    } catch {
      return "?";
    }
  })
    .join("")
    .trim();
}

function euros(cents: number) {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

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
  ZohoBooking,
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
> & { payment_method?: string | null };

export async function createBookingConfirmationPdf(booking: ConfirmationPdfInput): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(documentLogoBase64);
  const version = Math.max(1, booking.confirmation_pdf_version || 1);
  doc.setTitle(`Buchungsbestaetigung WG-${booking.id}`);
  doc.setAuthor(site.legalName);
  const page = doc.addPage([595.28, 841.89]);
  const black = rgb(0.12, 0.12, 0.12);
  const grey = rgb(0.4, 0.4, 0.4);
  const text = (value: string, x: number, y: number, size = 9, strong = false, muted = false) => {
    page.drawText(clean(font, value), {
      x,
      y,
      size,
      font: strong ? bold : font,
      color: muted ? grey : black,
    });
  };
  const wrap = (value: string, width: number, size = 9) => {
    const lines: string[] = [];
    let line = "";
    for (const char of clean(font, value)) {
      if (font.widthOfTextAtSize(line + char, size) > width) {
        const split = line.lastIndexOf(" ");
        if (split > 0) {
          lines.push(line.slice(0, split));
          line = line.slice(split + 1) + char;
        } else {
          lines.push(line);
          line = char;
        }
      } else line += char;
    }
    if (line) lines.push(line);
    return lines;
  };

  text("Buchungsbestätigung", 63, 775, 18, true);
  text("Keine Rechnung", 63, 756, 10, true);
  page.drawImage(logo, { x: 451, y: 703, width: 92, height: (92 * logo.height) / logo.width });
  text(
    `${site.legalName} · ${site.owner}  ·  ${site.street}, ${site.postalCode} ${site.city}`,
    63,
    661,
    7,
  );

  let y = 634;
  for (const line of wrap(booking.customer_name, 240, 10)) {
    text(line, 63, y, 10, true);
    y -= 13;
  }
  text(booking.phone, 63, y - 2);
  if (booking.email) text(booking.email, 63, y - 16);

  text("Vorgang", 325, 634, 9, true);
  text(`WG-${booking.id}`, 420, 634);
  text("Dokumentversion", 325, 620, 9, true);
  text(String(version), 420, 620);

  const start = booking.work_start_at ? new Date(booking.work_start_at) : null;
  const end = booking.work_end_at ? new Date(booking.work_end_at) : null;
  const when =
    start && end && !Number.isNaN(start.getTime())
      ? formatBerlinRange(start, end)
      : `${booking.preferred_date || "offen"} ${booking.preferred_slot || ""}`.trim();
  text("Bestätigter Zeitraum", 325, 606, 9, true);
  let whenY = 592;
  for (const line of wrap(when, 175, 9)) {
    text(line, 420, whenY);
    whenY -= 12;
  }

  const vehicle = [
    booking.vehicle_make,
    booking.vehicle_model,
    booking.vehicle_plate,
    vehicleClasses.find((item) => item.id === booking.class_id)?.label || booking.class_id,
  ]
    .filter(Boolean)
    .join(" · ");
  const extrasList = extraNames(booking.extra_ids);
  const description = [
    packages.find((item) => item.id === booking.package_id)?.name || booking.package_id,
    vehicle ? `Fahrzeug: ${vehicle}` : "",
    extrasList.length ? `Zusatzleistungen: ${extrasList.join(", ")}` : "",
    booking.city_slug ? `Abholort: ${booking.city_slug}` : "",
    `Leistungsort: ${site.street}, ${site.postalCode} ${site.city}`,
  ].filter(Boolean);

  const headerY = Math.min(548, whenY - 24);
  page.drawRectangle({ x: 63, y: headerY - 19, width: 480, height: 19, color: black });
  page.drawText("Leistung", { x: 72, y: headerY - 12, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Betrag", { x: 475, y: headerY - 12, size: 8, font: bold, color: rgb(1, 1, 1) });
  let cursor = headerY - 38;
  for (const line of description.flatMap((entry) => wrap(entry, 390, 9))) {
    text(line, 72, cursor);
    cursor -= 13;
  }
  const amount = booking.agreed_price_cents ?? booking.total_cents ?? 0;
  text(euros(amount), 470, headerY - 38, 10, true);
  cursor -= 10;
  page.drawLine({
    start: { x: 63, y: cursor },
    end: { x: 543, y: cursor },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  cursor -= 28;
  text("Vereinbarter Preis (brutto, inkl. 19 % MwSt.)", 63, cursor, 9, true);
  text(euros(amount), 420, cursor, 11, true);
  cursor -= 22;
  text(
    "Die verbindliche Rechnung folgt erst nach erbrachter Leistung und ist dieses Dokument nicht.",
    63,
    cursor,
    8,
    false,
    true,
  );
  cursor -= 18;
  text(
    "Zahlungsart und Fälligkeit stehen in der späteren Rechnung. Es wird hier nichts eingezogen.",
    63,
    cursor,
    8,
    false,
    true,
  );
  if (booking.note) {
    cursor -= 24;
    text("Hinweise", 63, cursor, 9, true);
    cursor -= 14;
    for (const line of wrap(booking.note.slice(0, 800), 480, 9)) {
      text(line, 63, cursor);
      cursor -= 12;
    }
  }
  text(`${site.legalName} · ${site.owner}`, 63, 59, 6.5, false, true);
  text(`${site.street}, ${site.postalCode} ${site.city}`, 63, 49, 6.5, false, true);
  text(site.email, 63, 39, 6.5, false, true);
  text(site.phoneDisplay, 290, 59, 6.5, false, true);
  text("white-gloss.de", 290, 49, 6.5, false, true);
  text("Seite 1/1 · Keine Rechnung", 400, 39, 6.5, false, true);
  return Buffer.from(await doc.save()).toString("base64");
}

export function receiptEmailCopy(name: string, reference: string) {
  return [
    `Hallo ${name},`,
    "",
    "vielen Dank für deine Anfrage bei White Gloss Detailing.",
    "Deine Buchungsanfrage ist bei uns eingegangen.",
    "",
    "Wir prüfen nun deine Angaben und die hochgeladenen Fahrzeugfotos, um den Aufwand, den endgültigen Preis und die benötigte Zeit festzulegen.",
    "Dein Wunschtermin ist noch nicht verbindlich bestätigt.",
    "Nach unserer Prüfung erhältst du eine separate Terminbestätigung.",
    "",
    `Vorgang: ${reference}`,
    "",
    "White Gloss Detailing",
    `${site.street}, ${site.postalCode} ${site.city}`,
    site.phoneDisplay,
  ].join("\n");
}

export function confirmationEmailCopy(name: string, reference: string, when: string, price: string) {
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
  ].join("\n");
}
