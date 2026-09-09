import { randomUUID, timingSafeEqual } from "node:crypto";
import type { Sql } from "./db.ts";
import {
  enqueueNotification,
  queueBookingReminder,
  type NotificationBooking,
} from "./booking-notifications.ts";
import { ownerNotifyTargets } from "./ops.ts";
import { EmailDeliveryError, mailConfigured, sendResendEmail } from "./resend-mail.ts";
import {
  sendWhatsAppNotification,
  validateWhatsAppConfiguration,
  WhatsAppDeliveryError,
} from "./whatsapp-provider.ts";

const SHOP = "white-gloss";
export const MAX_DELIVERY_ATTEMPTS = 6;
const IDEMPOTENCY_WINDOW_MS = 23 * 60 * 60 * 1000;

export type OutboundMessage = {
  id: number;
  channel: string;
  to_addr: string | null;
  subject: string | null;
  body: string;
  attachments?: { filename: string; content: string; content_type: string }[];
  event_key: string;
  event_type: string | null;
  booking_id: number | null;
  booking_version: number | null;
  from_addr: string | null;
  attempt_count: number;
  first_attempt_at: string | Date | null;
  lease_token: string;
  status?: string;
};

export function cronAuthorized(
  header: string | null,
  secret = process.env.REMINDER_CRON_SECRET,
): boolean {
  if (!secret || secret.trim().length < 32 || !header?.startsWith("Bearer ")) return false;
  const expected = Buffer.from(secret.trim());
  const received = Buffer.from(header.slice(7).trim());
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function deliveryFailure(error: unknown, row: OutboundMessage, now = Date.now()) {
  const known = error instanceof EmailDeliveryError || error instanceof WhatsAppDeliveryError;
  const code = known ? error.code : "delivery_unknown";
  if (
    [
      "email_not_configured",
      "configuration_invalid",
      "provider_disabled",
      "unsupported_channel",
    ].includes(code)
  ) {
    return { status: "blocked", code, delayMs: 0 };
  }
  const first = row.first_attempt_at ? new Date(row.first_attempt_at).getTime() : now;
  if (
    !known ||
    (error.ambiguous && row.channel !== "email") ||
    (row.channel === "email" && now - first >= IDEMPOTENCY_WINDOW_MS)
  ) {
    return { status: "review", code, delayMs: 0 };
  }
  if (error.retryable && row.attempt_count < MAX_DELIVERY_ATTEMPTS) {
    const delays = [60_000, 300_000, 900_000, 3_600_000, 14_400_000];
    const retryAfter =
      "retryAfterMs" in error && typeof error.retryAfterMs === "number" ? error.retryAfterMs : 0;
    return {
      status: "queued",
      code,
      delayMs: Math.min(14_400_000, Math.max(delays[row.attempt_count - 1] ?? 60_000, retryAfter)),
    };
  }
  return { status: "failed", code, delayMs: 0 };
}

export async function recordNotificationAttention(
  sql: Sql,
  row: Pick<OutboundMessage, "id" | "channel" | "event_type" | "booking_id">,
  code: string,
) {
  await sql`
    insert into automation_events(shop_id, area, event, severity, context)
    values (${SHOP}, 'benachrichtigung', 'zustellung-pruefen', 'error', ${`Ausgang #${row.id}: ${code}`})
  `;
  if (row.event_type === "notification.alert") return;
  const owner = ownerNotifyTargets();
  const channel = row.channel === "email" && owner.whatsapp ? "whatsapp" : "email";
  const to = channel === "whatsapp" ? owner.whatsapp : owner.email;
  if (!to) return;
  await enqueueNotification(sql, {
    key: `notification:${row.id}:attention`,
    eventType: "notification.alert",
    channel,
    to,
    subject: "Benachrichtigung benötigt Prüfung · White Gloss",
    body: `Eine Nachricht konnte nicht sicher zugestellt werden.\nAusgang #${row.id}\nVorgang: ${row.booking_id ? `WG-${row.booking_id}` : "ohne Buchung"}\nBitte die Versandliste im Betriebspanel prüfen.`,
    bookingId: row.booking_id,
  });
}

