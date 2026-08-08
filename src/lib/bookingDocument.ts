import { calcLineItems, type Booking } from "./bookings";
import { company, depositConfig, servicePackages, vehicleTypes } from "./servicesConfig";
import { getPickupCity } from "./pickupLocations";

export type BookingDocumentKind = "request" | "confirmation" | "admin";

const eur = (value: number) =>
  new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + " EUR";

function deDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
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
  if (kind === "confirmation") return "Terminbestätigung";
  if (kind === "admin") return "Auftragsunterlagen";
  return "Terminanfrage / Auftragsübersicht";
}

function priceNote(kind: BookingDocumentKind) {
  if (kind === "confirmation" || kind === "admin") {
    return (
      "Der vereinbarte Preis wurde auf Grundlage Ihrer Angaben und – sofern vorhanden – der " +
      "übermittelten Fotos festgelegt. Sollten bei der Fahrzeugannahme zusätzliche Verschmutzungen, " +
      "Mängel oder ein deutlich abweichender Fahrzeugzustand festgestellt werden, die vorab nicht " +
      "erkennbar waren, kann sich der erforderliche Aufwand ändern. Selbstverständlich stimmen wir " +
      "eine mögliche Preisanpassung vor Beginn zusätzlicher Arbeiten transparent mit Ihnen ab."
    );
  }
  return (
    "Der derzeit angegebene Preis basiert auf Ihren Angaben und – sofern vorhanden – den " +
    "übermittelten Fotos. Die verbindliche Preisvereinbarung erfolgt mit der Terminbestätigung. " +
    "Sollte der Fahrzeugzustand vor Ort deutlich von den vorab übermittelten Angaben abweichen, " +
    "sprechen wir eine mögliche Anpassung selbstverständlich vor Beginn der Arbeiten mit Ihnen ab."
  );
}

