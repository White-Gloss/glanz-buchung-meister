import { calcLineItems, calcTotals, effectivePrice, type Booking } from "./bookings";
import { company, depositConfig, servicePackages, taxConfig, vehicleTypes } from "./servicesConfig";
import { getPickupCity } from "./pickupLocations";
import type { BookingDocumentDraft, BookingWithDocumentDraft } from "./bookingDocumentDraft";

export type BookingDocumentKind =
  "request" | "confirmation" | "admin" | "offer" | "invoice-draft" | "payment-reminder-draft";

type PdfTextOptions = { align?: "left" | "center" | "right" | "justify" };
type JsPdfDocument = Awaited<ReturnType<typeof buildDocument>>;

const PAGE = { left: 18, right: 192, width: 174, footerY: 282 } as const;
const COLORS = {
  ink: [31, 31, 31] as const,
  muted: [95, 95, 95] as const,
  line: [221, 221, 221] as const,
  soft: [246, 246, 246] as const,
  warning: [132, 82, 10] as const,
};

const eur = (value: number) =>
  `${new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} €`;

function deDate(iso: string | null | undefined) {
  if (!iso) return "wird nachgereicht";
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "wird nachgereicht";
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function today() {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

function documentNumber(booking: Booking, kind: BookingDocumentKind) {
  const editedNumber = documentDraft(booking)?.documentNumber.trim();
  if (editedNumber) return editedNumber;
  const suffix = booking.invoiceNumber.replace(/^[A-Za-z-]+/, "") || booking.invoiceNumber;
  if (kind === "offer") return `AN-${suffix}`;
  if (kind === "invoice-draft" || kind === "payment-reminder-draft") return `RE-${suffix}`;
  return booking.invoiceNumber;
}

function placeholder(value: string | null | undefined, fallback = "wird nachgereicht") {
  return value?.trim() || fallback;
}

function documentDraft(booking: Booking): BookingDocumentDraft | undefined {
  return (booking as BookingWithDocumentDraft).documentDraft;
}

function sourceLabel(source: Booking["bookingSource"]) {
  switch (source) {
    case "whatsapp":
      return "WhatsApp";
    case "telefon":
      return "Telefon";
    case "vor_ort":
      return "Vor Ort";
    case "sonstiges":
      return "Manuell";
    default:
      return "Website";
  }
}

function titleFor(kind: BookingDocumentKind) {
  if (kind === "offer") return "ANGEBOT";
  if (kind === "invoice-draft") return "RECHNUNG · ENTWURF";
  if (kind === "payment-reminder-draft") return "ZAHLUNGSERINNERUNG · ENTWURF";
  if (kind === "confirmation") return "TERMINBESTÄTIGUNG";
  if (kind === "admin") return "AUFTRAGSUNTERLAGEN";
  return "TERMINANFRAGE";
}

function filenamePrefix(kind: BookingDocumentKind) {
  if (kind === "offer") return "Angebot";
  if (kind === "invoice-draft") return "Rechnungsentwurf";
  if (kind === "payment-reminder-draft") return "Zahlungserinnerung_Entwurf";
  if (kind === "confirmation") return "Terminbestaetigung";
  if (kind === "request") return "Terminanfrage";
  return "Auftragsunterlagen";
}

function isCommercialDocument(kind: BookingDocumentKind) {
  return kind === "offer" || kind === "invoice-draft" || kind === "payment-reminder-draft";
}

async function loadLetterheadLogo(): Promise<string | null> {
  try {
    const logoUrl =
      typeof window === "undefined"
        ? `${company.web}/wgd-document-logo.png`
        : "/wgd-document-logo.png";
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

function priceNote(kind: BookingDocumentKind, hasAgreedPrice: boolean) {
  if (kind === "confirmation" || (kind === "admin" && hasAgreedPrice)) {
    return (
      "Der vereinbarte Preis wurde auf Grundlage Ihrer Angaben und – sofern vorhanden – der " +
      "übermittelten Fotos festgelegt. Zusätzlichen Aufwand stimmen wir vor Beginn der Arbeiten " +
      "transparent mit Ihnen ab."
    );
  }
  return (
    "Der angegebene Preis basiert auf Ihren Angaben und – sofern vorhanden – den übermittelten " +
    "Fotos. Weicht der Fahrzeugzustand vor Ort deutlich ab, stimmen wir eine mögliche Anpassung " +
    "vor Beginn der Arbeiten mit Ihnen ab."
  );
}

async function buildDocument(booking: Booking, kind: BookingDocumentKind) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLetterheadLogo();

  if (isCommercialDocument(kind)) {
    drawTemplateDocument(doc, booking, kind, logo);
  } else {
    drawBookingDocument(doc, booking, kind, logo);
  }

  addFooters(doc, kind);
  return doc;
}

function drawHeader(
  doc: InstanceType<(typeof import("jspdf"))["jsPDF"]>,
  kind: BookingDocumentKind,
  number: string,
  logo: string | null,
  booking: Booking,
) {
  const { left: L, right: R } = PAGE;
  if (logo) {
    doc.addImage(logo, "PNG", L, 10, 82, 43, undefined, "FAST");
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.ink);
    doc.text("WHITE GLOSS", L, 26);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("DETAILING · NO COMPROMISES. ONLY RESULTS.", L, 32);
  }

  doc.setTextColor(...COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(kind === "payment-reminder-draft" ? 14 : 16);
  doc.text(titleFor(kind), R, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const labels =
    kind === "offer"
      ? [
          `Angebotsnummer: ${number}`,
          `Angebotsdatum: ${today()}`,
          `Gültig bis: ${deDate(documentDraft(booking)?.validUntil)}`,
          "Kundennummer: wird nachgereicht",
        ]
      : kind === "invoice-draft"
        ? [
            `Rechnungsnummer: ${number}`,
            `Rechnungsdatum: ${today()}`,
            `Leistungsdatum: ${deDate(documentDraft(booking)?.serviceDate || booking.date)}`,
            "Kundennummer: wird nachgereicht",
          ]
        : kind === "payment-reminder-draft"
          ? [
              `Datum: ${today()}`,
              `Bezug: Rechnung Nr. ${number}`,
              "Kundennummer: wird nachgereicht",
            ]
          : [`Buchungsnummer: ${number}`];
  labels.forEach((line, index) => doc.text(line, R, 25 + index * 4.2, { align: "right" }));
}

function drawAddressBlocks(doc: InstanceType<(typeof import("jspdf"))["jsPDF"]>, booking: Booking) {
  const { left: L, right: R } = PAGE;
  const draft = documentDraft(booking);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...COLORS.muted);
  doc.text(`${company.name} · ${company.owner} · ${company.street} · ${company.city}`, L, 62);

  doc.setTextColor(...COLORS.ink);
  doc.setFontSize(9);
  [
    placeholder(booking.customer.name),
    placeholder(draft?.customerCompany, "Firma / Ansprechpartner: wird nachgereicht"),
    placeholder(draft?.customerStreet, "Straße / Hausnummer: wird nachgereicht"),
    placeholder(draft?.customerCity, "PLZ / Ort: wird nachgereicht"),
  ].forEach((line, index) => doc.text(line, L, 69 + index * 5));

  [
    company.name,
    company.owner,
    company.street,
    company.city,
    `Tel.: ${company.phone}`,
    `E-Mail: ${company.email}`,
    `Web: ${company.web.replace(/^https?:\/\//, "www.")}`,
  ].forEach((line, index) => doc.text(line, R, 62 + index * 4.5, { align: "right" }));
}

function drawTemplateDocument(
  doc: InstanceType<(typeof import("jspdf"))["jsPDF"]>,
  booking: Booking,
  kind: Extract<BookingDocumentKind, "offer" | "invoice-draft" | "payment-reminder-draft">,
  logo: string | null,
) {
  const number = documentNumber(booking, kind);
  drawHeader(doc, kind, number, logo, booking);
  drawAddressBlocks(doc, booking);

  if (kind === "payment-reminder-draft") {
    drawPaymentReminder(doc, booking, number);
    return;
  }

  const isOffer = kind === "offer";
  let y = 105;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.ink);
  doc.text(`${isOffer ? "Angebot" : "Rechnung"} Nr. ${number}`, PAGE.left, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Sehr geehrte Damen und Herren,", PAGE.left, y);
  y += 6;
  doc.text(
    isOffer
      ? "vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:"
      : "hiermit stellen wir Ihnen die folgenden Leistungen als Rechnungsentwurf zusammen:",
    PAGE.left,
    y,
  );
  y += 9;

  const items = calcLineItems(booking);
  const shownTotal = effectivePrice(booking);
  const totals = calcTotals([{ label: "Gesamt", qty: 1, unit: shownTotal, total: shownTotal }]);
  y = drawItemsTable(doc, booking, items, y, isOffer);
  y = drawTotals(doc, totals, y, isOffer ? "Angebotssumme" : "Gesamtbetrag");

  if (isOffer) {
    drawOfferTerms(doc, y);
  } else {
    drawInvoicePayment(doc, booking, number, y);
  }
}

function drawItemsTable(
  doc: InstanceType<(typeof import("jspdf"))["jsPDF"]>,
  booking: Booking,
  items: ReturnType<typeof calcLineItems>,
  y: number,
  offer: boolean,
) {
  const { left: L, right: R } = PAGE;
  const widths = [14, 32, 68, 12, 24, 24];
  const xs = widths.reduce<number[]>((values, width) => [...values, values.at(-1)! + width], [L]);
  const headers = [
    offer ? "Pos." : "Datum",
    "Fahrzeug",
    "Leistung / Beschreibung",
    "Anz.",
    "Einzelpreis",
    "Betrag",
  ];

  doc.setFillColor(...COLORS.ink);
  doc.rect(L, y, PAGE.width, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  headers.forEach((header, index) => {
    const alignRight = index >= 3;
    doc.text(header, alignRight ? xs[index + 1] - 2 : xs[index] + 2, y + 5.2, {
      align: alignRight ? "right" : "left",
    });
  });
  y += 8;

  const vehicle =
    vehicleTypes.find((item) => item.id === booking.vehicleId)?.name ?? booking.vehicleId;
  const plate = placeholder(booking.customer.plate, "Kennz. wird nachgereicht");
  const tableItems = items.length
    ? items
    : [{ label: "Leistung wird nachgereicht", qty: 1, unit: 0, total: 0 }];
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.ink);
  doc.setFontSize(7.5);

  tableItems.forEach((item, index) => {
    const description = doc.splitTextToSize(item.label, widths[2] - 4) as string[];
    const vehicleLines = doc.splitTextToSize(`${vehicle}, ${plate}`, widths[1] - 4) as string[];
    const height = Math.max(12, Math.max(description.length, vehicleLines.length) * 3.7 + 4);
    if (index % 2 === 1) {
      doc.setFillColor(...COLORS.soft);
      doc.rect(L, y, PAGE.width, height, "F");
    }
    doc.text(offer ? String(index + 1) : deDate(booking.date).slice(0, 5), xs[0] + 2, y + 5);
    doc.text(vehicleLines, xs[1] + 2, y + 5);
    doc.text(description, xs[2] + 2, y + 5);
    doc.text(String(item.qty), xs[4] - 2, y + 5, { align: "right" });
    doc.text(eur(item.unit), xs[5] - 2, y + 5, { align: "right" });
    doc.text(eur(item.total), R - 2, y + 5, { align: "right" });
    doc.setDrawColor(...COLORS.line);
    doc.line(L, y + height, R, y + height);
    y += height;
  });
  return y + 3;
}

function drawTotals(
  doc: InstanceType<(typeof import("jspdf"))["jsPDF"]>,
  totals: ReturnType<typeof calcTotals>,
  y: number,
  totalLabel: string,
) {
  const labelX = 152;
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.ink);
  doc.setFont("helvetica", "normal");
  const rows = taxConfig.smallBusiness
    ? ([
        ["Zwischensumme", totals.net],
        [totalLabel, totals.gross],
      ] as const)
    : ([
        ["Zwischensumme (netto)", totals.net],
        [`zzgl. ${taxConfig.vatRate * 100}% USt.`, totals.vat],
        [totalLabel, totals.gross],
      ] as const);
  rows.forEach(([label, value], index) => {
    const final = index === rows.length - 1;
    if (final) {
      doc.setDrawColor(...COLORS.ink);
      doc.line(112, y - 1.5, PAGE.right, y - 1.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
    }
    doc.text(label, labelX, y + 3, { align: "right" });
    doc.text(eur(value), PAGE.right, y + 3, { align: "right" });
    y += final ? 8 : 6;
  });
  return y;
}

function drawOfferTerms(doc: InstanceType<(typeof import("jspdf"))["jsPDF"]>, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Angebotsbedingungen", PAGE.left, y + 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const text = `Dieses Angebot ist freibleibend; das Gültigkeitsdatum wird nachgereicht. ${
    taxConfig.smallBusiness
      ? taxConfig.smallBusinessNote
      : "Alle ausgewiesenen Endpreise enthalten die gesetzliche Umsatzsteuer."
  } Nach Ihrer Auftragsbestätigung erhalten Sie eine Terminbestätigung. Die Rechnung entsteht erst nach der Leistungserbringung.`;
  const lines = doc.splitTextToSize(text, PAGE.width) as string[];
  doc.text(lines, PAGE.left, y + 9);
  const closingY = y + 9 + lines.length * 4 + 7;
  doc.text(
    "Wir freuen uns auf Ihre Rückmeldung und stehen für Rückfragen gerne zur Verfügung.",
    PAGE.left,
    closingY,
  );
  doc.text("Mit freundlichen Grüßen", PAGE.left, closingY + 8);
  doc.setFont("helvetica", "bold");
  doc.text(company.owner, PAGE.left, closingY + 13);
  doc.setFont("helvetica", "normal");
  doc.text(company.name, PAGE.left, closingY + 18);
}

function drawInvoicePayment(
  doc: InstanceType<(typeof import("jspdf"))["jsPDF"]>,
  booking: Booking,
  number: string,
  y: number,
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Zahlungsinformationen", PAGE.left, y + 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const lines = [
    taxConfig.paymentTerms,
    `Kontoinhaber: ${placeholder(company.bank.holder)}`,
    `IBAN: ${placeholder(company.bank.iban)}`,
    `BIC: ${placeholder(company.bank.bic)}`,
    "Bank: wird nachgereicht",
    `Verwendungszweck: Rechnungsnummer ${number}`,
  ];
  lines.forEach((line, index) => doc.text(line, PAGE.left, y + 8 + index * 4.8));
  const noteY = y + 41;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.warning);
  doc.text("ENTWURF – fehlende Pflichtangaben vor Versand ergänzen und prüfen.", PAGE.left, noteY);
  doc.setTextColor(...COLORS.ink);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Leistungsdatum: ${deDate(documentDraft(booking)?.serviceDate || booking.date)} · Steuer-/USt.-Angaben: wird nachgereicht`,
    PAGE.left,
    noteY + 5,
  );
  doc.text("Vielen Dank für Ihren Auftrag und Ihr Vertrauen!", PAGE.left, noteY + 13);
}

function drawPaymentReminder(
  doc: InstanceType<(typeof import("jspdf"))["jsPDF"]>,
  booking: Booking,
  number: string,
) {
  let y = 105;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Zahlungserinnerung zu Rechnung Nr. ${number}`, PAGE.left, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const intro = doc.splitTextToSize(
    "Bei der Durchsicht unserer Unterlagen haben wir festgestellt, dass die unten genannte Rechnung noch nicht ausgeglichen ist. Falls Sie den Betrag bereits überwiesen haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.",
    PAGE.width,
  ) as string[];
  doc.text(intro, PAGE.left, y);
  y += intro.length * 4.2 + 6;

  const widths = [46, 42, 42, 44];
  const xs = widths.reduce<number[]>(
    (values, width) => [...values, values.at(-1)! + width],
    [PAGE.left],
  );
  const headers = ["Rechnungsnr.", "Rechnungsdatum", "Fällig am", "Offener Betrag"];
  doc.setFillColor(...COLORS.ink);
  doc.rect(PAGE.left, y, PAGE.width, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  headers.forEach((header, index) => doc.text(header, xs[index] + 2, y + 5.2));
  y += 8;
  doc.setTextColor(...COLORS.ink);
  doc.setFont("helvetica", "normal");
  [number, "wird nachgereicht", "wird nachgereicht", eur(effectivePrice(booking))].forEach(
    (value, index) => doc.text(value, xs[index] + 2, y + 6),
  );
  y += 12;
  doc.setDrawColor(...COLORS.ink);
  doc.line(112, y, PAGE.right, y);
  doc.setFont("helvetica", "bold");
  doc.text("Gesamt offen", 152, y + 6, { align: "right" });
  doc.text(eur(effectivePrice(booking)), PAGE.right, y + 6, { align: "right" });
  y += 17;

  doc.setFont("helvetica", "normal");
  doc.text(
    `Bitte überweisen Sie den offenen Betrag bis spätestens: ${deDate(documentDraft(booking)?.dueDate)}.`,
    PAGE.left,
    y,
  );
  y += 9;
  doc.setFont("helvetica", "bold");
  doc.text("Zahlungsinformationen", PAGE.left, y);
  doc.setFont("helvetica", "normal");
  [
    `Kontoinhaber: ${placeholder(company.bank.holder)}`,
    `IBAN: ${placeholder(company.bank.iban)}`,
    `BIC: ${placeholder(company.bank.bic)}`,
    "Bank: wird nachgereicht",
    `Verwendungszweck: Rechnungsnummer ${number}`,
  ].forEach((line, index) => doc.text(line, PAGE.left, y + 6 + index * 4.8));
  y += 35;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.warning);
  doc.text(
    "ENTWURF – Rechnungsdatum, Fälligkeit und Bankdaten vor Versand ergänzen.",
    PAGE.left,
    y,
  );
  doc.setTextColor(...COLORS.ink);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Sollten Sie bereits überwiesen haben oder Fragen zur Rechnung haben, melden Sie sich gerne.",
    PAGE.left,
    y + 8,
  );
  doc.text("Mit freundlichen Grüßen", PAGE.left, y + 17);
  doc.setFont("helvetica", "bold");
  doc.text(company.owner, PAGE.left, y + 22);
  doc.setFont("helvetica", "normal");
  doc.text(company.name, PAGE.left, y + 27);
}

function drawBookingDocument(
  doc: InstanceType<(typeof import("jspdf"))["jsPDF"]>,
  booking: Booking,
  kind: Extract<BookingDocumentKind, "request" | "confirmation" | "admin">,
  logo: string | null,
) {
  const { left: L, right: R, width: W } = PAGE;
  const number = documentNumber(booking, kind);
  drawHeader(doc, kind, number, logo, booking);
  let y = 62;
  const vehicle = vehicleTypes.find((item) => item.id === booking.vehicleId);
  const pkg = servicePackages.find((item) => item.id === booking.packageId);
  const pickup = booking.pickupCity ? getPickupCity(booking.pickupCity) : undefined;
  const items = calcLineItems(booking);
  const agreed = booking.agreedPrice ?? null;
  const shownPrice = effectivePrice(booking);

  doc.setDrawColor(...COLORS.line);
  doc.line(L, y, R, y);
  y += 8;
  doc.setFillColor(...COLORS.soft);
  doc.roundedRect(L, y, W, 34, 2, 2, "F");
  doc.setTextColor(...COLORS.ink);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.text("Kunde", L + 4, y + 6);
  doc.text("Termin & Fahrzeug", 108, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  [
    booking.customer.name,
    booking.customer.email,
    booking.customer.phone,
    `Kennzeichen: ${booking.customer.plate}`,
  ].forEach((line, index) => doc.text(line, L + 4, y + 12 + index * 4.6));
  [
    deDate(booking.date),
    vehicle?.name ?? booking.vehicleId,
    pkg?.name ?? booking.packageId,
    `Quelle: ${sourceLabel(booking.bookingSource)}`,
  ].forEach((line, index) => doc.text(line, 108, y + 12 + index * 4.6));
  y += 42;

  if (pickup) {
    doc.setTextColor(...COLORS.muted);
    doc.text(`Hol- & Bringservice: ${pickup.name} (${pickup.distanceKm} km)`, L, y);
    y += 7;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.ink);
  doc.text("Vorgesehene Leistungen", L, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  items.forEach((item) => {
    const label = doc.splitTextToSize(item.label, 125) as string[];
    doc.text(label, L + 2, y);
    doc.text(eur(item.total), R - 2, y, { align: "right" });
    y += Math.max(6, label.length * 4.4 + 1);
    doc.setDrawColor(...COLORS.line);
    doc.line(L, y - 2.5, R, y - 2.5);
  });

  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(agreed ? "Vereinbarter Gesamtpreis" : "Derzeitiger Gesamtpreis", 152, y, {
    align: "right",
  });
  doc.text(eur(shownPrice), R - 2, y, { align: "right" });
  y += 8;

  if (booking.depositAmount > 0) {
    const depositStatus =
      booking.depositStatus === "bezahlt"
        ? "bezahlt"
        : booking.depositStatus === "offen"
          ? "offen"
          : "nicht erforderlich";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      `Anzahlung (${Math.round(depositConfig.rate * 100)} %): ${eur(booking.depositAmount)} · ${depositStatus}`,
      L,
      y,
    );
    y += 8;
  }

  const noteLines = doc.splitTextToSize(priceNote(kind, agreed != null), W - 10) as string[];
  const noteHeight = Math.max(22, noteLines.length * 4.5 + 12);
  doc.setFillColor(...COLORS.soft);
  doc.roundedRect(L, y, W, noteHeight, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.ink);
  doc.text("Preisgrundlage", L + 5, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(...COLORS.muted);
  doc.text(noteLines, L + 5, y + 12);
  y += noteHeight + 8;

  if (kind === "admin") {
    doc.setDrawColor(...COLORS.line);
    doc.line(L, y, R, y);
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.ink);
    doc.text("Interner Bereich – Fahrzeugannahme", L, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    [
      "Fahrzeug angenommen am: __________________________________________",
      "Zusätzliche Feststellungen / Mängel: ________________________________",
      "____________________________________________________________________",
      "Zusatzaufwand abgestimmt:  ja / nein     Betrag: ____________________ €",
    ].forEach((line) => {
      doc.text(line, L, y);
      y += 7;
    });
  }
}

function addFooters(doc: JsPdfDocument, kind: BookingDocumentKind) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...COLORS.line);
    doc.line(PAGE.left, PAGE.footerY - 5, PAGE.right, PAGE.footerY - 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(125);
    doc.text(
      `${company.name} · ${company.owner} · ${company.street} · ${company.city}`,
      PAGE.left,
      PAGE.footerY,
    );
    const note =
      kind === "invoice-draft" || kind === "payment-reminder-draft"
        ? "ENTWURF · Kein Versand vor Vervollständigung"
        : kind === "admin" || kind === "request" || kind === "confirmation"
          ? "Auftrags-/Terminunterlage · Kein Steuerbeleg"
          : `Seite ${page} von ${pageCount}`;
    doc.text(note, PAGE.right, PAGE.footerY, { align: "right" });
  }
}

export async function createBookingDocumentPdfBytes(
  booking: Booking,
  kind: BookingDocumentKind,
): Promise<Uint8Array> {
  const doc = await buildDocument(booking, kind);
  return new Uint8Array(doc.output("arraybuffer"));
}

export async function downloadBookingDocumentPdf(
  booking: Booking,
  kind: BookingDocumentKind = "admin",
): Promise<void> {
  const doc = await buildDocument(booking, kind);
  doc.save(`${filenamePrefix(kind)}_${documentNumber(booking, kind)}.pdf`);
}

export async function printBookingDocumentPdf(
  booking: Booking,
  kind: BookingDocumentKind = "admin",
): Promise<void> {
  const bytes = await createBookingDocumentPdfBytes(booking, kind);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    URL.revokeObjectURL(url);
    throw new Error("Pop-up wurde blockiert. Bitte Pop-ups für den Admin-Bereich erlauben.");
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
