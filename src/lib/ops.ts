import { site, timeSlots } from "../data/site.ts";
import { isEmailAddress } from "./utils.ts";

type Sql = Awaited<ReturnType<typeof import("./db").getSql>>;

export const OUTBOUND_QUEUED = "queued";
export const AUTO_CONFIRM_MAX_PER_DAY = 2;
export const AUTO_CONFIRM_ACTOR = "auto";

export type BookingLite = {
  id: number;
  customer_name: string;
  email?: string | null;
  phone: string;
  package_id: string;
  preferred_date?: string | null;
  preferred_slot?: string | null;
};

export type QueueTarget = {
  channel: "email" | "whatsapp" | "telegram";
  to: string;
};

export type OccupiedAppointment = {
  date: string;
  slot: string | null;
  packageId: string;
};

export type AutoConfirmDecision =
  | { ok: true }
  | { ok: false; reason: "not_booking" | "no_date" | "past" | "weekend" | "slot_taken" | "day_full" | "keramik_day" };

export async function safeExec(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    console.error(`[ops:${label}]`, err);
  }
}

export function ownerNotifyTargets(): { email: string | null; whatsapp: string | null; telegram: string | null } {
  const emailRaw = (process.env.OWNER_EMAIL || site.email).trim();
  const whatsappRaw = (process.env.OWNER_WHATSAPP || site.phoneHref.replace(/[^\d+]/g, "")).trim();
  const telegramRaw = (process.env.OWNER_TELEGRAM || "").trim();
  return {
    email: isEmailAddress(emailRaw) ? emailRaw : null,
    whatsapp: whatsappRaw || null,
    telegram: telegramRaw || null,
  };
}

export function resolveOwnerNotifyRecipients(booking: BookingLite): QueueTarget[] {
  const owner = ownerNotifyTargets();
  const targets: QueueTarget[] = [];
  if (owner.whatsapp) targets.push({ channel: "whatsapp", to: owner.whatsapp });
  if (owner.telegram) targets.push({ channel: "telegram", to: owner.telegram });
  if (owner.email) targets.push({ channel: "email", to: owner.email });
  return targets.filter((t) => t.to.length > 0 && t.to !== booking.phone);
}

export function resolveCustomerConfirmRecipients(booking: BookingLite): QueueTarget[] {
  const targets: QueueTarget[] = [];
  if (isEmailAddress(booking.email)) {
    targets.push({ channel: "email", to: booking.email.trim() });
  }
  return targets;
}

export function berlinCalendarDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function berlinMinutesSinceMidnight(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function slotMinutes(slot: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(slot)) return null;
  const [hours, minutes] = slot.split(":").map(Number);
  return hours * 60 + minutes;
}

