import { describe, expect, it } from "vitest";
import type { Booking, BookingStatus } from "./bookings";
import { filterAndSortBookings } from "./adminBookingView";

function booking(input: {
  id: string;
  status: BookingStatus;
  date: string;
  createdAt: string;
  name?: string;
}): Booking {
  return {
    id: input.id,
    invoiceNumber: `WG-${input.id}`,
    createdAt: input.createdAt,
    vehicleId: "kleinwagen",
    packageId: "basis",
    addOnIds: [],
    date: input.date,
    time: null,
    pickupCity: null,
    customer: {
      name: input.name ?? input.id,
      email: `${input.id}@example.de`,
      phone: "0123456789",
      plate: `H-${input.id}`,
    },
    preferredContact: "Telefon",
    total: 100,
    agreedPrice: null,
    offerNote: null,
    offerAltDates: [],
    status: input.status,
    isNewCustomer: false,
    depositAmount: 0,
    depositStatus: "nicht_erforderlich",
    accessToken: input.id,
  };
}

const rows = [
  booking({ id: "paid", status: "Bezahlt", date: "2026-08-20", createdAt: "2026-08-10T10:00:00Z" }),
  booking({
    id: "waiting-old",
    status: "Wartend auf Prüfung",
    date: "2026-08-22",
    createdAt: "2026-08-11T10:00:00Z",
  }),
  booking({
    id: "waiting-new",
    status: "Wartend auf Prüfung",
    date: "2026-08-21",
    createdAt: "2026-08-12T10:00:00Z",
  }),
  booking({
    id: "confirmed",
    status: "Bestätigt",
    date: "2026-08-19",
    createdAt: "2026-08-09T10:00:00Z",
  }),
];

describe("filterAndSortBookings", () => {
  it("zeigt bei Priorität zuerst neue Prüfungen, danach aktive Termine", () => {
    expect(
      filterAndSortBookings(rows, { query: "", status: "alle", sort: "prioritaet" }).map(
        (b) => b.id,
      ),
    ).toEqual(["waiting-new", "waiting-old", "confirmed", "paid"]);
  });

  it("kombiniert Statusfilter und Suche", () => {
    expect(
      filterAndSortBookings(rows, {
        query: "waiting-old",
        status: "Wartend auf Prüfung",
        sort: "eingang-neu",
      }).map((b) => b.id),
    ).toEqual(["waiting-old"]);
  });

  it("sortiert Termine chronologisch", () => {
    expect(
      filterAndSortBookings(rows, { query: "", status: "alle", sort: "termin" }).map((b) => b.id),
    ).toEqual(["confirmed", "paid", "waiting-new", "waiting-old"]);
  });

  it("sortiert Eingänge auch dann, wenn der Server Zeitstempel als Date liefert", () => {
    const dateRows = rows.map((row) => ({
      ...row,
      createdAt: new Date(row.createdAt),
    })) as unknown as Booking[];

    expect(
      filterAndSortBookings(dateRows, { query: "", status: "alle", sort: "eingang-neu" }).map(
        (b) => b.id,
      ),
    ).toEqual(["waiting-new", "waiting-old", "paid", "confirmed"]);
  });
});
