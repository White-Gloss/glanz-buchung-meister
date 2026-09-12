import type { Sql } from "./db.ts";
import type { WorkflowBooking } from "./booking-workflow.ts";
import { requireBookingOwner } from "./booking-owner.ts";
import { queueBookingEvent, type BookingEvent } from "./booking-notifications.ts";
import { berlinWallToUtc, defaultWorkEnd, utcToBerlinWall } from "./zoho-time.ts";
import { zohoOpsEnabled as zohoOpsEnabledFromSettings } from "./zoho-credentials.server.ts";
import { queueOdooBooking } from "./odoo-sync.ts";
import { queueRoappBooking } from "./roapp-sync.ts";
import { queueLexwareBooking } from "./lexware-sync.ts";
import { packages, extras as extraCatalog, vehicleClasses } from "../data/site.ts";

const SHOP = "white-gloss";

export { zohoOpsEnabledFromSettings as zohoOpsEnabled };

export const OPS_STAGES = [
  "anfrage_eingegangen",
  "in_pruefung",
  "kundenrueckmeldung",
  "bestaetigt",
  "in_bearbeitung",
  "abgeschlossen",
  "abgelehnt",
  "storniert",
] as const;
export type OpsStage = (typeof OPS_STAGES)[number];

export type PaymentVariant = "bar" | "ueberweisung";

export type ZohoBooking = WorkflowBooking & {
  estimated_price_cents: number | null;
  agreed_price_cents: number | null;
  work_start_at: string | Date | null;
  work_end_at: string | Date | null;
  resource_id: number;
  ops_stage: OpsStage;
  invoice_status: string;
  payment_status: string;
  payment_method: string | null;
  payment_recorded_cents: number | null;
  payment_recorded_on: string | null;
  customer_acceptance_required: boolean;
  customer_accepted_at: string | Date | null;
  internal_notes: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  confirmation_pdf_version: number;
  zoho_contact_id: string | null;
  zoho_deal_id: string | null;
  zoho_event_id: string | null;
  zoho_invoice_id: string | null;
  zoho_payment_id: string | null;
  zoho_invoice_number: string | null;
  zoho_last_error: string | null;
};

