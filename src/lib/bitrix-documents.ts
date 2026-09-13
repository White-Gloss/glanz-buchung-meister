/** Values for the owner-approved DOCX templates. Money is always integer cents. */
export type ReviewedLine = { description: string; quantity: number; unitNetCents: number };
export type ReviewedDocument = {
  reference: string;
  issuedOn: string;
  customer: { name: string; address: string; email: string; phone: string };
  vehicle: string;
  plate: string;
  lines: ReviewedLine[];
  agreedGrossCents: number;
  notes: string;
};
export type ConfirmedDocument = ReviewedDocument & {
  kind: "confirmation";
  start: string;
  end: string;
  location: string;
};
export type InvoiceDocument = ReviewedDocument & {
  kind: "invoice";
  invoiceNumber: string;
  serviceDate: string;
  payment: { method: "transfer" } | { method: "cash"; amountCents: number; paidOn: string };
  bank: { name: string; iban: string; bic: string };
  taxIdentification?: string;
};

function required(value: string, name: string, max = 2000) {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[{}]/.test(value))
    throw new Error(`document_invalid_${name}`);
  return value.trim();
}

function cents(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100_000_000)
    throw new Error("document_invalid_amount");
  return value;
}

export function invoiceDueDate(issuedOn: string) {
  const date = calendarDate(issuedOn);
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("document_invalid_date");
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new Error("document_invalid_date");
  return date;
}

function displayDate(value: string) {
  return calendarDate(value).toLocaleDateString("de-DE", { timeZone: "UTC" });
}

function timestamp(value: string) {
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))
    throw new Error("document_invalid_time");
  return new Date(value);
}

export function documentTotals(lines: ReviewedLine[]) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 100)
    throw new Error("document_invalid_lines");
  const net = lines.reduce((sum, line) => {
    required(line.description, "line", 2000);
    if (
      !Number.isFinite(line.quantity) ||
      line.quantity <= 0 ||
      line.quantity > 10000 ||
      Math.abs(line.quantity * 1000 - Math.round(line.quantity * 1000)) > 0.00001
    )
      throw new Error("document_invalid_quantity");
    return cents(sum + Math.round(line.quantity * cents(line.unitNetCents)));
  }, 0);
  const vat = Math.round((net * 19) / 100);
  return { net, vat, gross: cents(net + vat) };
}

const euro = (n: number) =>
  (n / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export function bitrixDocumentPayload(
  input: ConfirmedDocument | InvoiceDocument,
  templateId: number,
  documentKey: string,
) {
  if (!Number.isSafeInteger(templateId) || templateId <= 0)
    throw new Error("document_invalid_template");
  const totals = documentTotals(input.lines);
  if (totals.gross !== cents(input.agreedGrossCents)) throw new Error("document_total_mismatch");
  const values: Record<string, unknown> = {
    WGReference: required(input.reference, "reference", 100),
    WGIssuedOn: displayDate(input.issuedOn),
    WGCustomerName: required(input.customer.name, "customer", 200),
    WGCustomerAddress: required(input.customer.address, "address", 1000),
    WGCustomerEmail: required(input.customer.email, "email", 254),
    WGCustomerPhone: required(input.customer.phone, "phone", 50),
    WGVehicle: required(input.vehicle, "vehicle", 300),
    WGPlate: input.plate.trim() || "Nicht angegeben",
    WGNotes: input.notes.trim() || "Keine weiteren Hinweise.",
    WGNetTotal: euro(totals.net),
    WGVatTotal: euro(totals.vat),
    WGGrossTotal: euro(totals.gross),
    WGItems: input.lines.map((line) => ({
      Description: line.description,
      Quantity: line.quantity.toLocaleString("de-DE"),
      UnitNet: euro(line.unitNetCents),
      LineNet: euro(Math.round(line.quantity * line.unitNetCents)),
    })),
    WGServiceLines: "WGItems.Item.Description",
    Qty: "WGItems.Item.Quantity",
    UnitNet: "WGItems.Item.UnitNet",
    LineNet: "WGItems.Item.LineNet",
  };
  if (input.kind === "confirmation") {
    const start = timestamp(input.start),
      end = timestamp(input.end);
    const minutes = (end.getTime() - start.getTime()) / 60000;
    if (!Number.isInteger(minutes) || minutes <= 0) throw new Error("document_invalid_interval");
    const format = (date: Date) =>
      date.toLocaleString("de-DE", {
        timeZone: "Europe/Berlin",
        dateStyle: "medium",
        timeStyle: "short",
      });
    Object.assign(values, {
      WGStart: format(start),
      WGEnd: format(end),
      WGDuration: `${Math.floor(minutes / 60)} Std. ${minutes % 60} Min.`,
      WGLocation: required(input.location, "location", 1000),
    });
  } else {
    const due = invoiceDueDate(input.issuedOn);
    let paymentText: string;
    if (input.payment.method === "cash") {
      const received = cents(input.payment.amountCents);
      if (!received || received > totals.gross) throw new Error("document_invalid_cash");
      if (calendarDate(input.payment.paidOn) > calendarDate(input.issuedOn))
        throw new Error("document_future_payment");
      paymentText =
        `Barzahlung am ${displayDate(input.payment.paidOn)}: ${euro(received)}. ` +
        (received === totals.gross
          ? "Vollständig bezahlt."
          : `Offener Restbetrag: ${euro(totals.gross - received)}.`);
    } else {
      paymentText = `Bitte überweise ${euro(totals.gross)} bis zum ${displayDate(due)} auf das unten angegebene Konto. Zahlungsziel: sieben Kalendertage ab Rechnungsdatum.`;
    }
    Object.assign(values, {
      WGInvoiceNumber: required(input.invoiceNumber, "invoice_number", 100),
      WGServiceDate: displayDate(input.serviceDate),
      WGPaymentText: paymentText,
      WGPaymentReference: required(input.invoiceNumber, "invoice_number", 100),
      WGTaxIdentification: input.taxIdentification?.trim() || "",
      WGBankName: required(input.bank.name, "bank", 200),
      WGIban: required(input.bank.iban, "iban", 40),
      WGBic: required(input.bank.bic, "bic", 20),
    });
  }
  return {
    templateId,
    providerClassName: "Bitrix\\DocumentGenerator\\DataProvider\\Rest",
    value: required(documentKey, "key", 150),
    values,
    fields: {
      WGItems: {
        PROVIDER: "Bitrix\\DocumentGenerator\\DataProvider\\ArrayDataProvider",
        OPTIONS: {
          ITEM_NAME: "Item",
          ITEM_PROVIDER: "Bitrix\\DocumentGenerator\\DataProvider\\HashDataProvider",
        },
      },
    },
    stampsEnabled: false,
  };
}