function weekdayUtcNoon(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

export function canAutoConfirmAppointment(input: {
  kind?: string;
  packageId: string;
  preferredDate: string | null;
  preferredSlot: string | null;
  occupied: OccupiedAppointment[];
  today?: string;
  nowMinutes?: number;
}): AutoConfirmDecision {
  if ((input.kind || "booking") !== "booking") return { ok: false, reason: "not_booking" };
  const date = (input.preferredDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, reason: "no_date" };

  const today = input.today ?? berlinCalendarDate();
  if (date < today) return { ok: false, reason: "past" };

  const weekday = weekdayUtcNoon(date);
  if (weekday === 0 || weekday === 6) return { ok: false, reason: "weekend" };

  const slot = (input.preferredSlot || "").trim() || null;
  if (slot && !timeSlots.includes(slot)) return { ok: false, reason: "no_date" };
  if (date === today) {
    const nowMinutes = input.nowMinutes ?? berlinMinutesSinceMidnight();
    if (!slot) return { ok: false, reason: "past" };
    const start = slotMinutes(slot);
    if (start === null || start <= nowMinutes) return { ok: false, reason: "past" };
  }

  const sameDay = input.occupied.filter((row) => row.date === date);
  if (slot && sameDay.some((row) => row.slot === slot)) return { ok: false, reason: "slot_taken" };

  const incomingKeramik = input.packageId === "keramik";
  const dayHasKeramik = sameDay.some((row) => row.packageId === "keramik");
  if (incomingKeramik || dayHasKeramik) {
    if (sameDay.length > 0) return { ok: false, reason: "keramik_day" };
  }
  if (sameDay.length >= AUTO_CONFIRM_MAX_PER_DAY) return { ok: false, reason: "day_full" };

  return { ok: true };
}

async function queueChannel(
  sql: Sql,
  booking: BookingLite,
  channel: QueueTarget["channel"],
  to: string,
  subject: string,
  body: string,
) {
  if (!to.trim()) return;
  if (channel === "email" && !isEmailAddress(to)) return;
  await sql`
    insert into outbound_queue (shop_id, channel, to_addr, subject, body, booking_id, status)
    values (
      ${"white-gloss"}, ${channel}, ${to}, ${subject}, ${body}, ${booking.id}, ${OUTBOUND_QUEUED}
    )
  `;
  await sql`
    insert into inbox_messages (shop_id, channel, direction, sender, subject, body, booking_id)
    values (
      ${"white-gloss"}, ${channel}, ${"out"}, ${"White Gloss"}, ${subject}, ${body}, ${booking.id}
    )
  `;
}

export async function queueOwnerNotify(sql: Sql, booking: BookingLite, kind: string) {
  const subject = `Neue ${kind} WG-${booking.id}`;
  const body = [
    `${booking.customer_name}`,
    booking.phone,
    booking.email || "",
    booking.package_id,
    booking.preferred_date
      ? `${booking.preferred_date} ${booking.preferred_slot ?? ""}`.trim()
      : "ohne Wunschtermin",
  ]
    .filter(Boolean)
    .join(" · ");
  for (const target of resolveOwnerNotifyRecipients(booking)) {
    await safeExec(`owner-${target.channel}`, () =>
      queueChannel(sql, booking, target.channel, target.to, subject, body),
    );
  }
}

export async function queueBookingAutomation(
  sql: Sql,
  booking: BookingLite,
  status: string,
  userId: string,
) {
  if (status !== "bestaetigt") return;
  const when = booking.preferred_date
    ? `${booking.preferred_date}${booking.preferred_slot ? ` ${booking.preferred_slot}` : ""}`
    : "wird telefonisch abgestimmt";
  const text = [
    `Guten Tag ${booking.customer_name},`,
    "",
    `Ihr Termin für ${booking.package_id} ist bestätigt (WG-${booking.id}).`,
    `Zeitfenster: ${when}`,
    "Ausführung: Arnistal 27, 72160 Horb am Neckar.",
    "Der verbindliche Preis bleibt nach Begutachtung. Es erfolgt kein automatischer Einzug.",
    "",
    "White Gloss Detailing",
  ].join("\n");
  const subject = `Termin bestätigt · White Gloss WG-${booking.id}`;
  for (const target of resolveCustomerConfirmRecipients(booking)) {
    await safeExec(`confirm-${target.channel}`, () =>
      queueChannel(sql, booking, target.channel, target.to, subject, text),
    );
  }
  if (booking.preferred_date) {
    const reminder = `Erinnerung: ${booking.customer_name}, ${booking.package_id}, ${when}`;
    await safeExec("confirm-reminder", () =>
      sql`
        insert into documents (shop_id, booking_id, kind, title, amount_cents, status, body, created_by)
        values (
          ${"white-gloss"}, ${booking.id}, ${"erinnerung"},
          ${`Terminerinnerung WG-${booking.id}`}, ${0}, ${"entwurf"}, ${reminder}, ${userId}
        )
      `,
    );
  }
  const auto = userId === AUTO_CONFIRM_ACTOR;
  await safeExec("confirm-event", () =>
    sql`
      insert into automation_events (shop_id, area, event, severity, context)
      values (
        ${"white-gloss"}, ${"buchung"},
        ${auto ? "auto-bestaetigt" : "bestaetigt"}, ${"info"},
        ${`WG-${booking.id}`}
      )
    `,
  );
}
