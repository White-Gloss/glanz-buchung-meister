import { describe, expect, it } from "vitest";
import type { Booking } from "./bookings";
import { createBookingDocumentDraft, mergeBookingDocumentDraft } from "./bookingDocumentDraft";

const booking = {
  id: "booking-1",
  invoiceNumber: "WGD-2026-1001",
  date: "2026-08-20",
  customer: {
    name: "Max Mustermann",
    email: "max@example.de",
    phone: "0123456789",
    plate: "FDS-WG 1",
  },
} as Booking;

describe("bookingDocumentDraft", () => {
  it("übernimmt bearbeitbare Kundendaten aus der Buchung", () => {
    expect(createBookingDocumentDraft(booking)).toMatchObject({
      documentNumber: "",
      customerName: "Max Mustermann",
      customerCompany: "",
      customerStreet: "",
      customerCity: "",
      customerEmail: "max@example.de",
      customerPhone: "0123456789",
      customerPlate: "FDS-WG 1",
      serviceDate: "2026-08-20",
      validUntil: "",
      dueDate: "",
    });
  });

  it("wendet Änderungen auf eine PDF-Kopie an, ohne die Buchung zu verändern", () => {
    const draft = { ...createBookingDocumentDraft(booking), customerName: "Erika Musterfrau" };
    const edited = mergeBookingDocumentDraft(booking, draft);

    expect(edited.customer.name).toBe("Erika Musterfrau");
    expect(booking.customer.name).toBe("Max Mustermann");
  });
});
