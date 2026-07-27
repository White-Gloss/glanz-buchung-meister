import { jsPDF } from "jspdf";
import { calcLineItems, calcTotals, type Booking } from "./bookings";
import { company, servicePackages, taxConfig, vehicleTypes } from "./servicesConfig";

const eur = (v: number) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) +
  " EUR";

const deDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("de-DE");
};

export function generateInvoicePdf(booking: Booking) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const items = calcLineItems(booking);
  const { gross, net, vat } = calcTotals(items);
  const L = 20;
  const R = 190;
  let y = 22;

  // Kopf
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(company.name.toUpperCase(), L, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(company.claim, L, y + 5);

  doc.setFontSize(9);
  doc.setTextColor(60);
  const headRight = [
    company.owner,
    company.street,
    company.city,
    company.phone,
    company.email,
    company.web,
  ];
  headRight.forEach((line, i) => doc.text(line, R, y - 4 + i * 4.5, { align: "right" }));

  y += 30;
  doc.setDrawColor(210);
  doc.line(L, y, R, y);

  // Empfänger
  y += 10;
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text(`${company.name} · ${company.street} · ${company.city}`, L, y);
  y += 8;
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.text("Rechnungsempfänger", L, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y += 6;
  [
    booking.customer.name,
    booking.customer.email,
    booking.customer.phone,
    `Kennzeichen: ${booking.customer.plate}`,
  ].forEach((line, i) => doc.text(line, L, y + i * 5));

  // Rechnungsdaten
  const meta: [string, string][] = [
    ["Rechnungsnummer", booking.invoiceNumber],
    ["Rechnungsdatum", deDate(booking.createdAt)],
    ["Leistungsdatum", `${deDate(booking.date)}, ${booking.time} Uhr`],
    ["Kundennummer", booking.id.slice(0, 8).toUpperCase()],
  ];
  meta.forEach(([k, v], i) => {
    doc.setTextColor(120);
    doc.text(k, 130, y + i * 5);
    doc.setTextColor(20);
    doc.text(v, R, y + i * 5, { align: "right" });
  });

  y += 32;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20);
  doc.text(`Rechnung ${booking.invoiceNumber}`, L, y);

  // Tabelle
  y += 10;
  doc.setFillColor(15, 15, 18);
  doc.rect(L, y - 5.5, R - L, 8, "F");
  doc.setTextColor(255);
  doc.setFontSize(9);
  doc.text("Pos.", L + 2, y);
  doc.text("Leistung", L + 14, y);
  doc.text("Menge", 130, y, { align: "right" });
  doc.text("Einzelpreis", 158, y, { align: "right" });
  doc.text("Gesamt", R - 2, y, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30);
  y += 9;
  items.forEach((item, i) => {
    doc.text(String(i + 1), L + 2, y);
    doc.text(doc.splitTextToSize(item.label, 80) as string[], L + 14, y);
    doc.text(String(item.qty), 130, y, { align: "right" });
    doc.text(eur(item.unit), 158, y, { align: "right" });
    doc.text(eur(item.total), R - 2, y, { align: "right" });
    y += 7;
    doc.setDrawColor(232);
    doc.line(L, y - 3, R, y - 3);
  });

  // Summen
  y += 4;
  const sums: [string, string, boolean][] = taxConfig.smallBusiness
    ? [["Gesamtbetrag", eur(gross), true]]
    : [
        ["Nettobetrag", eur(net), false],
        [`zzgl. ${Math.round(taxConfig.vatRate * 100)} % MwSt.`, eur(vat), false],
        ["Gesamtbetrag (brutto)", eur(gross), true],
      ];

  sums.forEach(([k, v, bold]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 10);
    doc.text(k, 140, y, { align: "right" });
    doc.text(v, R - 2, y, { align: "right" });
    y += 6.5;
  });

  // Hinweise
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  if (taxConfig.smallBusiness) {
    doc.text(doc.splitTextToSize(taxConfig.smallBusinessNote, 170) as string[], L, y);
    y += 10;
  }
  doc.text(doc.splitTextToSize(taxConfig.paymentTerms, 170) as string[], L, y);
  y += 10;
  doc.text("Vielen Dank für Ihr Vertrauen.", L, y);

  // Fuß
  const footY = 275;
  doc.setDrawColor(220);
  doc.line(L, footY - 6, R, footY - 6);
  doc.setFontSize(7.5);
  doc.setTextColor(130);
  doc.text(`${company.name} · ${company.owner} · ${company.street} · ${company.city}`, L, footY);
  doc.text(`Steuernummer: ${company.taxNumber} · USt-IdNr.: ${company.taxId}`, L, footY + 4);
  doc.text(
    `Bank: ${company.bank.holder} · IBAN ${company.bank.iban} · BIC ${company.bank.bic}`,
    L,
    footY + 8,
  );

  doc.save(`Rechnung_${booking.invoiceNumber}.pdf`);
}

export function bookingSummary(booking: Booking) {
  const vehicle = vehicleTypes.find((v) => v.id === booking.vehicleId);
  const pkg = servicePackages.find((p) => p.id === booking.packageId);
  return { vehicle, pkg };
}
