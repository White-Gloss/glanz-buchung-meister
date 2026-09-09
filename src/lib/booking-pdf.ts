import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { packages, extras, vehicleClasses, site } from "../data/site.ts";
import { documentLogoBase64 } from "./document-logo.generated.ts";

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
  created_at?: string | Date | null;
};

/** Request snapshot in the owner's business stationery; never an invoice or confirmation. */
export async function createBookingRequestPdf(booking: BookingPdfData): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(documentLogoBase64);
  doc.setTitle(`Buchungsanfrage WG-${booking.id}`);
  doc.setAuthor(site.legalName);
  const page = doc.addPage([595.28, 841.89]);
  const black = rgb(0.12, 0.12, 0.12),
    grey = rgb(0.4, 0.4, 0.4);
  const clean = (s: string) =>
    Array.from(s.normalize("NFC").replace(/\s+/g, " "), (c) => {
      try {
        font.encodeText(c);
        return c;
      } catch {
        return "?";
      }
    })
      .join("")
      .trim();
  const text = (s: string, x: number, y: number, size = 9, strong = false, muted = false) =>
    page.drawText(clean(s), {
      x,
      y,
      size,
      font: strong ? bold : font,
      color: muted ? grey : black,
    });
  const right = (s: string, edge: number, y: number, size = 9, strong = false) => {
    const f = strong ? bold : font;
    text(s, edge - f.widthOfTextAtSize(clean(s), size), y, size, strong);
  };
  const wrap = (s: string, width: number, size = 9) => {
    const result: string[] = [];
    let line = "";
    for (const c of clean(s)) {
      if (font.widthOfTextAtSize(line + c, size) > width) {
        const split = line.lastIndexOf(" ");
        if (split > 0) {
          result.push(line.slice(0, split));
          line = line.slice(split + 1);
        } else {
          result.push(line);
          line = "";
        }
      }
      line += c;
    }
    if (line) result.push(line);
    return result;
  };
  text("Buchungsanfrage", 63, 775, 18, true);
  page.drawImage(logo, { x: 451, y: 703, width: 92, height: (92 * logo.height) / logo.width });
  text(
    `${site.legalName} - ${site.owner}  ·  ${site.street}, ${site.postalCode} ${site.city}`,
    63,
    661,
    6.5,
  );
  let customerY = 634;
  for (const l of wrap(booking.customer_name, 240, 10)) {
    text(l, 63, customerY, 10, true);
    customerY -= 13;
  }
  text(booking.phone, 63, customerY - 5, 9);
  for (const l of wrap(booking.email || "", 240, 9)) {
    customerY -= 12;
    text(l, 63, customerY - 5);
  }
  text("Vorgangsnummer", 325, 634, 9, true);
  text(`WG-${booking.id}`, 420, 634);
  const issued = booking.created_at ? new Date(booking.created_at) : null;
  text("Anfragedatum", 325, 620, 9, true);
  text(
    issued && !Number.isNaN(issued.getTime())
      ? issued.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })
      : "-",
    420,
    620,
  );
  text("Wunschtermin", 325, 606, 9, true);
  text(booking.preferred_date?.slice(0, 10) || "noch offen", 420, 606);
  text("Zeitfenster", 325, 592, 9, true);
  text(booking.preferred_slot || "noch offen", 420, 592);
  let ids: string[] = [];
  try {
    const v: unknown = JSON.parse(booking.extra_ids || "[]");
    if (Array.isArray(v)) ids = v.filter((x): x is string => typeof x === "string");
  } catch {
    /* Legacy row */
  }
  const description = [
    packages.find((p) => p.id === booking.package_id)?.name || booking.package_id,
    booking.class_id
      ? `Fahrzeugklasse: ${vehicleClasses.find((v) => v.id === booking.class_id)?.label || booking.class_id}`
      : "",
    ids.length
      ? `Extras: ${ids
          .slice(0, 30)
          .map((id) => extras.find((e) => e.id === id)?.name || id)
          .join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .flatMap((s) => wrap(s, 295, 9));
  const headerY = Math.min(558, customerY - 35);
  page.drawRectangle({ x: 63, y: headerY - 19, width: 480, height: 19, color: black });
  for (const [label, x] of [
    ["Beschreibung", 72],
    ["Menge", 381],
    ["Gesamtpreis", 475],
  ] as const)
    page.drawText(label, { x, y: headerY - 12, size: 8, font: bold, color: rgb(1, 1, 1) });
  let y = headerY - 37;
  for (const l of description) {
    text(l, 72, y, 9);
    y -= 13;
  }
  text("1", 393, headerY - 37);
  const price =
    typeof booking.total_cents === "number"
      ? (booking.total_cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })
      : "nach Prüfung";
  right(price, 534, headerY - 37);
  y -= 5;
  page.drawLine({
    start: { x: 63, y },
    end: { x: 543, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 30;
  page.drawRectangle({ x: 321, y: y - 8, width: 222, height: 25, color: rgb(0.95, 0.95, 0.95) });
  text("Unverbindlicher Gesamtpreis", 330, y + 1, 8, true);
  right(price, 534, y + 1, 9, true);
  y -= 40;
  const details = [
    { s: "UNVERBINDLICHE ANFRAGE - TERMIN NOCH NICHT BESTÄTIGT", strong: true },
    {
      s: "Wir prüfen Ihre Anfrage und stimmen den Termin persönlich mit Ihnen ab. Diese Preisübersicht ist keine Rechnung und keine Zahlungsaufforderung.",
      strong: false,
    },
    {
      s: "Den endgültigen Leistungsumfang und Preis stimmen wir nach Begutachtung ab.",
      strong: false,
    },
    ...(booking.note
      ? [
          { s: "Ihr Hinweis", strong: true },
          { s: booking.note.slice(0, 2000), strong: false },
        ]
      : []),
  ].flatMap((p) => [
    ...wrap(p.s, 480, 9).map((s) => ({ s, strong: p.strong })),
    { s: "", strong: false },
  ]);
  const scale = Math.min(1, (y - 95) / (details.length * 13));
  for (const l of details) {
    text(l.s, 63, y, 9 * scale, l.strong);
    y -= 13 * scale;
  }
  text(`${site.legalName} - ${site.owner}`, 63, 59, 6.5, false, true);
  text(site.street, 63, 49, 6.5, false, true);
  text(`${site.postalCode} ${site.city}, Deutschland`, 63, 39, 6.5, false, true);
  text(site.email, 63, 29, 6.5, false, true);
  text(site.phoneDisplay, 290, 59, 6.5, false, true);
  text("white-gloss.de", 290, 49, 6.5, false, true);
  right("Seite 1/1", 543, 79, 6.5);
  return Buffer.from(await doc.save()).toString("base64");
}