export async function ensureZohoSchema(sql: Sql) {
  await sql`alter table bookings add column if not exists estimated_price_cents integer`;
  await sql`alter table bookings add column if not exists agreed_price_cents integer`;
  await sql`alter table bookings add column if not exists work_start_at timestamptz`;
  await sql`alter table bookings add column if not exists work_end_at timestamptz`;
  await sql`alter table bookings add column if not exists resource_id integer not null default 1`;
  await sql`alter table bookings add column if not exists ops_stage text not null default 'anfrage_eingegangen'`;
  await sql`alter table bookings add column if not exists invoice_status text not null default 'nicht_erstellt'`;
  await sql`alter table bookings add column if not exists payment_status text not null default 'offen'`;
  await sql`alter table bookings add column if not exists payment_method text`;
  await sql`alter table bookings add column if not exists payment_recorded_cents integer`;
  await sql`alter table bookings add column if not exists payment_recorded_on date`;
  await sql`alter table bookings add column if not exists customer_acceptance_required boolean not null default false`;
  await sql`alter table bookings add column if not exists customer_accepted_at timestamptz`;
  await sql`alter table bookings add column if not exists internal_notes text`;
  await sql`alter table bookings add column if not exists vehicle_make text`;
  await sql`alter table bookings add column if not exists vehicle_model text`;
  await sql`alter table bookings add column if not exists vehicle_plate text`;
  await sql`alter table bookings add column if not exists confirmation_pdf_version integer not null default 0`;
  await sql`alter table bookings add column if not exists zoho_contact_id text`;
  await sql`alter table bookings add column if not exists zoho_deal_id text`;
  await sql`alter table bookings add column if not exists zoho_event_id text`;
  await sql`alter table bookings add column if not exists zoho_invoice_id text`;
  await sql`alter table bookings add column if not exists zoho_payment_id text`;
  await sql`alter table bookings add column if not exists zoho_invoice_number text`;
  await sql`alter table bookings add column if not exists zoho_last_error text`;
  await sql.query(`
    create table if not exists booking_time_blocks (
      id serial primary key,
      shop_id text not null,
      booking_id integer not null references bookings(id),
      resource_id integer not null default 1,
      start_at timestamptz not null,
      end_at timestamptz not null,
      source text not null default 'booking',
      unique (shop_id, booking_id)
    )
  `);
  await sql.query(`
    create table if not exists zoho_job_queue (
      id serial primary key,
      shop_id text not null default 'white-gloss',
      booking_id integer not null references bookings(id),
      job text not null,
      idempotency_key text not null,
      payload jsonb not null default '{}'::jsonb,
      status text not null default 'pending',
      attempts integer not null default 0,
      next_attempt_at timestamptz not null default now(),
      last_error text,
      result jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (shop_id, idempotency_key)
    )
  `);
  await sql.query(`
    create table if not exists zoho_sync_queue (
      booking_id integer primary key references bookings(id),
      shop_id text not null default 'white-gloss',
      requested_version integer not null,
      synced_version integer not null default 0,
      status text not null default 'pending',
      job text not null default 'record',
      attempts integer not null default 0,
      next_attempt_at timestamptz not null default now(),
      last_error text,
      write_pending text,
      updated_at timestamptz not null default now()
    )
  `);
  await sql.query(`
    create table if not exists zoho_sync_runner (
      shop_id text primary key,
      lease_token text,
      locked_until timestamptz
    )
  `);
  await sql`insert into zoho_sync_runner (shop_id) values ('white-gloss') on conflict do nothing`;
  await sql`alter table shop_settings add column if not exists zoho_ops_enabled boolean not null default false`;
  await sql`alter table shop_settings add column if not exists zoho_dc text`;
  await sql`alter table shop_settings add column if not exists zoho_client_id text`;
  await sql`alter table shop_settings add column if not exists zoho_client_secret text`;
  await sql`alter table shop_settings add column if not exists zoho_refresh_token text`;
  await sql`alter table shop_settings add column if not exists zoho_access_token text`;
  await sql`alter table shop_settings add column if not exists zoho_access_expires_at timestamptz`;
  await sql`alter table shop_settings add column if not exists zoho_books_org_id text`;
  await sql`alter table shop_settings add column if not exists zoho_webhook_secret text`;
  await sql`alter table shop_settings add column if not exists zoho_tax_id text`;
}

function snapshot(row: ZohoBooking) {
  return {
    status: row.status,
    opsStage: row.ops_stage,
    date: row.preferred_date,
    slot: row.preferred_slot,
    start: row.work_start_at,
    end: row.work_end_at,
    estimated: row.estimated_price_cents,
    agreed: row.agreed_price_cents,
    invoice: row.invoice_status,
    payment: row.payment_status,
  };
}

async function lockShop(tx: Sql) {
  await tx`update booking_workflow_locks set revision = revision + 1 where shop_id = ${SHOP}`;
}

async function findBooking(tx: Sql, id: number) {
  const [row] = await tx<ZohoBooking>`
    select * from bookings where shop_id = ${SHOP} and id = ${id} for update
  `;
  if (!row) throw new Error("Buchung nicht gefunden.");
  return row;
}

function checkVersion(row: ZohoBooking, expected: number) {
  if (row.version !== expected) {
    throw new Error("Die Buchung wurde inzwischen geändert. Bitte neu laden und erneut prüfen.");
  }
}

function asDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseWorkInterval(input: {
  startDate: string;
  startTime: string;
  endDate?: string;
  endTime?: string;
  durationMinutes?: number;
  packageId?: string;
}) {
  const start = berlinWallToUtc(input.startDate, input.startTime);
  let end: Date;
  if (input.endDate && input.endTime) {
    end = berlinWallToUtc(input.endDate, input.endTime);
  } else if (input.durationMinutes && input.durationMinutes > 0) {
    end = new Date(start.getTime() + input.durationMinutes * 60_000);
  } else {
    end = defaultWorkEnd(input.packageId || "basis", start);
  }
  if (end.getTime() <= start.getTime()) {
    throw new Error("Das Terminende muss nach dem Beginn liegen.");
  }
  return { start, end };
}