/** Reminders are derived only from already confirmed bookings; no status writes. */
export async function scheduleDueBookingReminders(sql: Sql): Promise<number> {
  const rows = await sql<NotificationBooking>`
    select id, customer_name, email, phone, package_id, preferred_date::text, preferred_slot, status, version, confirmed_at
    from bookings where shop_id = ${SHOP} and status = 'bestaetigt'
      and preferred_date is not null and preferred_slot is not null
      and ((preferred_date + preferred_slot::time) at time zone 'Europe/Berlin') > now()
      and ((preferred_date + preferred_slot::time) at time zone 'Europe/Berlin') <= now() + interval '25 hours'
      and (confirmed_at is null or confirmed_at <=
        ((preferred_date + preferred_slot::time) at time zone 'Europe/Berlin') - interval '24 hours')
    order by preferred_date, preferred_slot limit 100
  `;
  for (const row of rows) await queueBookingReminder(sql, row);
  return rows.length;
}

async function maintainQueue(sql: Sql) {
  await sql`
    update outbound_queue q set status = 'cancelled', lease_token = null, locked_until = null,
      last_error_code = 'booking_changed', updated_at = now()
    where q.shop_id = ${SHOP} and q.status in ('queued', 'blocked')
      and q.event_type in ('booking.reminder', 'booking.confirmed')
      and not exists (
        select 1 from bookings b where b.id = q.booking_id and b.shop_id = q.shop_id
          and b.status = 'bestaetigt' and b.version = q.booking_version
          and (q.event_type <> 'booking.reminder' or
            ((b.preferred_date + b.preferred_slot::time) at time zone 'Europe/Berlin') > now())
      )
  `;
  await sql.transaction(async (tx) => {
    const expired = await tx<OutboundMessage>`
    update outbound_queue set
      status = case when channel = 'email' and attempt_count < ${MAX_DELIVERY_ATTEMPTS}
        and first_attempt_at > now() - interval '23 hours' then 'queued' else 'review' end,
      last_error_code = 'delivery_lease_expired', lease_token = null, locked_until = null,
      next_attempt_at = now(), updated_at = now()
    where shop_id = ${SHOP} and status = 'processing' and locked_until < now()
    returning *
  `;
    for (const row of expired) {
      if (row.status === "review")
        await recordNotificationAttention(tx, row, "delivery_lease_expired");
    }
  });
  const emailReady = mailConfigured();
  const whatsappReady = validateWhatsAppConfiguration().configured;
  await sql`
    update outbound_queue set status = 'queued', next_attempt_at = now(), updated_at = now()
    where shop_id = ${SHOP} and status = 'blocked'
      and ((channel = 'email' and ${emailReady} and last_error_code = 'email_not_configured')
        or (channel = 'whatsapp' and ${whatsappReady} and last_error_code in ('configuration_invalid', 'provider_disabled')))
  `;
}

