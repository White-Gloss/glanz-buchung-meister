/** Deployment switch for the clean RO workflow. Never expose credentials to UI. */
export function roappOnlyEnabled(): boolean {
  return process.env.BOOKING_OPERATIONS === "roapp";
}