export function needsCustomerAcceptance(
  before: ZohoBooking,
  next: {
    agreedCents: number;
    start: Date;
    end: Date;
  },
) {
  const estimated = before.estimated_price_cents ?? before.total_cents;
  const previousStart = asDate(before.work_start_at);
  const requestedDate = before.preferred_date?.slice(0, 10) || "";
  const requestedSlot = before.preferred_slot || "";
  const wall = utcToBerlinWall(next.start);
  const dateChanged =
    (requestedDate && wall.date !== requestedDate) ||
    (requestedSlot && wall.time !== requestedSlot) ||
    (previousStart && previousStart.getTime() !== next.start.getTime());
  const priceIncreased = next.agreedCents > estimated;
  return { required: priceIncreased || Boolean(dateChanged), priceIncreased, dateChanged };
}

function slotFromStart(time: string): string {
  if (["09:00", "11:00", "13:00", "15:00"].includes(time)) return time;
  return "09:00";
}

async function recordEvent(
  tx: Sql,
  row: ZohoBooking,
  before: ZohoBooking | null,
  name: BookingEvent,
  actor: string,
) {
  const [saved] = await tx<{ id: number }>`
    insert into booking_events(shop_id, booking_id, event, actor, version, before_data, after_data)
    values (
      ${SHOP}, ${row.id}, ${name}, ${actor}, ${row.version},
      ${before ? JSON.stringify(snapshot(before)) : null}::jsonb,
      ${JSON.stringify(snapshot(row))}::jsonb
    )
    returning id
  `;
  await queueBookingEvent(tx, row, name, saved.id, actor);
  await enqueueZohoJob(tx, row.id, "record", `record:${row.id}:${row.version}`, {
    version: row.version,
  });
  if (!(await zohoOpsEnabledFromSettings(tx))) {
    await queueOdooBooking(tx, row);
    await queueRoappBooking(tx, row);
    await queueLexwareBooking(tx, row);
  }
}

export async function enqueueZohoJob(
  sql: Sql,
  bookingId: number,
  job: string,
  key: string,
  payload: Record<string, unknown> = {},
) {
  await ensureZohoSchema(sql);
  await sql`
    insert into zoho_job_queue (shop_id, booking_id, job, idempotency_key, payload)
    values (${SHOP}, ${bookingId}, ${job}, ${key}, ${JSON.stringify(payload)}::jsonb)
    on conflict (shop_id, idempotency_key) do nothing
  `;
  await sql`
    insert into zoho_sync_queue (booking_id, shop_id, requested_version, job)
    values (${bookingId}, ${SHOP}, 1, ${job})
    on conflict (booking_id) do update
      set requested_version = zoho_sync_queue.requested_version + 1,
          status = case when zoho_sync_queue.status = 'review' then 'review' else 'pending' end,
          job = excluded.job,
          next_attempt_at = now(),
          updated_at = now()
  `;
}

export async function markInquiryReceived(sql: Sql, bookingId: number) {
  await sql`
    update bookings
    set estimated_price_cents = coalesce(estimated_price_cents, total_cents)
    where id = ${bookingId} and shop_id = ${SHOP}
  `;
  await enqueueZohoJob(sql, bookingId, "record", `record:${bookingId}:created`);
  await enqueueZohoJob(sql, bookingId, "photos", `photos:${bookingId}:created`);
}

export type ConfirmScheduleInput = {
  startDate: string;
  startTime: string;
  endDate?: string;
  endTime?: string;
  durationMinutes?: number;
  agreedCents: number;
  resourceId?: number;
  internalNotes?: string;
  customerAccepted?: boolean;
};

