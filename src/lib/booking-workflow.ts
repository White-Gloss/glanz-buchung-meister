import { createHash } from "node:crypto";
import type { Sql } from "./db.ts";
import {
  publicBookingSchema,
  manualBookingSchema,
  type PublicBookingInput,
  type ManualBookingInput,
} from "./booking-schema.ts";
import { createRequestUploadCapability } from "./booking-upload-capability.ts";
import { cities, extras, quoteTotal, timeSlots } from "../data/site.ts";
import { berlinCalendarDate, berlinMinutesSinceMidnight } from "./ops.ts";
import { requireBookingOwner } from "./booking-owner.ts";
import {
  queueBookingEvent,
  queueBookingConflict,
  type BookingEvent,
} from "./booking-notifications.ts";
import type { UploadCapability } from "./booking-upload-capability.ts";
import { queueOdooBooking } from "./odoo-sync.ts";
import { queueRoappBooking } from "./roapp-sync.ts";
import { queueLexwareBooking } from "./lexware-sync.ts";
import { enqueueZohoJob, zohoOpsEnabled } from "./zoho-ops.ts";

const SHOP = "white-gloss";
export type WorkflowStatus =
  "neu" | "bestaetigt" | "abgelehnt" | "storniert" | "erledigt" | "nicht_erschienen";
export type WorkflowBooking = {
  id: number;
  status: WorkflowStatus;
  version: number;
  customer_name: string;
  phone: string;
  email: string | null;
  preferred_date: string | null;
  preferred_slot: string | null;
  package_id: string;
  class_id: string;
  extra_ids: string;
  city_slug: string | null;
  note: string | null;
  total_cents: number;
  pickup_cents: number;
  confirmed_at: string | null;
  confirmed_by: string | null;
  cancelled_at: string | null;
  request_fingerprint: string | null;
  upload_token_expires_at: string | Date | null;
};
type Enqueue = typeof queueBookingEvent;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function assertPricing(data: Pick<PublicBookingInput, "extraIds" | "citySlug">) {
  if (
    data.extraIds.some((id) => !extras.some((e) => e.id === id)) ||
    new Set(data.extraIds).size !== data.extraIds.length
  ) {
    throw new Error("Unbekanntes oder doppeltes Extra.");
  }
  if (data.citySlug && !cities.some((c) => c.slug === data.citySlug))
    throw new Error("Unbekannter Abholort.");
}

/** Serialize the shop before locking a booking, always in the same order. */
async function lockShop(tx: Sql) {
  await tx`update booking_workflow_locks set revision=revision+1 where shop_id=${SHOP}`;
}

function snapshot(row: WorkflowBooking) {
  // Capability hashes / request keys are deliberately excluded from the audit.
  return {
    status: row.status,
    name: row.customer_name,
    phone: row.phone,
    email: row.email,
    date: row.preferred_date,
    slot: row.preferred_slot,
    packageId: row.package_id,
    classId: row.class_id,
    extraIds: row.extra_ids,
    citySlug: row.city_slug,
    note: row.note,
    totalCents: row.total_cents,
  };
}

async function event(
  tx: Sql,
  row: WorkflowBooking,
  before: WorkflowBooking | null,
  name: BookingEvent,
  actor: string,
  enqueue: Enqueue,
) {
  const [saved] = await tx<{ id: number }>`
    insert into booking_events(shop_id,booking_id,event,actor,version,before_data,after_data)
    values(${SHOP},${row.id},${name},${actor},${row.version},${before ? JSON.stringify(snapshot(before)) : null}::jsonb,${JSON.stringify(snapshot(row))}::jsonb)
    returning id
  `;
  await enqueue(tx, row, name, saved.id, actor);
  await enqueueZohoJob(tx, row.id, "record", `record:${row.id}:${row.version}`);
  if (name === "booking.created") {
    await enqueueZohoJob(tx, row.id, "photos", `photos:${row.id}:created`);
  }
  if (name === "booking.confirmed") {
    await enqueueZohoJob(tx, row.id, "calendar", `calendar:${row.id}:${row.version}`);
    await enqueueZohoJob(tx, row.id, "confirmation", `confirmation:${row.id}:${row.version}`);
  }
  if (name === "booking.cancelled" || name === "booking.rejected") {
    await enqueueZohoJob(tx, row.id, "calendar", `calendar-release:${row.id}:${row.version}`);
  }
  if (!(await zohoOpsEnabled(tx))) {
    await queueOdooBooking(tx, row);
    await queueRoappBooking(tx, row);
    await queueLexwareBooking(tx, row);
  }
}

