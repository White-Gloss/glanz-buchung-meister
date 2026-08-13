import type { Booking, BookingStatus } from "./bookings";

export type BookingStatusFilter = "alle" | BookingStatus;
export type BookingSort = "prioritaet" | "eingang-neu" | "termin" | "preis-hoch";

const statusPriority: Record<BookingStatus, number> = {
  "Wartend auf Prüfung": 0,
  "Gegenangebot gesendet": 1,
  Bestätigt: 2,
  Ausstehend: 3,
  Bezahlt: 4,
  Storniert: 5,
};

function compareCreatedAtNewestFirst(a: Booking, b: Booking): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function filterAndSortBookings(
  bookings: Booking[],
  options: { query: string; status: BookingStatusFilter; sort: BookingSort },
): Booking[] {
  const query = options.query.trim().toLocaleLowerCase("de-DE");

  return bookings
    .filter((booking) => options.status === "alle" || booking.status === options.status)
    .filter((booking) => {
      if (!query) return true;
      return [
        booking.invoiceNumber,
        booking.customer.name,
        booking.customer.plate,
        booking.customer.email,
        booking.customer.phone,
      ]
        .join(" ")
        .toLocaleLowerCase("de-DE")
        .includes(query);
    })
    .sort((a, b) => {
      if (options.sort === "termin") return a.date.localeCompare(b.date);
      if (options.sort === "preis-hoch") return b.total - a.total;
      if (options.sort === "eingang-neu") return compareCreatedAtNewestFirst(a, b);

      const priority = statusPriority[a.status] - statusPriority[b.status];
      if (priority !== 0) return priority;
      if (a.status === "Wartend auf Prüfung") return compareCreatedAtNewestFirst(a, b);
      return a.date.localeCompare(b.date);
    });
}