async function buildDocument(booking: Booking, kind: BookingDocumentKind) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 18;
  const R = 192;
  const W = R - L;
  let y = 20;
  const vehicle = vehicleTypes.find((item) => item.id === booking.vehicleId);
  const pkg = servicePackages.find((item) => item.id === booking.packageId);
  const pickup = booking.pickupCity ? getPickupCity(booking.pickupCity) : undefined;
  const items = calcLineItems(booking);
  const agreed = booking.agreedPrice ?? null;
  const shownPrice = agreed ?? booking.total;

  const text = (value: string, x: number, atY: number, options?: Parameters<typeof doc.text>[3]) =>
    doc.text(value, x, atY, options);

  const wrapped = (value: string, width: number) => doc.splitTextToSize(value, width) as string[];

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(18);
  text(company.name.toUpperCase(), L, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(105);
  text(company.claim, L, y + 5);

  doc.setFontSize(8.5);
  doc.setTextColor(60);
  [company.owner, company.street, company.city, company.phone, company.email, company.web].forEach(
    (line, index) => text(line, R, y - 3 + index * 4.2, { align: "right" }),
  );

  y += 30;
  doc.setDrawColor(215);
  doc.line(L, y, R, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20);
  text(titleFor(kind), L, y);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  text(`Buchungsnummer ${booking.invoiceNumber}`, R, y, { align: "right" });
  y += 10;

  // Customer / booking meta
  doc.setFillColor(247, 247, 248);
  doc.roundedRect(L, y, W, 34, 2, 2, "F");
  doc.setTextColor(25);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  text("Kunde", L + 4, y + 6);
  text("Termin & Fahrzeug", 108, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  [
    booking.customer.name,
    booking.customer.email,
    booking.customer.phone,
    `Kennzeichen: ${booking.customer.plate}`,
  ].forEach((line, index) => text(line, L + 4, y + 12 + index * 4.6));
  [
    `${deDate(booking.date)}, ${booking.time} Uhr`,
    vehicle?.name ?? booking.vehicleId,
    pkg?.name ?? booking.packageId,
    `Quelle: ${sourceLabel(booking.bookingSource)}`,
  ].forEach((line, index) => text(line, 108, y + 12 + index * 4.6));
  y += 42;

  if (pickup) {
    doc.setFontSize(9);
    doc.setTextColor(65);
    text(`Hol- & Bringservice: ${pickup.name} (${pickup.distanceKm} km)`, L, y);
    y += 7;
  }

  // Services
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  text("Vorgesehene Leistungen", L, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  items.forEach((item) => {
    const label = wrapped(item.label, 125);
    text(label, L + 2, y);
    text(eur(item.total), R - 2, y, { align: "right" });
    y += Math.max(6, label.length * 4.4 + 1);
    doc.setDrawColor(235);
    doc.line(L, y - 2.5, R, y - 2.5);
  });

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  text(agreed ? "Vereinbarter Gesamtpreis" : "Derzeitiger Gesamtpreis", 128, y, { align: "right" });
  text(eur(shownPrice), R - 2, y, { align: "right" });
  y += 8;

  if (booking.depositAmount > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(75);
    const depositStatus =
      booking.depositStatus === "bezahlt"
        ? "bereits bezahlt"
        : booking.depositStatus === "offen"
          ? "offen"
          : "nicht erforderlich";
    text(
      `Anzahlung (${Math.round(depositConfig.rate * 100)} %): ${eur(booking.depositAmount)} · ${depositStatus}`,
      L,
      y,
    );
    y += 8;
  }

  // Price basis note
  doc.setFillColor(250, 250, 250);
  const noteLines = wrapped(priceNote(kind), W - 10);
  const noteHeight = Math.max(24, noteLines.length * 4.5 + 13);
  doc.roundedRect(L, y, W, noteHeight, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(35);
  text("Preisgrundlage", L + 5, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(70);
  text(noteLines, L + 5, y + 12);
  y += noteHeight + 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.7);
  doc.setTextColor(70);
  const paymentLines = wrapped(
    "Die Endabrechnung erfolgt erst nach dem Termin. Die Zahlung kann bei Fahrzeugübergabe bar erfolgen oder – sofern vereinbart – per Rechnung innerhalb von 7 Tagen. Eine bereits geleistete Anzahlung wird bei der Endabrechnung berücksichtigt.",
    W,
  );
  text(paymentLines, L, y);
  y += paymentLines.length * 4.5 + 6;

  if (kind === "admin") {
    if (y > 220) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(210);
    doc.line(L, y, R, y);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(25);
    text("Interner Bereich – Fahrzeugannahme", L, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(70);
    [
      "Fahrzeug angenommen am: __________________________________________",
      "Zusätzliche Feststellungen / Mängel: ________________________________",
      "____________________________________________________________________",
      "Zusatzaufwand mit Kunde abgestimmt:  ja / nein     Betrag: __________ EUR",
      "Kundenfreigabe / Vermerk: ___________________________________________",
    ].forEach((line) => {
      text(line, L, y);
      y += 7;
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const footY = 282;
    doc.setDrawColor(225);
    doc.line(L, footY - 5, R, footY - 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(125);
    text(`${company.name} · ${company.owner} · ${company.street} · ${company.city}`, L, footY);
    text("Auftrags-/Terminunterlage · Kein Rechnungs- oder Steuerbeleg", R, footY, {
      align: "right",
    });
  }

  return doc;
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
  const prefix = kind === "confirmation" ? "Terminbestaetigung" : kind === "request" ? "Terminanfrage" : "Auftragsunterlagen";
  doc.save(`${prefix}_${booking.invoiceNumber}.pdf`);
}

export async function printBookingDocumentPdf(booking: Booking): Promise<void> {
  const bytes = await createBookingDocumentPdfBytes(booking, "admin");
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    URL.revokeObjectURL(url);
    throw new Error("Pop-up wurde blockiert. Bitte Pop-ups für den Admin-Bereich erlauben.");
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
