import { describe, expect, it } from "vitest";

import { bookingNotifyText, conditionReportNotifyText } from "./notifyTexts";
import type { Booking } from "./bookings";

/**
 * Die beiden Regeln, an denen der Versand sonst still scheitert:
 *
 * 1. Eine Meta-Vorlagenvariable darf KEINE Zeilenumbrüche und keine doppelten
 *    Leerzeichen enthalten. Verstößt der Text dagegen, weist die
 *    Schnittstelle die Nachricht ab — und der Betrieb merkt es nicht.
 * 2. Kontaktdaten der Kundschaft gehören nicht hinein.
 */

const basis: Booking = {
  id: "11111111-1111-4111-8111-111111111111",
  invoiceNumber: "WGD-2026-1001",
  createdAt: "2026-08-17T08:00:00.000Z",
  date: "2026-09-03",
  status: "Angefragt",
  vehicleId: "suv",
  packageId: "premium",
  addOnIds: [],
  total: 436.25,
  agreedPrice: null,
  offerNote: "",
  depositPaid: false,
  pickupCity: null,
  preferredContact: "E-Mail",
  accessToken: "token",
  customer: {
    name: "Max Mustermann",
    email: "max@example.de",
    phone: "0170 1234567",
    plate: "FDS-XY 123",
  },
} as unknown as Booking;

describe("bookingNotifyText", () => {
  it("enthält Vorgangsnummer, Name und Wunschtermin", () => {
    const text = bookingNotifyText(basis);
    expect(text).toContain("WGD-2026-1001");
    expect(text).toContain("Max Mustermann");
    expect(text).toContain("03.09.2026");
  });

  it("nennt weder E-Mail-Adresse noch Telefonnummer", () => {
    const text = bookingNotifyText(basis);
    expect(text).not.toContain("max@example.de");
    expect(text).not.toContain("0170");
  });

  it("kommt ohne Zeilenumbruch und ohne doppeltes Leerzeichen aus", () => {
    const text = bookingNotifyText({ ...basis, pickupCity: "Nagold" } as Booking);
    expect(text).not.toMatch(/\n/);
    expect(text).not.toMatch(/ {2}/);
  });

  it("lässt die Abholung weg, wenn keine gewünscht ist", () => {
    expect(bookingNotifyText(basis)).not.toContain("Abholung");
  });
});

describe("conditionReportNotifyText", () => {
  it("zählt Aufnahmen im Singular und Plural richtig", () => {
    expect(conditionReportNotifyText({ name: "A", vehicle: "Golf", photoCount: 1 })).toContain(
      "1 Aufnahme",
    );
    expect(conditionReportNotifyText({ name: "A", vehicle: "Golf", photoCount: 3 })).toContain(
      "3 Aufnahmen",
    );
    expect(conditionReportNotifyText({ name: "A", vehicle: "Golf", photoCount: 0 })).toContain(
      "ohne Aufnahmen",
    );
  });

  it("fällt bei fehlendem Fahrzeug auf einen Hinweis zurück", () => {
    expect(conditionReportNotifyText({ name: "A", vehicle: "", photoCount: 2 })).toContain(
      "Fahrzeug nicht angegeben",
    );
  });

  it("kommt ohne Zeilenumbruch aus", () => {
    expect(
      conditionReportNotifyText({ name: "A B", vehicle: "VW  Golf", photoCount: 2 }),
    ).not.toMatch(/\n| {2}/);
  });
});
