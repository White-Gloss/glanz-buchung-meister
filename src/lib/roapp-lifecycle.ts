import { createHash } from "node:crypto";
import type { Sql } from "./db.ts";
import { roappAccountScope, roappOnlyEnabled } from "./booking-backend.ts";
import { enqueueNotification } from "./booking-notifications.ts";
import { googleProfile } from "../data/google-profile.ts";
import { site } from "../data/site.ts";
import { currentRoContact } from "./roapp-contact.ts";
import { createRoappClient, roappCredentialsFromEnv, type RoappRequest } from "./roapp.ts";

export const RO_REMINDER = "wg.ro.reminder";
export const RO_REVIEW = "wg.ro.review";
const DAY = 86400000;
type LifecycleState = {
  id: number;
  customer_name: string;
  email: string | null;
  pickup_cents: number;
  city_slug: string | null;
  review_email_consent: boolean;
  ro_order_id: number;
  fixed_price: boolean;
  status_id: number;
  scheduled_for: string | Date | null;
  owner_confirmed_at: string | Date | null;
  completed_at: string | Date | null;
};

export function roLifecycleEnabled() {
  return roappOnlyEnabled() && process.env.ROAPP_LIFECYCLE_MAIL_ENABLED === "true";
}
export function roStatusIds(name: string): number[] {
  return (process.env[name] || "")
    .split(",")
    .filter(Boolean)
    .map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0);
}
export function lifecycleKey(id: number, kind: "reminder" | "review", at: string | Date) {
  const date = new Date(at).toISOString();
  const stamp = createHash("sha256").update(date).digest("hex").slice(0, 20);
  return `wg-ro-v1:${roappAccountScope()}:${id}:${kind}:${stamp}`;
}
export function approvedRoLifecycleMessage(key: string, event: string) {
  if (!roLifecycleEnabled() || ![RO_REMINDER, RO_REVIEW].includes(event)) return false;
  const parts = key.split(":");
  return (
    parts.length === 5 &&
    parts[0] === "wg-ro-v1" &&
    parts[1] === roappAccountScope() &&
    /^[1-9][0-9]*$/.test(parts[2]) &&
    parts[3] === (event === RO_REMINDER ? "reminder" : "review") &&
    /^[a-f0-9]{20}$/.test(parts[4])
  );
}
async function state(sql: Sql, bookingId: number) {
  const [row] =
    await sql<LifecycleState>`select b.id,b.customer_name,b.email,b.pickup_cents,b.city_slug,b.review_email_consent,
    q.ro_order_id,s.fixed_price,s.status_id,s.scheduled_for,s.owner_confirmed_at,s.completed_at
    from bookings b join roapp_sync_queue q on q.booking_id=b.id and q.shop_id=b.shop_id
    join roapp_order_state s on s.booking_id=b.id
    where b.shop_id='white-gloss' and b.id=${bookingId} and q.account_scope=${roappAccountScope()}
      and b.status not in ('storniert','abgelehnt','nicht_erschienen')`;
  return row;
}

/** Plans messages only after the owner has checked the customer's signature and set the final status. */
export function lifecyclePlan(row: LifecycleState, now = Date.now()) {
  if (!row.email || !row.fixed_price || !row.owner_confirmed_at) return [];
  const result: {
    kind: "reminder" | "review";
    event: string;
    at: string | Date;
    due: number;
    subject: string;
    body: string;
  }[] = [];
  const scheduled = row.scheduled_for ? new Date(row.scheduled_for).getTime() : NaN;
  if (
    !row.completed_at &&
    roStatusIds("ROAPP_CONFIRMED_STATUS_IDS").includes(row.status_id) &&
    scheduled > now
  ) {
    const pickup = Boolean(row.city_slug || row.pickup_cents > 0);
    const date = new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      dateStyle: "full",
      timeStyle: "short",
    }).format(scheduled);
    result.push({
      kind: "reminder",
      event: RO_REMINDER,
      at: row.scheduled_for!,
      due: scheduled - 3 * DAY,
      subject: `Erinnerung an deinen Fahrzeugtermin – White-Gloss WG-${row.id}`,
      body: `Hallo ${row.customer_name},\n\ndein bestätigter Termin ist am ${date}.\n\n${
        pickup
          ? "Für die vereinbarte Abholung melden wir uns telefonisch, um Abholzeit und Treffpunkt mit dir abzustimmen. Die genaue Abholzeit wird telefonisch vereinbart."
          : "Wenn du dein Fahrzeug selbst bringst, stimmen wir die Übergabe mit dir ab. Falls stattdessen eine Abholung vereinbart wurde, melden wir uns vorher telefonisch zur genauen Abholzeit."
      }\n\nBitte entferne persönliche Gegenstände und Wertsachen, halte den Fahrzeugschlüssel bereit und weise uns bei der gemeinsamen Übergabe auf vorhandene Schäden und Besonderheiten hin. Wir halten den Fahrzeugzustand bei der Übergabe fest.\n\nBei Änderungen erreichst du uns unter ${site.phoneDisplay} oder ${site.bookingEmail}.\n\nViele Grüße\nLars Hägele · White-Gloss Abholservice`,
    });
  }
  if (
    row.completed_at &&
    row.review_email_consent &&
    roStatusIds("ROAPP_COMPLETED_STATUS_IDS").includes(row.status_id)
  ) {
    result.push({
      kind: "review",
      event: RO_REVIEW,
      at: row.completed_at,
      due: new Date(row.completed_at).getTime() + 7 * DAY,
      subject: "Wie war dein Besuch bei White-Gloss?",
      body: `Hallo ${row.customer_name},\n\nseit deinem abgeschlossenen Auftrag ist eine Woche vergangen. Warst du mit unserem Service zufrieden? Was können wir besser machen? Antworte uns gerne direkt.\n\nÜber eine ehrliche Google-Bewertung freuen wir uns – unabhängig davon, wie dein Erlebnis war:\n${googleProfile.writeReviewUrl}\n\nVielen Dank!\nLars Hägele · White-Gloss Detailing\n\nDu möchtest keine Bewertungsanfragen mehr erhalten? Antworte mit „Keine Bewertungsanfragen“ an ${site.bookingEmail}.`,
    });
  }
  return result;
}

