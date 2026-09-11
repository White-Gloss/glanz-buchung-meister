/** Lexware owns accounting documents; approved customer messages use Resend. */
export const LEXWARE_ONLY = true;

export function assertLegacyBillingDisabled(): never {
  throw new Error(
    "Neue Rechnungen werden in Lexware geführt. Bitte den Rechnungs- und Versandbereich im Admin verwenden.",
  );
}

export function isApprovedCustomerNotification(
  key: string | null | undefined,
  event: string | null | undefined,
) {
  if (!key || !event) return false;
  return (
    (key.includes(":customer-v2:email:") &&
      [
        "booking.created",
        "booking.confirmed",
        "booking.rejected",
        "booking.cancelled",
        "booking.rescheduled",
        "booking.updated",
      ].includes(event)) ||
    (/^lexware-mail:v1:[a-f0-9-]{36}:(invoice|reminder)$/.test(key) &&
      ["lexware.invoice", "lexware.reminder"].includes(event))
  );
}

export function isOwnerNotification(
  key: string | null | undefined,
  event: string | null | undefined,
) {
  return Boolean(
    key?.includes(":owner:") || event === "notification.alert" || event === "booking.conflict",
  );
}