async function findBooking(tx: Sql, id: number) {
  const [row] =
    await tx<WorkflowBooking>`select * from bookings where shop_id=${SHOP} and id=${id} for update`;
  if (!row) throw new Error("Buchung nicht gefunden.");
  return row;
}
function checkVersion(row: WorkflowBooking, expectedVersion: number) {
  if (row.version !== expectedVersion)
    throw new Error("Die Buchung wurde inzwischen geändert. Bitte neu laden und erneut prüfen.");
}
function safeFailure(error: unknown): never {
  const code = typeof error === "object" && error && "code" in error ? error.code : null;
  if (code === "23505")
    throw new Error(
      "Terminkonflikt: Dieses Zeitfenster oder die Tageskapazität ist bereits belegt.",
    );
  if (code === "55P03" || code === "40P01" || code === "40001")
    throw new Error("Eine andere Buchung wird gerade bearbeitet. Bitte erneut versuchen.");
  if (code === "23514" || code === "42501")
    throw new Error(
      "Diese Terminänderung ist nicht zulässig. Bitte Termin und Berechtigung prüfen.",
    );
  if (code) throw new Error("Die Buchung konnte nicht gespeichert werden. Bitte erneut versuchen.");
  throw error;
}

export async function saveBookingRequest(
  sql: Sql,
  raw: PublicBookingInput,
  capability: UploadCapability,
  enqueue: Enqueue = queueBookingEvent,
) {
  const data = publicBookingSchema.parse(raw);
  if (data.website?.trim()) throw new Error("Anfrage abgelehnt.");
  return persistBookingRequest(sql, data, capability, enqueue);
}

/** actor comes only from the authenticated operator middleware. */
export async function saveManualBookingRequest(sql: Sql, raw: ManualBookingInput, actor: string) {
  if (!actor.trim()) throw new Error("Kein Betriebszugang.");
  const { notifyCustomer, ...data } = manualBookingSchema.parse(raw);
  const requestKey = `manual:${actor}:${data.idempotencyKey}`;
  return persistBookingRequest(
    sql,
    data,
    createRequestUploadCapability(requestKey),
    (tx, booking, event, eventId, eventActor) =>
      queueBookingEvent(tx, booking, event, eventId, eventActor, { notifyCustomer }),
    { actor, requestKey, notifyCustomer },
  );
}

