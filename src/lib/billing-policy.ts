import { approvedRoLifecycleMessage } from "./roapp-lifecycle.ts";
import { approvedRoInvoiceMessage } from "./roapp-invoice.ts";
import { isWithdrawalCustomerMessage } from "./withdrawal-policy.ts";
/** The selected CRM owns accounting documents; only approved messages leave the queue. */
export const CUSTOMER_MAIL_RESTRICTED = true;

export function assertLegacyBillingDisabled(): never {
  throw new Error("Aufträge und Rechnungen werden ausschließlich im angeschlossenen CRM geführt.");
}

export function isApprovedCustomerNotification(
  key: string | null | undefined,
  event: string | null | undefined,
) {
  if (!key || !event) return false;
  if (approvedRoLifecycleMessage(key, event) || approvedRoInvoiceMessage(key, event)) return true;
  // § 356a BGB: the receipt confirmation of an online withdrawal is mandatory.
  if (isWithdrawalCustomerMessage(key, event)) return true;
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
