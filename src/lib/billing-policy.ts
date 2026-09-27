/** Bitrix24 owns accounting documents; only approved messages may leave the queue. */
export const CUSTOMER_MAIL_RESTRICTED = true;

export function assertLegacyBillingDisabled(): never {
  throw new Error("Aufträge und Rechnungen werden ausschließlich in Bitrix24 geführt.");
}

export function isApprovedCustomerNotification(
  key: string | null | undefined,
  event: string | null | undefined,
) {
  if (!key || !event) return false;
  // The website acknowledges receipt; native Bitrix owns later business decisions.
  // Old app/CRM confirmations and invoices must not leave a stale local queue.
  return key.includes(":customer-v2:email:") && event === "booking.created";
}

export function isOwnerNotification(
  key: string | null | undefined,
  event: string | null | undefined,
) {
  return Boolean(
    key?.includes(":owner:") || event === "notification.alert" || event === "booking.conflict",
  );
}