async function persistBookingRequest(
  sql: Sql,
  data: Omit<PublicBookingInput, "privacy"> & { privacy?: true },
  capability: UploadCapability,
  enqueue: Enqueue,
  manual?: { actor: string; requestKey: string; notifyCustomer: boolean },
) {
  assertPricing(data);
  const key = hash(manual?.requestKey ?? data.idempotencyKey);
  const content = {
    ...data,
    idempotencyKey: undefined,
    website: undefined,
    ...(manual ? { notifyCustomer: manual.notifyCustomer } : {}),
  };
  const fingerprint = hash(JSON.stringify(content));
  const quote = quoteTotal(data);
  try {
    return await sql.transaction(async (tx) => {
      await lockShop(tx);
      const [existing] =
        await tx<WorkflowBooking>`select * from bookings where shop_id=${SHOP} and request_key_hash=${key}`;
      if (existing) {
        if (existing.request_fingerprint !== fingerprint)
          throw new Error(
            "Diese Anfragekennung wurde bereits verwendet. Bitte eine neue Anfrage beginnen.",
          );
        return { booking: existing, replayed: true, quote };
      }
      const note = [
        data.note?.trim(),
        quote.pickupOnRequest
          ? "Abholung auf Anfrage – Preis nicht im gespeicherten Gesamtbetrag."
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      const [booking] = await tx<WorkflowBooking>`
        insert into bookings(shop_id,status,customer_name,phone,email,preferred_date,preferred_slot,package_id,class_id,extra_ids,city_slug,note,total_cents,pickup_cents,estimated_price_cents,vehicle_make,vehicle_model,vehicle_plate,upload_token_hash,upload_token_expires_at,request_key_hash,request_fingerprint)
        values(${SHOP},'neu',${data.name},${data.phone},${data.email || null},${data.date || null},${data.slot || null},${data.packageId},${data.classId},${JSON.stringify(data.extraIds)},${data.citySlug || null},${note || null},${Math.round(quote.total * 100)},${Math.round((quote.pickup ?? 0) * 100)},${Math.round(quote.total * 100)},${"vehicleMake" in data ? data.vehicleMake || null : null},${"vehicleModel" in data ? data.vehicleModel || null : null},${"vehiclePlate" in data ? data.vehiclePlate || null : null},${capability.hash},${capability.expiresAt},${key},${fingerprint}) returning *
      `;
      await tx`insert into customers(shop_id,name,phone,email) values(${SHOP},${data.name},${data.phone},${data.email || null})
        on conflict(shop_id,phone) do update set name=excluded.name,email=coalesce(excluded.email,customers.email)`;
      await tx`insert into inbox_messages(shop_id,channel,sender,subject,body,booking_id)
        values(${SHOP},'form',${data.name},${`Neue Anfrage WG-${booking.id}`},${`${data.name} · ${data.phone}\n${data.packageId}\nWunschtermin: ${data.date || "offen"} ${data.slot || ""}\nStatus: Wartet auf Bestätigung\n${note}`},${booking.id})`;
      await event(tx, booking, null, "booking.created", manual?.actor ?? "customer", enqueue);
      return { booking, replayed: false, quote };
    });
  } catch (error) {
    safeFailure(error);
  }
}

function assertConfirmable(row: WorkflowBooking, now = new Date()) {
  const date = row.preferred_date,
    slot = row.preferred_slot;
  if (!date || !slot || !timeSlots.includes(slot))
    throw new Error("Bitte zuerst Datum und Uhrzeit festlegen.");
  const today = berlinCalendarDate(now);
  const [h, m] = slot.split(":").map(Number);
  if (date < today || (date === today && h * 60 + m <= berlinMinutesSinceMidnight(now)))
    throw new Error("Ein vergangener Termin kann nicht bestätigt werden.");
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6)
    throw new Error("Bitte einen Termin von Montag bis Freitag wählen.");
}

