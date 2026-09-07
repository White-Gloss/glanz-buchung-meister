import { createHash } from "node:crypto";
import { packages } from "../data/site.ts";
import { ownerNotifyTargets, type BookingLite, type QueueTarget } from "./ops.ts";
import { isEmailAddress } from "./utils.ts";
import type { Sql } from "./db.ts";

export type BookingEvent =
  | "booking.created"
  | "booking.confirmed"
  | "booking.rejected"
  | "booking.cancelled"
  | "booking.rescheduled"
  | "booking.updated"
  | "booking.completed"
  | "booking.no_show";

export type NotificationBooking = BookingLite & {
  status?: string;
  version?: number;
  note?: string | null;
  confirmed_at?: string | Date | null;
};

export function recipientHash(to: string): string {
  return createHash("sha256").update(to.trim().toLowerCase()).digest("hex").slice(0, 24);
}

export async function enqueueNotification(
  sql: Sql,
  input: {
    key: string;
    eventType: string;
    channel: QueueTarget["channel"];
    to: string;
    subject: string;
    body: string;
    bookingId?: number | null;
    bookingVersion?: number | null;
    runAt?: string | null;
  },
) {
  const rows = await sql<{ id: number }>`
    insert into outbound_queue (
      shop_id, channel, to_addr, subject, body, booking_id, status, event_key,
      event_type, booking_version, from_addr, next_attempt_at
    ) values (
      ${"white-gloss"}, ${input.channel}, ${input.to}, ${input.subject}, ${input.body},
      ${input.bookingId ?? null}, ${"queued"}, ${input.key}, ${input.eventType},
      ${input.bookingVersion ?? null},
      ${input.channel === "email" ? process.env.MAIL_FROM?.trim() || null : null},
      coalesce(${input.runAt ?? null}::timestamptz, now())
    ) on conflict (shop_id, event_key) do nothing returning id
  `;
  return rows[0]?.id ?? null;
}

const eventLabels: Record<BookingEvent, string> = {
  "booking.created": "Neue Buchungsanfrage – wartet auf Bestätigung",
  "booking.confirmed": "Termin manuell bestätigt",
  "booking.rejected": "Buchungsanfrage abgelehnt",
  "booking.cancelled": "Termin storniert",
  "booking.rescheduled": "Termin geändert – wartet auf Bestätigung",
  "booking.updated": "Buchungsdaten geändert",
  "booking.completed": "Auftrag abgeschlossen",
  "booking.no_show": "Termin als nicht wahrgenommen markiert",
};

