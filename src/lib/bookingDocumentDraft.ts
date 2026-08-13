import type { Booking } from "./bookings";

export type BookingDocumentDraft = {
  documentNumber: string;
  customerName: string;
  customerCompany: string;
  customerStreet: string;
  customerCity: string;
  customerEmail: string;
  customerPhone: string;
  customerPlate: string;
  serviceDate: string;
  agreedPrice: string;
  validUntil: string;
  dueDate: string;
};

export type BookingWithDocumentDraft = Booking & { documentDraft?: BookingDocumentDraft };

export function createBookingDocumentDraft(booking: Booking): BookingDocumentDraft {
  return {
    documentNumber: "",
    customerName: booking.customer.name,
    customerCompany: "",
    customerStreet: "",
    customerCity: "",
    customerEmail: booking.customer.email,
    customerPhone: booking.customer.phone,
    customerPlate: booking.customer.plate,
    serviceDate: booking.date,
    agreedPrice: String(booking.agreedPrice ?? booking.total),
    validUntil: "",
    dueDate: "",
  };
}

export function mergeBookingDocumentDraft(
  booking: Booking,
  draft: BookingDocumentDraft,
): BookingWithDocumentDraft {
  const price = Number(draft.agreedPrice.replace(",", "."));
  return {
    ...booking,
    invoiceNumber: draft.documentNumber.trim() || booking.invoiceNumber,
    date: draft.serviceDate || booking.date,
    agreedPrice: Number.isFinite(price) && price > 0 ? price : booking.agreedPrice,
    customer: {
      ...booking.customer,
      name: draft.customerName.trim() || booking.customer.name,
      email: draft.customerEmail.trim() || booking.customer.email,
      phone: draft.customerPhone.trim() || booking.customer.phone,
      plate: draft.customerPlate.trim().toUpperCase() || booking.customer.plate,
    },
    documentDraft: draft,
  };
}

export function bookingDocumentDraftStorageKey(bookingId: string): string {
  return `white-gloss:document-draft:${bookingId}`;
}
