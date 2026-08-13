type ThankYouBooking = {
  invoiceNumber: string;
  customerName: string;
};

/** Nur Referenz und Vorname: keine Kontaktdaten in der URL speichern. */
export function buildThankYouSearch({ invoiceNumber, customerName }: ThankYouBooking): string {
  const reference = String(invoiceNumber ?? "").trim();
  const firstName = String(customerName ?? "")
    .trim()
    .split(/\s+/)[0];
  const params = new URLSearchParams();
  if (reference) params.set("nr", reference);
  if (firstName) params.set("name", firstName);
  const query = params.toString();
  return query ? `?${query}` : "";
}