export async function confirmBookingWithSchedule(
  sql: Sql,
  id: number,
  expectedVersion: number,
  actor: string,
  input: ConfirmScheduleInput,
) {
  await requireBookingOwner(sql, actor);
  try {
    return await sql.transaction(async (tx) => {
      await lockShop(tx);
      const before = await findBooking(tx, id);
      const interval = parseWorkInterval({ ...input, packageId: before.package_id });
      if (
        before.status === "bestaetigt" &&
        before.version === expectedVersion + 1 &&
        before.confirmed_by === actor
      ) {
        return {
          booking: before,
          changed: false,
          acceptance: needsCustomerAcceptance(before, {
            agreedCents: input.agreedCents,
            start: interval.start,
            end: interval.end,
          }),
        };
      }
      checkVersion(before, expectedVersion);
      if (before.status === "bestaetigt") {
        throw new Error("Bitte den Termin zuerst stornieren oder über die Umbuchung neu bestätigen.");
      }
      if (!["neu"].includes(before.status) && before.ops_stage !== "kundenrueckmeldung") {
        throw new Error("Nur offene oder zur Rückmeldung vorgemerkte Anfragen können bestätigt werden.");
      }
      const acceptance = needsCustomerAcceptance(before, {
        agreedCents: input.agreedCents,
        start: interval.start,
        end: interval.end,
      });
      if (acceptance.required && !input.customerAccepted && !before.customer_accepted_at) {
        const [booking] = await tx<ZohoBooking>`
          update bookings set
            ops_stage = 'kundenrueckmeldung',
            customer_acceptance_required = true,
            agreed_price_cents = ${input.agreedCents},
            work_start_at = ${interval.start.toISOString()}::timestamptz,
            work_end_at = ${interval.end.toISOString()}::timestamptz,
            resource_id = ${input.resourceId ?? 1},
            internal_notes = ${input.internalNotes ?? before.internal_notes},
            handled_by = ${actor},
            updated_at = now(),
            version = version + 1
          where shop_id = ${SHOP} and id = ${id}
          returning *
        `;
        await recordEvent(tx, booking, before, "booking.updated", actor);
        return { booking, changed: true, acceptance, awaitingCustomer: true as const };
      }
      const wall = utcToBerlinWall(interval.start);
      await tx`select set_config('white_gloss.confirm_actor', ${actor}, true)`;
      const [booking] = await tx<ZohoBooking>`
        update bookings set
          status = 'bestaetigt',
          ops_stage = 'bestaetigt',
          preferred_date = ${wall.date}::date,
          preferred_slot = ${slotFromStart(wall.time)},
          work_start_at = ${interval.start.toISOString()}::timestamptz,
          work_end_at = ${interval.end.toISOString()}::timestamptz,
          resource_id = ${input.resourceId ?? 1},
          agreed_price_cents = ${input.agreedCents},
          total_cents = ${input.agreedCents},
          customer_acceptance_required = false,
          customer_accepted_at = case
            when ${Boolean(input.customerAccepted)} then now()
            else customer_accepted_at
          end,
          internal_notes = ${input.internalNotes ?? before.internal_notes},
          confirmed_at = now(),
          confirmed_by = ${actor},
          handled_by = ${actor},
          invoice_status = 'nicht_erstellt',
          updated_at = now(),
          version = version + 1
        where shop_id = ${SHOP} and id = ${id}
        returning *
      `;
      await recordEvent(tx, booking, before, "booking.confirmed", actor);
      await enqueueZohoJob(tx, booking.id, "calendar", `calendar:${booking.id}:${booking.version}`);
      await enqueueZohoJob(
        tx,
        booking.id,
        "confirmation",
        `confirmation:${booking.id}:${booking.version}`,
      );
      return { booking, changed: true, acceptance, awaitingCustomer: false as const };
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    if (code === "23505") {
      throw new Error(
        "Terminkonflikt: Dieser Zeitraum ist für die Werkstatt bereits belegt. Bitte anderen Beginn oder andere Dauer wählen.",
      );
    }
    if (code === "23514" || code === "42501") {
      throw new Error("Diese Terminbestätigung ist nicht zulässig. Bitte Zeitraum und Berechtigung prüfen.");
    }
    throw error;
  }
}

export async function rejectOrCancelBooking(
  sql: Sql,
  id: number,
  expectedVersion: number,
  actor: string,
  status: "abgelehnt" | "storniert",
) {
  await requireBookingOwner(sql, actor);
  return sql.transaction(async (tx) => {
    await lockShop(tx);
    const before = await findBooking(tx, id);
    checkVersion(before, expectedVersion);
    const [booking] = await tx<ZohoBooking>`
      update bookings set
        status = ${status},
        ops_stage = ${status},
        cancelled_at = case when ${status} = 'storniert' then now() else cancelled_at end,
        handled_by = ${actor},
        updated_at = now(),
        version = version + 1
      where shop_id = ${SHOP} and id = ${id}
      returning *
    `;
    await recordEvent(
      tx,
      booking,
      before,
      status === "abgelehnt" ? "booking.rejected" : "booking.cancelled",
      actor,
    );
    await enqueueZohoJob(tx, booking.id, "calendar", `calendar-release:${booking.id}:${booking.version}`);
    return { booking, changed: true };
  });
}

export type CompleteInput = {
  payment: PaymentVariant;
  cashCents?: number;
  cashDate?: string;
  agreedCents?: number;
};

export async function completeServiceWithPayment(
  sql: Sql,
  id: number,
  expectedVersion: number,
  actor: string,
  input: CompleteInput,
) {
  await requireBookingOwner(sql, actor);
  if (input.payment === "bar") {
    if (!input.cashCents || input.cashCents <= 0) {
      throw new Error("Bitte den tatsächlich erhaltenen Barbetrag angeben.");
    }
    if (!input.cashDate) {
      throw new Error("Bitte das tatsächliche Zahlungsdatum der Barzahlung angeben.");
    }
  }
  return sql.transaction(async (tx) => {
    await lockShop(tx);
    const before = await findBooking(tx, id);
    if (before.status === "erledigt" && before.version === expectedVersion + 1) {
      return { booking: before, changed: false };
    }
    checkVersion(before, expectedVersion);
    if (before.status !== "bestaetigt") {
      throw new Error("Nur bestätigte Termine können als geleistet abgeschlossen werden.");
    }
    const agreed = input.agreedCents ?? before.agreed_price_cents ?? before.total_cents;
    if (!agreed || agreed <= 0) {
      throw new Error("Ohne vereinbarten Betrag kann keine Rechnung entstehen.");
    }
    const [booking] = await tx<ZohoBooking>`
      update bookings set
        status = 'erledigt',
        ops_stage = 'abgeschlossen',
        agreed_price_cents = ${agreed},
        total_cents = ${agreed},
        payment_method = ${input.payment},
        payment_status = 'offen',
        payment_recorded_cents = ${input.payment === "bar" ? input.cashCents ?? null : null},
        payment_recorded_on = ${input.payment === "bar" ? input.cashDate ?? null : null},
        invoice_status = 'ausstehend',
        handled_by = ${actor},
        updated_at = now(),
        version = version + 1
      where shop_id = ${SHOP} and id = ${id}
      returning *
    `;
    await recordEvent(tx, booking, before, "booking.completed", actor);
    await enqueueZohoJob(tx, booking.id, "invoice", `invoice:${booking.id}`, {
      payment: input.payment,
      cashCents: input.cashCents ?? null,
      cashDate: input.cashDate ?? null,
    });
    return { booking, changed: true };
  });
}

export async function listBusyWindows(
  sql: Sql,
  fromIso: string,
  toIso: string,
): Promise<{ start: string; end: string; resourceId: number }[]> {
  await ensureZohoSchema(sql);
  const blocks = await sql<{ start_at: string; end_at: string; resource_id: number }>`
    select start_at::text, end_at::text, resource_id
    from booking_time_blocks
    where shop_id = ${SHOP}
      and start_at < ${toIso}::timestamptz
      and end_at > ${fromIso}::timestamptz
  `;
  const claims = await sql<{ appointment_date: string; resource: number }>`
    select appointment_date::text, resource
    from booking_capacity_claims
    where shop_id = ${SHOP}
      and appointment_date >= ${fromIso.slice(0, 10)}::date
      and appointment_date <= ${toIso.slice(0, 10)}::date
      and resource <= 2
  `;
  return [
    ...blocks.map((row) => ({
      start: new Date(row.start_at).toISOString(),
      end: new Date(row.end_at).toISOString(),
      resourceId: row.resource_id,
    })),
    ...claims.map((row) => ({
      start: berlinWallToUtc(row.appointment_date.slice(0, 10), "09:00").toISOString(),
      end: berlinWallToUtc(row.appointment_date.slice(0, 10), "17:00").toISOString(),
      resourceId: row.resource,
    })),
  ];
}

export function bookingSummary(row: ZohoBooking) {
  const pack = packages.find((item) => item.id === row.package_id)?.name || row.package_id;
  let extraIds: string[] = [];
  try {
    extraIds = JSON.parse(row.extra_ids || "[]");
  } catch {
    extraIds = [];
  }
  return {
    reference: `WG-${row.id}`,
    packageName: pack,
    classLabel: vehicleClasses.find((item) => item.id === row.class_id)?.label || row.class_id,
    extras: extraIds.map((id) => extraCatalog.find((item) => item.id === id)?.name || id),
    estimatedCents: row.estimated_price_cents ?? row.total_cents,
    agreedCents: row.agreed_price_cents,
  };
}
