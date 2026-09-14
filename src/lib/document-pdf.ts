import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type DocumentRow = { name: string; quantity: number; grossCents: number; taxRate: number };
export type BusinessDocument = {
  title: string;
  reference: string;
  logo: string;
  company: string;
  address: string;
  email: string;
  customer: string[];
  metadata: string[];
  introduction: string;
  vehicle: string;
  rows: DocumentRow[];
  amountCents: number;
  details: string[];
  footerRight: string[];
};

/** Shared White-Gloss stationery, following the retained Bitrix DOCX templates. */
export async function createBusinessDocumentPdf(input: BusinessDocument): Promise<string> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.title} ${input.reference}`);
  doc.setAuthor(input.company);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(input.logo);
  const ink = rgb(0.125, 0.125, 0.125),
    muted = rgb(0.4, 0.4, 0.4);
  const left = 58,
    right = 537,
    width = right - left;
  let page = doc.addPage([595.28, 841.89]),
    y = 680;
  const clean = (s: string) =>
    Array.from(String(s).normalize("NFC"), (c) => {
      if (c === "\n") return c;
      try {
        font.encodeText(c);
        return c;
      } catch {
        return "?";
      }
    })
      .join("")
      .replace(/\r/g, "");
  const wrap = (s: string, maxWidth = width, size = 9) => {
    const lines: string[] = [];
    for (const paragraph of clean(s).split("\n")) {
      let line = "";
      for (const char of paragraph) {
        if (font.widthOfTextAtSize(line + char, size) > maxWidth) {
          const at = line.lastIndexOf(" ");
          if (at > 0) {
            lines.push(line.slice(0, at));
            line = line.slice(at + 1) + char;
          } else {
            lines.push(line);
            line = char;
          }
        } else line += char;
      }
      lines.push(line);
    }
    return lines;
  };
  const text = (s: string, x: number, at: number, size = 9, strong = false, grey = false) =>
    page.drawText(clean(s), {
      x,
      y: at,
      size,
      font: strong ? bold : font,
      color: grey ? muted : ink,
    });
  const alignRight = (s: string, x: number, at: number, size = 9, strong = false) =>
    text(s, x - (strong ? bold : font).widthOfTextAtSize(clean(s), size), at, size, strong);
  const money = (cents: number) =>
    (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  const newPage = () => {
    page = doc.addPage([595.28, 841.89]);
    text(`${input.title} ${input.reference} · Fortsetzung`, left, 786, 12, true);
    y = 755;
  };
  const space = (height: number) => {
    if (y - height < 105) newPage();
  };
  const paragraph = (value: string, strong = false) => {
    if (!value.trim()) return;
    for (const line of wrap(value)) {
      space(13);
      text(line, left, y, 9, strong);
      y -= 13;
    }
    y -= 7;
  };
  text(input.title, left, 781, 22);
  page.drawImage(logo, { x: 425, y: 714, width: 112, height: (112 * logo.height) / logo.width });
  for (const line of wrap(`${input.company} · ${input.address}`, width, 7)) {
    text(line, left, y, 7);
    y -= 10;
  }
  y -= 20;
  const customerLines = input.customer.filter(Boolean).flatMap((v) => wrap(v, 233));
  const metaLines = input.metadata.filter(Boolean).flatMap((v) => wrap(v, 231));
  for (const [index, line] of customerLines.entries())
    text(line, left, y - index * 13, 9, index === 0);
  for (const [index, line] of metaLines.entries()) text(line, 306, y - index * 13);
  y -= Math.max(customerLines.length, metaLines.length) * 13 + 25;
  paragraph(input.introduction);
  if (input.vehicle) paragraph(`Fahrzeug: ${input.vehicle}`);
  const columns = [left, 271, 312, 389, 439, right];
  const tableHeader = () => {
    space(32);
    page.drawRectangle({ x: left, y: y - 22, width, height: 22, color: ink });
    ["Beschreibung", "Menge", "Einzelpreis", "MwSt.", "Nettobetrag"].forEach((label, i) => {
      page.drawText(label, {
        x: columns[i] + 5,
        y: y - 14,
        size: 8,
        font: bold,
        color: rgb(1, 1, 1),
      });
    });
    y -= 38;
  };
  tableHeader();
  let netCents = 0;
  const taxes = new Map<number, number>();
  for (const row of input.rows) {
    const net = Math.round(row.grossCents / (1 + row.taxRate / 100));
    netCents += net;
    taxes.set(row.taxRate, (taxes.get(row.taxRate) || 0) + row.grossCents - net);
    const lines = wrap(row.name, columns[1] - left - 12);
    if (y - Math.min(lines.length * 13 + 14, 540) < 105) {
      newPage();
      tableHeader();
    }
    lines.forEach((line, index) => {
      if (y < 118) {
        newPage();
        tableHeader();
      }
      text(line, left + 5, y);
      if (index === 0) {
        alignRight(String(row.quantity), columns[2] - 7, y);
        alignRight(money(net / row.quantity), columns[3] - 7, y);
        alignRight(`${row.taxRate} %`, columns[4] - 7, y);
        alignRight(money(net), right - 5, y);
      }
      y -= 13;
    });
    y -= 9;
    page.drawLine({
      start: { x: left, y: y + 11 },
      end: { x: right, y: y + 11 },
      color: rgb(0.85, 0.85, 0.85),
      thickness: 0.4,
    });
  }
  space(80 + taxes.size * 17);
  y -= 8;
  alignRight(`Nettobetrag: ${money(netCents)}`, right, y);
  y -= 17;
  for (const [rate, tax] of taxes) {
    alignRight(`MwSt. ${rate} %: ${money(tax)}`, right, y);
    y -= 17;
  }
  page.drawRectangle({
    x: 285,
    y: y - 4,
    width: right - 285,
    height: 17,
    color: rgb(0.96, 0.96, 0.96),
  });
  alignRight(`Gesamtbetrag inkl. MwSt.: ${money(input.amountCents)}`, right, y, 10, true);
  y -= 32;
  for (const detail of input.details) paragraph(detail);
  paragraph("Vielen Dank für die gute Zusammenarbeit.\nWhite-Gloss Detailing");
  const pages = doc.getPages();
  pages.forEach((p, index) => {
    page = p;
    page.drawLine({
      start: { x: left, y: 87 },
      end: { x: right, y: 87 },
      color: rgb(0.8, 0.8, 0.8),
      thickness: 0.4,
    });
    [input.company, input.address, input.email]
      .flatMap((v) => wrap(v, 237, 7))
      .slice(0, 5)
      .forEach((line, i) => text(line, left, 73 - i * 10, 7, false, true));
    input.footerRight
      .flatMap((v) => wrap(v, 231, 7))
      .slice(0, 4)
      .forEach((line, i) => text(line, 306, 73 - i * 10, 7, false, true));
    alignRight(`Seite ${index + 1} / ${pages.length}`, right, 22, 7);
  });
  return Buffer.from(await doc.save()).toString("base64");
}
