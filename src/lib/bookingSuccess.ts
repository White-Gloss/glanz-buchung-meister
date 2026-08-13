import { buildThankYouSearch } from "./thankYou";

type BookingReference = {
  invoiceNumber: string;
  customerName: string;
};

export async function navigateAfterBooking(
  booking: BookingReference,
  navigate: (href: string) => Promise<unknown>,
  hardRedirect: (href: string) => void,
): Promise<void> {
  const href = `/danke${buildThankYouSearch(booking)}`;
  try {
    await navigate(href);
  } catch (error) {
    console.error("[Buchung] Router-Weiterleitung fehlgeschlagen", error);
    hardRedirect(href);
  }
}
