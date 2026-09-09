import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { packages, extras, vehicleClasses, site } from "../data/site.ts";

export type BookingPdfData = {
  id: number;
  customer_name: string;
  phone: string;
  email?: string | null;
  package_id: string;
  class_id?: string;
  extra_ids?: string;
  preferred_date?: string | null;
  preferred_slot?: string | null;
  total_cents?: number;
  note?: string | null;
};

/** Only for initial requests; never implies confirmation or an invoice. */
export async function createBookingRequestPdf(booking: BookingPdfData): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(`Buchungsanfrage WG-${booking.id}`);
  doc.setAuthor(site.legalName);
  let page = doc.addPage([595.28, 841.89]);
  let y = 785;
  // Standard font supports German/Euro. Unsupported characters are made visible
  // as '?' rather than allowing user input to break booking persistence.
  const clean = (value: string) =>
    Array.from(value.normalize("NFC"), (c) => {
      if (c === "\n") return c;
      if (c < " ") return " ";
      try {
        font.encodeText(c);
        return c;
      } catch {
        return "?";
      }
    }).join("");
  const line = (text: string, size = 11, strong = false) => {
    if (y < 75) {
      page = doc.addPage([595.28, 841.89]);
      y = 785;
    }
    page.drawText(text, {
      x: 48,
      y,
      size,
      font: strong ? bold : font,
      color: rgb(0.12, 0.14, 0.17),
    });
    y -= size + 7;
  };
  const paragraph = (text: string, size = 11, strong = false) => {
    const f = strong ? bold : font;
    for (const raw of clean(text).split("\n")) {
      let current = "";
      for (const c of raw) {
        if (f.widthOfTextAtSize(current + c, size) > 495) {
          const split = current.lastIndexOf(" ");
          if (split > 0) {
            line(current.slice(0, split), size, strong);
            current = current.slice(split + 1);
          } else {
            line(current, size, strong);
            current = "";
          }
        }
        current += c;
      }
      line(current, size, strong);
    }
  };
  paragraph("WHITE GLOSS", 24, true);
  paragraph(`Buchungsanfrage WG-${booking.id}`, 17, true);
  y -= 10;
  paragraph("UNVERBINDLICHE ANFRAGE", 13, true);
  paragraph("Termin noch nicht bestätigt. Keine Rechnung.");
  paragraph("Wir prüfen Ihre Anfrage und stimmen den Termin persönlich mit Ihnen ab.");
  y -= 12;
  paragraph(`Name: ${booking.customer_name}`);
  paragraph(`Telefon: ${booking.phone}`);
  if (booking.email) paragraph(`E-Mail: ${booking.email}`);
  paragraph(`Wunschtermin: ${booking.preferred_date?.slice(0, 10) || "noch offen"}`);
  paragraph(`Zeitfenster: ${booking.preferred_slot || "noch offen"}`);
  y -= 12;
  paragraph("Gewählte Leistungen", 13, true);
  paragraph(packages.find((p) => p.id === booking.package_id)?.name || booking.package_id);
  if (booking.class_id)
    paragraph(
      `Fahrzeugklasse: ${vehicleClasses.find((v) => v.id === booking.class_id)?.label || booking.class_id}`,
    );
  let ids: string[] = [];
  try {
    const value: unknown = JSON.parse(booking.extra_ids || "[]");
    if (Array.isArray(value)) ids = value.filter((v): v is string => typeof v === "string");
  } catch {
    /* Legacy data */
  }
  for (const id of ids.slice(0, 30))
    paragraph(`Extra: ${extras.find((e) => e.id === id)?.name || id}`);
  if (typeof booking.total_cents === "number") {
    y -= 8;
    paragraph(
      `Unverbindlicher Gesamtpreis: ${(booking.total_cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`,
      13,
      true,
    );
    paragraph(
      "Preisübersicht zur Anfrage, keine Zahlungsaufforderung. Den endgültigen Umfang und Preis stimmen wir nach Begutachtung ab.",
    );
  }
  if (booking.note) {
    y -= 12;
    paragraph("Ihr Hinweis", 13, true);
    paragraph(booking.note.slice(0, 2000));
  }
  y -= 18;
  paragraph(`${site.legalName} | ${site.owner}`, 10, true);
  paragraph(`${site.street} | ${site.postalCode} ${site.city}`, 10);
  paragraph(`${site.email} | ${site.phoneDisplay}`, 10);
  doc
    .getPages()
    .forEach((p, i) =>
      p.drawText(`WG-${booking.id} | Seite ${i + 1} / ${doc.getPageCount()} | Keine Rechnung`, {
        x: 48,
        y: 35,
        size: 9,
        font,
      }),
    );
  return Buffer.from(await doc.save()).toString("base64");
}
