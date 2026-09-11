import { site } from "../data/site.ts";
import { isEmailAddress } from "./utils.ts";
import type { Sql } from "./db.ts";

export const OUTBOUND_QUEUED = "queued";
export const OUTBOUND_SENT = "sent";
export const OUTBOUND_FAILED = "failed";

export type BookingLite = {
  id: number;
  customer_name: string;
  email?: string | null;
  phone: string;
  package_id: string;
  preferred_date?: string | null;
  preferred_slot?: string | null;
  status?: string;
  version?: number;
  note?: string | null;
};
export type QueueTarget = { channel: "email" | "whatsapp" | "telegram"; to: string };

export async function safeExec(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch {
    console.error(
      `[ops:${label}] Nebenprozess fehlgeschlagen; keine Verbindungsdetails protokolliert.`,
    );
  }
}

export function ownerNotifyTargets(): {
  email: string | null;
  whatsapp: string | null;
  telegram: string | null;
} {
  const email = (process.env.OWNER_EMAIL || site.email).trim();
  return {
    email: isEmailAddress(email) ? email : null,
    whatsapp:
      (process.env.ADMIN_WHATSAPP_NUMBER || process.env.OWNER_WHATSAPP || "").trim() || null,
    telegram: (process.env.OWNER_TELEGRAM || "").trim() || null,
  };
}

export function resolveOwnerNotifyRecipients(booking: BookingLite): QueueTarget[] {
  const owner = ownerNotifyTargets();
  const targets: QueueTarget[] = [];
  if (owner.whatsapp) targets.push({ channel: "whatsapp", to: owner.whatsapp });
  if (owner.telegram) targets.push({ channel: "telegram", to: owner.telegram });
  if (owner.email) targets.push({ channel: "email", to: owner.email });
  return targets.filter((target) => target.to !== booking.phone);
}

export function resolveCustomerConfirmRecipients(booking: BookingLite): QueueTarget[] {
  return isEmailAddress(booking.email) ? [{ channel: "email", to: booking.email.trim() }] : [];
}

export { berlinCalendarDate } from "./calendar-date.ts";
export function berlinMinutesSinceMidnight(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return (
    Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 +
    Number(parts.find((part) => part.type === "minute")?.value ?? 0)
  );
}

/** Compatibility entry point; all channels now share the durable dispatcher. */
export async function flushOutboundEmailQueue(sql: Sql, limit = 20) {
  const { runNotificationWorker } = await import("./notification-worker.ts");
  return runNotificationWorker(sql, { limit });
}