export async function queueRoLifecycle(sql: Sql, bookingId: number) {
  if (!roLifecycleEnabled()) return;
  const row = await state(sql, bookingId);
  if (!row) return;
  if (!row.email) {
    // Without an address the reminder must happen by phone. Tell the owner once
    // per confirmed appointment instead of silently skipping it.
    const reminder = lifecyclePlan({ ...row, email: "fehlt@invalid.invalid" }).find(
      (plan) => plan.kind === "reminder",
    );
    if (reminder)
      await enqueueNotification(sql, {
        key: `wg-ro-v1:${roappAccountScope()}:${row.id}:owner:ohne-email-${lifecycleKey(row.id, "reminder", reminder.at).split(":")[4]}`,
        eventType: "wg.ro.owner",
        channel: "email",
        to: site.bookingEmail,
        bookingId: row.id,
        subject: `WG-${row.id}: Erinnerung telefonisch geben`,
        body: `Für WG-${row.id} (${row.customer_name}) ist ein verbindlicher Termin bestätigt, aber keine E-Mail-Adresse hinterlegt.\nDie automatische Erinnerung drei Tage vorher entfällt. Bitte telefonisch erinnern und Abholung bzw. Übergabe abstimmen oder die E-Mail-Adresse im RO-Kontakt ergänzen.`,
      });
    return;
  }
  for (const plan of lifecyclePlan(row)) {
    await enqueueNotification(sql, {
      key: lifecycleKey(row.id, plan.kind, plan.at),
      eventType: plan.event,
      channel: "email",
      to: row.email!,
      bookingId: row.id,
      subject: plan.subject,
      body: plan.body,
      runAt: new Date(Math.max(Date.now(), plan.due)).toISOString(),
    });
  }
}

/** Re-read RO immediately before delivery: cancellation, rescheduling, price edits and withdrawal invalidate queued mail. */
export async function validateRoLifecycle(
  sql: Sql,
  message: {
    booking_id: number | null;
    event_key: string;
    event_type: string | null;
    to_addr: string | null;
  },
  request?: RoappRequest,
): Promise<string | false> {
  if (
    !message.booking_id ||
    !approvedRoLifecycleMessage(message.event_key, message.event_type || "")
  )
    return false;
  const before = await state(sql, message.booking_id);
  if (!before) return false;
  const { refreshRoOrder } = await import("./roapp-callback.ts");
  await refreshRoOrder(sql, before.ro_order_id, request);
  const creds = request ? null : roappCredentialsFromEnv();
  const call = request || (creds ? createRoappClient(creds) : null);
  // Best effort: a corrected RO e-mail address wins; unreadable contacts keep the website address.
  if (call) await currentRoContact(sql, message.booking_id, call, { strict: false });
  const current = await state(sql, message.booking_id);
  const valid = Boolean(
    current?.email &&
    lifecyclePlan(current).some(
      (plan) =>
        plan.event === message.event_type &&
        plan.due <= Date.now() &&
        lifecycleKey(current.id, plan.kind, plan.at) === message.event_key,
    ),
  );
  return valid ? current!.email! : false;
}
