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
  const page = doc.addPage([595.28, 841.89]);
  const ink = rgb(0.12, 0.14, 0.17);
  page.drawRectangle({ x: 0, y: 748, width: 595.28, height: 94, color: ink });
  page.drawText("WHITE GLOSS", { x: 48, y: 792, size: 25, font: bold, color: rgb(1, 1, 1) });
  page.drawText("DETAILING  |  FAHRZEUGAUFBEREITUNG", {
    x: 49,
    y: 771,
    size: 9,
    font,
    color: rgb(0.82, 0.84, 0.86),
  });
  page.drawText("Buchungsanfrage", { x: 48, y: 714, size: 20, font: bold, color: ink });
  const reference = `WG-${booking.id}`;
  page.drawText(reference, {
    x: 547 - bold.widthOfTextAtSize(reference, 13),
    y: 716,
    size: 13,
    font: bold,
    color: ink,
  });
  page.drawLine({
    start: { x: 48, y: 697 },
    end: { x: 547, y: 697 },
    thickness: 1,
    color: rgb(0.8, 0.82, 0.84),
  });
  let y = 673;
  const lines: { text: string; size: number; strong: boolean; y: number }[] = [];
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
    lines.push({ text, size, strong, y });
    y -= size + 5;
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
  if (ids.length)
    paragraph(
      `Extras: ${ids
        .slice(0, 30)
        .map((id) => extras.find((e) => e.id === id)?.name || id)
        .join(", ")}`,
    );
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
    paragraph(booking.note.slice(0, 2000).replace(/\s+/g, " ").trim());
  }
  // Keep the complete request on one page, with a fixed, unobstructed footer.
  const scale = Math.min(1, 570 / (673 - y));
  for (const item of lines)
    page.drawText(item.text, {
      x: 48,
      y: 673 - (673 - item.y) * scale,
      size: item.size * scale,
      font: item.strong ? bold : font,
      color: ink,
    });
  page.drawLine({
    start: { x: 48, y: 80 },
    end: { x: 547, y: 80 },
    thickness: 1,
    color: rgb(0.8, 0.82, 0.84),
  });
  page.drawText(`${site.legalName} | ${site.owner}`, {
    x: 48,
    y: 62,
    size: 9,
    font: bold,
    color: ink,
  });
  page.drawText(`${site.street} | ${site.postalCode} ${site.city}`, {
    x: 48,
    y: 48,
    size: 9,
    font,
    color: ink,
  });
  page.drawText(`${site.email} | ${site.phoneDisplay}`, {
    x: 48,
    y: 34,
    size: 9,
    font,
    color: ink,
  });
  page.drawText("white-gloss.de", { x: 457, y: 62, size: 10, font: bold, color: ink });
  page.drawText("Seite 1 / 1", { x: 505, y: 34, size: 8, font, color: ink });
  return Buffer.from(await doc.save()).toString("base64");
}
