/** Deployment switch for the clean RO workflow. Never expose credentials to UI. */
export function roappOnlyEnabled(): boolean {
  return process.env.BOOKING_OPERATIONS === "roapp";
}

/**
 * Deployment switch for Bitrix24 as the sole operating system. Bookings are
 * transferred only to Bitrix24; RO, Zoho, Odoo, Lexware and the note hub
 * receive nothing. Off unless explicitly set by the owner during cutover.
 */
export function bitrixOnlyEnabled(): boolean {
  return process.env.BOOKING_OPERATIONS === "bitrix";
}
