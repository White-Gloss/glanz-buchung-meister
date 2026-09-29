export type CustomerAddressFields = {
  customer_street?: string | null;
  customer_postal_code?: string | null;
  customer_city?: string | null;
};

/** "Musterweg 1, 72160 Horb am Neckar", or "" for requests recorded without address. */
export function customerAddress(row: CustomerAddressFields) {
  const place = [row.customer_postal_code, row.customer_city].filter(Boolean).join(" ");
  return [row.customer_street, place].filter(Boolean).join(", ");
}