export async function runNotificationWorker(
  sql: Sql,
  options: {
    limit?: number;
    sendEmail?: typeof sendResendEmail;
    sendWhatsApp?: typeof sendWhatsAppNotification;
  } = {},
) {
  await maintainQueue(sql);
  const result = { sent: 0, failed: 0, skipped: 0, retried: 0, review: 0 };
  const deadline = Date.now() + 40_000;
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  for (let index = 0; index < limit && Date.now() < deadline; index++) {
    const token = randomUUID();
    const [row] = await sql<OutboundMessage>`
      with candidate as (
        select id from outbound_queue where shop_id = ${SHOP} and status = 'queued'
          and next_attempt_at <= now() order by next_attempt_at, id
        for update skip locked limit 1
      )
      update outbound_queue q set status = 'processing', lease_token = ${token},
        locked_until = now() + interval '60 seconds', attempt_count = attempt_count + 1,
        first_attempt_at = coalesce(first_attempt_at, now()),
        from_addr = coalesce(from_addr, ${process.env.MAIL_FROM?.trim() || null}), updated_at = now()
      from candidate where q.id = candidate.id returning q.*
    `;
    if (!row) break;
    // Recheck immediately before delivery; edits/cancellations invalidate old reminders.
    if (row.event_type === "booking.reminder" || row.event_type === "booking.confirmed") {
      const [current] = await sql<{ valid: boolean }>`
        select exists(select 1 from bookings where shop_id = ${SHOP} and id = ${row.booking_id}
          and status = 'bestaetigt' and version = ${row.booking_version}
          and (${row.event_type} <> 'booking.reminder' or
            ((preferred_date + preferred_slot::time) at time zone 'Europe/Berlin') > now())) as valid
      `;
      if (!current?.valid) {
        await sql`update outbound_queue set status = 'cancelled', lease_token = null, locked_until = null,
          last_error_code = 'booking_changed', updated_at = now() where id = ${row.id} and lease_token = ${token}`;
        result.skipped++;
        continue;
      }
    }
    let delivered: { id: string } | undefined;
    let failure: ReturnType<typeof deliveryFailure> | undefined;
    try {
      if (
        row.channel === "email" &&
        row.first_attempt_at &&
        Date.now() - new Date(row.first_attempt_at).getTime() >= IDEMPOTENCY_WINDOW_MS
      ) {
        throw new EmailDeliveryError("email_idempotency_window_expired", false, true);
      }
      if (row.channel === "email") {
        delivered = await (options.sendEmail ?? sendResendEmail)({
          to: row.to_addr || "",
          subject: row.subject || "White Gloss",
          text: row.body,
          idempotencyKey: row.event_key,
          from: row.from_addr || undefined,
          attachments: row.attachments,
        });
      } else if (row.channel === "whatsapp") {
        delivered = await (options.sendWhatsApp ?? sendWhatsAppNotification)({
          to: row.to_addr || "",
          subject: (row.subject || "White Gloss").slice(0, 160),
          text: row.body.slice(0, 700),
          idempotencyKey: row.event_key,
        });
      } else {
        throw new EmailDeliveryError("unsupported_channel", false);
      }
    } catch (error) {
      failure = deliveryFailure(error, row);
    }
    // Database failures are deliberately outside the provider catch. A delivered
    // message with an unrecorded result remains leased for safe reconciliation.
    if (delivered) {
      const changed = await sql<{ id: number }>`
        update outbound_queue set status = 'sent', provider_message_id = ${delivered.id},
          delivery_status = case when delivery_status = 'pending' then 'sent' else delivery_status end,
          lease_token = null, locked_until = null, last_error_code = null, updated_at = now()
        where id = ${row.id} and shop_id = ${SHOP} and status = 'processing' and lease_token = ${token}
        returning id
      `;
      if (changed.length) result.sent++;
      else {
        // A receipt may have already committed while the provider request was in flight.
        const [current] = await sql<{ status: string }>`select status from outbound_queue
          where id=${row.id} and shop_id=${SHOP}`;
        if (current?.status === "sent") result.sent++;
        else if (current?.status === "failed") result.failed++;
        else if (current?.status === "review") result.review++;
        else result.skipped++;
      }
    } else if (failure) {
      await sql.transaction(async (tx) => {
        const changed = await tx<{ id: number }>`
          update outbound_queue set status = ${failure.status}, last_error_code = ${failure.code},
            next_attempt_at = now() + (${failure.delayMs} * interval '1 millisecond'),
            first_attempt_at = case when ${failure.status} = 'blocked' and attempt_count = 1
              then null else first_attempt_at end,
            attempt_count = case when ${failure.status} = 'blocked'
              then greatest(attempt_count - 1, 0) else attempt_count end,
            lease_token = null, locked_until = null, updated_at = now()
          where id = ${row.id} and shop_id = ${SHOP} and status = 'processing' and lease_token = ${token}
          returning id
        `;
        if (changed.length && failure.status !== "queued")
          await recordNotificationAttention(tx, row, failure.code);
      });
      if (failure.status === "queued") result.retried++;
      else if (failure.status === "review") result.review++;
      else result.failed++;
    }
  }
  await sql`update shop_settings set notification_worker_last_run_at = now() where shop_id = ${SHOP}`;
  return result;
}