export function bookingNotificationText(booking: NotificationBooking, event: BookingEvent) {
  const service =
    packages.find((entry) => entry.id === booking.package_id)?.name ?? booking.package_id;
  return [
    eventLabels[event],
    `Vorgang: WG-${booking.id}`,
    `Kunde: ${booking.customer_name.slice(0, 100)}`,
    `Abgabe am: ${booking.preferred_date?.slice(0, 10) || "noch offen"}`,
    `Abgabezeit: ${booking.preferred_slot || "noch offen"}`,
    `Leistung: ${service}`,
    `Telefon: ${booking.phone.slice(0, 40)}`,
    booking.note ? `Notiz: ${booking.note.slice(0, 150)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Called inside the booking transaction. No external API calls or swallowed writes. */
export async function queueBookingEvent(
  sql: Sql,
  booking: NotificationBooking,
  event: BookingEvent,
  eventId: number,
  _actor: string,
) {
  const version = booking.version ?? 1;
  const [storedEvent] = await sql<{
    before_data: Record<string, unknown> | null;
    created_at: string | Date;
  }>`
    select before_data, created_at from booking_events
    where id = ${eventId} and shop_id = 'white-gloss' and booking_id = ${booking.id}
  `;
  const before = storedEvent?.before_data;
  const previousDate = typeof before?.date === "string" ? before.date.slice(0, 10) : "";
  const previousSlot = typeof before?.slot === "string" ? before.slot.slice(0, 5) : "";
  const previous = previousDate
    ? `Ursprüngliche Abgabe: ${previousDate} ${previousSlot}`.trim()
    : "";
  const occurred = storedEvent?.created_at
    ? new Intl.DateTimeFormat("de-DE", {
        timeZone: "Europe/Berlin",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(storedEvent.created_at))
    : "";
  const ownerBody = [
    ["booking.rescheduled", "booking.cancelled"].includes(event) ? previous : "",
    event === "booking.cancelled" && occurred ? `Storniert am: ${occurred}` : "",
    bookingNotificationText(booking, event),
  ]
    .filter(Boolean)
    .join("\n");
  // Suppress stale confirmations/reminders; already delivered messages remain auditable.
  await sql`
    update outbound_queue set status = 'cancelled', lease_token = null, locked_until = null,
      last_error_code = 'booking_changed', updated_at = now()
    where shop_id = 'white-gloss' and booking_id = ${booking.id}
      and event_type in ('booking.reminder', 'booking.confirmed')
      and status in ('queued', 'blocked')
      and (booking_version <> ${version} or ${booking.status ?? "neu"} <> 'bestaetigt')
  `;
  const owner = ownerNotifyTargets();
  const subject = `${eventLabels[event]} · WG-${booking.id}`;
  const targets: QueueTarget[] = [];
  if (owner.whatsapp) targets.push({ channel: "whatsapp", to: owner.whatsapp });
  if (owner.email) targets.push({ channel: "email", to: owner.email });
  if (owner.telegram) targets.push({ channel: "telegram", to: owner.telegram });
  for (const target of targets) {
    await enqueueNotification(sql, {
      key: `booking:${booking.id}:event:${eventId}:owner:${target.channel}:${recipientHash(target.to)}`,
      eventType: event,
      ...target,
      subject,
      body: target.channel === "whatsapp" ? ownerBody.slice(0, 700) : ownerBody,
      bookingId: booking.id,
      bookingVersion: version,
    });
  }
  if (isEmailAddress(booking.email) && !["booking.completed", "booking.no_show"].includes(event)) {
    const when =
      `${booking.preferred_date?.slice(0, 10) || "noch offen"} ${booking.preferred_slot || ""}`.trim();
    const message =
      event === "booking.created" || event === "booking.rescheduled"
        ? "Ihre Anfrage ist eingegangen. Der Termin ist noch nicht bestätigt. Wir melden uns nach der Prüfung."
        : event === "booking.confirmed"
          ? `Ihre Abgabe wurde persönlich bestätigt: ${when}.`
          : event === "booking.cancelled"
            ? "Ihr Termin wurde storniert."
            : event === "booking.rejected"
              ? "Ihre Terminanfrage wurde abgelehnt. Für eine Alternative melden Sie sich gerne."
              : `Ihre Buchungsdaten wurden aktualisiert. Gewünschter Termin: ${when}.`;
    await enqueueNotification(sql, {
      key: `booking:${booking.id}:event:${eventId}:customer:email:${recipientHash(booking.email)}`,
      eventType: event,
      channel: "email",
      to: booking.email,
      subject,
      body: `Guten Tag ${booking.customer_name},\n\n${message}\nVorgang WG-${booking.id}\n\nWhite Gloss Detailing`,
      bookingId: booking.id,
      bookingVersion: version,
    });
  }
  await queueBookingReminder(sql, booking);
}

export async function queueBookingReminder(sql: Sql, booking: NotificationBooking) {
  const version = booking.version ?? 1;
  if (
    booking.status === "bestaetigt" &&
    booking.preferred_date &&
    booking.preferred_slot &&
    isEmailAddress(booking.email)
  ) {
    const [time] = await sql<{ start_at: string; run_at: string }>`
      select (((${booking.preferred_date.slice(0, 10)}::date + ${booking.preferred_slot}::time)
        at time zone 'Europe/Berlin'))::text as start_at,
        (((${booking.preferred_date.slice(0, 10)}::date + ${booking.preferred_slot}::time)
        at time zone 'Europe/Berlin') - interval '24 hours')::text as run_at
    `;
    // A last-minute personal confirmation is already the timely customer notice.
    // Do not immediately follow it with a second email labelled a 24-hour reminder.
    if (
      booking.confirmed_at &&
      new Date(booking.confirmed_at).getTime() > new Date(time.run_at).getTime()
    )
      return;
    await enqueueNotification(sql, {
      key: `booking:${booking.id}:reminder:${version}:email:${recipientHash(booking.email)}`,
      eventType: "booking.reminder",
      channel: "email",
      to: booking.email,
      subject: `Terminerinnerung · White Gloss WG-${booking.id}`,
      body: `Guten Tag ${booking.customer_name},\n\nIhre bestätigte Abgabe: ${booking.preferred_date.slice(0, 10)} um ${booking.preferred_slot} Uhr.\nVorgang WG-${booking.id}\n\nWhite Gloss Detailing`,
      bookingId: booking.id,
      bookingVersion: version,
      runAt: time.run_at,
    });
  }
}

/** One attention event per rejected revision; never changes the booking itself. */
export async function queueBookingConflict(
  sql: Sql,
  bookingId: number,
  version: number,
  actor: string,
) {
  await sql.transaction(async (tx) => {
    const owner = ownerNotifyTargets();
    const targets: QueueTarget[] = [];
    if (owner.whatsapp) targets.push({ channel: "whatsapp", to: owner.whatsapp });
    if (owner.email) targets.push({ channel: "email", to: owner.email });
    let recorded = false;
    for (const target of targets) {
      const id = await enqueueNotification(tx, {
        key: `booking:${bookingId}:conflict:${version}:owner:${target.channel}`,
        eventType: "booking.conflict",
        ...target,
        bookingId,
        bookingVersion: version,
        subject: `Abgabeplatz belegt · WG-${bookingId}`,
        body: `Die manuelle Bestätigung für WG-${bookingId} wurde wegen eines belegten Abgabeplatzes oder der Tageskapazität abgewiesen. Die Anfrage bleibt unverändert. Bitte im Betriebspanel einen anderen Abgabetermin prüfen.`,
      });
      recorded = recorded || id !== null;
    }
    if (recorded)
      await tx`insert into automation_events(shop_id,area,event,severity,context)
      values('white-gloss','buchung','terminkonflikt','warning',${JSON.stringify({ bookingId, version, actor })})`;
  });
}
