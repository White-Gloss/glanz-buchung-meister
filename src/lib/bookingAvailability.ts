/** Online-Termine sind nur Montag bis Freitag möglich. Samstage werden ausschließlich persönlich per WhatsApp abgestimmt. */
export function isOnlineBookingDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

/** Prüft ein ISO-Datum ohne Zeitzonenverschiebung im Browser oder auf dem Server. */
export function isOnlineBookingDate(isoDate: string): boolean {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return false;
  return isOnlineBookingDay(new Date(year, month - 1, day));
}