export async function confirmBookingManually(
  sql: Sql,
  id: number,
  expectedVersion: number,
  actor: string,
  enqueue: Enqueue = queueBookingEvent,
) {
  await requireBookingOwner(sql, actor);
  try {
    return await sql.transaction(async (tx) => {
      await lockShop(tx);
      const before = await findBooking(tx, id);
      // A lost successful response can be retried without another event/message.
      if (
        before.status === "bestaetigt" &&
        before.version === expectedVersion + 1 &&
        before.confirmed_by === actor
      )
        return { booking: before, changed: false };
      checkVersion(before, expectedVersion);
      if (before.status !== "neu") throw new Error("Nur offene Anfragen können bestätigt werden.");
      assertConfirmable(before);
      await tx`select set_config('white_gloss.confirm_actor',${actor},true)`;
      const [booking] =
        await tx<WorkflowBooking>`update bookings set status='bestaetigt',confirmed_at=now(),confirmed_by=${actor},handled_by=${actor},updated_at=now(),version=version+1
      where shop_id=${SHOP} and id=${id} returning *`;
      await event(tx, booking, before, "booking.confirmed", actor, enqueue);
      return { booking, changed: true };
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      try {
        await queueBookingConflict(sql, id, expectedVersion, actor);
      } catch {
        console.error("[booking:conflict-notification] Protokollierung fehlgeschlagen.");
      }
    }
    safeFailure(error);
  }
}

const transitions: Record<WorkflowStatus, WorkflowStatus[]> = {
  neu: ["abgelehnt", "storniert"],
  bestaetigt: ["storniert", "erledigt", "nicht_erschienen"],
  abgelehnt: [],
  storniert: [],
  erledigt: [],
  nicht_erschienen: [],
};
export async function changeBookingStatus(
  sql: Sql,
  id: number,
  expectedVersion: number,
  status: WorkflowStatus,
  actor: string,
  enqueue: Enqueue = queueBookingEvent,
) {
  if (!actor || actor === "auto" || actor.startsWith("operator:"))
    throw new Error("Eine angemeldete Benutzeraktion ist erforderlich.");
  if (status === "bestaetigt") throw new Error("Bitte die manuelle Terminbestätigung verwenden.");
  if (status === "erledigt" && (await zohoOpsEnabled(sql))) {
    throw new Error(
      "Bitte den Leistungsabschluss mit Zahlungsvariante im Zoho-Arbeitsplatz verwenden. Eine Rechnung entsteht nicht allein durch den Statuswechsel.",
    );
  }
  try {
    return await sql.transaction(async (tx) => {
      await lockShop(tx);
      const before = await findBooking(tx, id);
      if (before.status === status && before.version === expectedVersion + 1)
        return { booking: before, changed: false };
      checkVersion(before, expectedVersion);
      if (!transitions[before.status]?.includes(status))
        throw new Error("Dieser Statuswechsel ist nicht zulässig.");
      const [booking] =
        await tx<WorkflowBooking>`update bookings set status=${status},handled_by=${actor},updated_at=now(),version=version+1,
      cancelled_at=case when ${status}='storniert' then now() else cancelled_at end
      where shop_id=${SHOP} and id=${id} returning *`;
      const name = (
        {
          abgelehnt: "booking.rejected",
          storniert: "booking.cancelled",
          erledigt: "booking.completed",
          nicht_erschienen: "booking.no_show",
        } as const
      )[status as "abgelehnt"];
      await event(tx, booking, before, name, actor, enqueue);
      return { booking, changed: true };
    });
  } catch (error) {
    safeFailure(error);
  }
}

export type BookingDetails = Pick<
  PublicBookingInput,
  | "name"
  | "phone"
  | "email"
  | "date"
  | "slot"
  | "packageId"
  | "classId"
  | "extraIds"
  | "citySlug"
  | "note"
>;
export async function editBooking(
  sql: Sql,
  id: number,
  expectedVersion: number,
  data: BookingDetails,
  actor: string,
  enqueue: Enqueue = queueBookingEvent,
) {
  assertPricing(data);
  const quote = quoteTotal(data);
  try {
    return await sql.transaction(async (tx) => {
      await lockShop(tx);
      const before = await findBooking(tx, id);
      const same =
        before.customer_name === data.name &&
        before.phone === data.phone &&
        (before.email || "") === data.email &&
        (before.preferred_date || "") === (data.date || "") &&
        (before.preferred_slot || "") === (data.slot || "") &&
        before.package_id === data.packageId &&
        before.class_id === data.classId &&
        before.extra_ids === JSON.stringify(data.extraIds) &&
        (before.city_slug || "") === data.citySlug &&
        (before.note || "") === (data.note?.trim() || "");
      if (same && (before.version === expectedVersion || before.version === expectedVersion + 1))
        return { booking: before, changed: false };
      checkVersion(before, expectedVersion);
      if (!["neu", "bestaetigt"].includes(before.status))
        throw new Error("Abgeschlossene Buchungen können nicht umgebucht werden.");
      if (data.date && data.date !== before.preferred_date && data.date < berlinCalendarDate())
        throw new Error("Ein neuer Abgabetermin darf nicht in der Vergangenheit liegen.");
      const changedAppointment =
        (before.preferred_date || "") !== (data.date || "") ||
        (before.preferred_slot || "") !== (data.slot || "") ||
        before.package_id !== data.packageId ||
        before.class_id !== data.classId ||
        before.extra_ids !== JSON.stringify(data.extraIds);
      const status = changedAppointment ? "neu" : before.status;
      const [booking] =
        await tx<WorkflowBooking>`update bookings set customer_name=${data.name},phone=${data.phone},email=${data.email || null},
      preferred_date=${data.date || null},preferred_slot=${data.slot || null},package_id=${data.packageId},class_id=${data.classId},extra_ids=${JSON.stringify(data.extraIds)},city_slug=${data.citySlug || null},note=${data.note?.trim() || null},
      total_cents=${Math.round(quote.total * 100)},pickup_cents=${Math.round((quote.pickup ?? 0) * 100)},status=${status},
      confirmed_at=case when ${changedAppointment} then null else confirmed_at end,confirmed_by=case when ${changedAppointment} then null else confirmed_by end,
      handled_by=${actor},updated_at=now(),version=version+1 where shop_id=${SHOP} and id=${id} returning *`;
      await tx`insert into customers(shop_id,name,phone,email) values(${SHOP},${data.name},${data.phone},${data.email || null})
      on conflict(shop_id,phone) do update set name=excluded.name,email=coalesce(excluded.email,customers.email)`;
      await event(
        tx,
        booking,
        before,
        changedAppointment ? "booking.rescheduled" : "booking.updated",
        actor,
        enqueue,
      );
      return { booking, changed: true };
    });
  } catch (error) {
    safeFailure(error);
  }
}
