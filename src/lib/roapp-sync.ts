import { randomUUID } from "node:crypto";
import type { Sql } from "./db.ts";
import type { WorkflowBooking } from "./booking-workflow.ts";
import { packages, vehicleClasses, extras, pickupPricing, cities } from "../data/site.ts";
import { roappOnlyEnabled } from "./booking-backend.ts";
import { isCalendarDate } from "./calendar-date.ts";
import { journalRoappWrites } from "./roapp-write-journal.ts";
import { syncRoappPhotos } from "./roapp-photo-links.ts";
import {
  addBookingItem,
  addOrderItem,
  createBooking,
  createOrder,
  createOrderComment,
  createPerson,
  createRoappClient,
  findPersonByPhoneOrEmail,
  roappCredentialsFromEnv,
  RoappError,
  type RoappCredentials,
  type RoappRequest,
} from "./roapp.ts";

const SHOP = "white-gloss";
const SLOT_DURATION_MS = 2 * 60 * 60 * 1000;

export type RoappCall = RoappRequest;

export async function queueRoappBooking(
  sql: Sql,
  booking: Pick<WorkflowBooking, "id" | "version">,
) {
  if (!roappOnlyEnabled()) {
    await sql`insert into roapp_sync_queue(booking_id,shop_id,requested_version)
      values(${booking.id},${SHOP},${booking.version}) on conflict(booking_id) do update
      set requested_version=greatest(roapp_sync_queue.requested_version,excluded.requested_version),
      status=case when roapp_sync_queue.status='review' then 'review' else 'pending' end,
      next_attempt_at=now(),updated_at=now()`;
    return;
  }
  await sql`insert into roapp_sync_queue(booking_id,shop_id,requested_version)
    values(${booking.id},${SHOP},${booking.version}) on conflict(booking_id) do update
    set requested_version=greatest(roapp_sync_queue.requested_version,excluded.requested_version),
    status=case when roapp_sync_queue.status='review' then 'review' else 'pending' end,
    next_attempt_at=now(),requested_at=clock_timestamp(),updated_at=now()`;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "").replace(/^00/, "+");
}

export function splitCustomerName(name: string): { firstName: string; lastName?: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "Kunde" };
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function bookingSchedule(
  booking: Pick<WorkflowBooking, "preferred_date" | "preferred_slot">,
): { scheduledFor: string; scheduledTo: string } {
  const date = (booking.preferred_date || "").trim();
  const slot = (booking.preferred_slot || "").trim();
  if (!date || !slot) throw new RoappError("roapp_missing_slot", { review: true });
  if (!isCalendarDate(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot))
    throw new RoappError("roapp_invalid_slot", { review: true });
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const candidates = ["+01:00", "+02:00"]
    .map((offset) => new Date(`${date}T${slot}:00${offset}`))
    .filter((value) => formatter.format(value) === `${date} ${slot}`);
  // Reject missing or ambiguous times at daylight-saving transitions.
  if (candidates.length !== 1) throw new RoappError("roapp_invalid_slot", { review: true });
  const start = candidates[0];
  const end = new Date(start.getTime() + SLOT_DURATION_MS);
  return { scheduledFor: start.toISOString(), scheduledTo: end.toISOString() };
}

export function bookingComment(booking: WorkflowBooking): string {
  const pack =
    packages.find((p) => p.id === booking.package_id)?.name ||
    (booking.package_id === "photo-inquiry" ? "Individuelle Fotoanfrage" : booking.package_id);
  const vehicleClass =
    vehicleClasses.find((v) => v.id === booking.class_id)?.label || booking.class_id;
  let extraIds: unknown = [];
  try {
    extraIds = JSON.parse(booking.extra_ids);
  } catch {
    /* Legacy rows may contain no extras. */
  }
  const extraNames = Array.isArray(extraIds)
    ? extraIds.map((id) => extras.find((e) => e.id === id)?.name || String(id))
    : [];
  return [
    `Website-Anfrage WG-${booking.id}`,
    `Paket: ${pack}`,
    `Fahrzeugklasse: ${vehicleClass}`,
    `Extras: ${extraNames.join(", ") || "keine"}`,
    booking.package_id === "photo-inquiry"
      ? "Preis nach Fotobegutachtung festlegen."
      : `Vorläufiger Gesamtpreis bei Eingang: ${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(booking.total_cents / 100)}`,
    "Noch kein Fixpreis und keine verbindliche Terminzusage.",
    `Wunschtermin: ${booking.preferred_date || "nach Absprache"}${booking.preferred_slot ? `, ${booking.preferred_slot} Uhr` : ""}`,
    booking.city_slug
      ? `Abholort: ${cities.find((city) => city.slug === booking.city_slug)?.name || booking.city_slug}`
      : "",
    booking.note ? `Angaben des Kunden: ${booking.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function bookingManagerNotes(bookingId: number): string {
  return [
    `Bearbeitung der Website-Anfrage WG-${bookingId}`,
    "1. Fotos im Auftragsverlauf öffnen. Fehlende Angaben beim Kunden erfragen.",
    "2. Leistungen, Endpreis einschließlich Abholung und Termin prüfen bzw. ergänzen.",
    "3. Erst danach „Fixpreis bestätigt“ wählen. RO versendet die Bestätigung mit dem Unterschriftslink, sofern eine E-Mail-Adresse hinterlegt ist.",
    "4. Der Kunde nimmt selbst über den Link an. „Akzeptiert“ nicht stellvertretend setzen.",
    "5. Bei Arbeitsbeginn „In Arbeit“, nach Abschluss „Erledigt“ wählen.",
    "6. Rechnung nach der Leistung manuell erstellen und senden: Vorlage „Rechnungsversand White Gloss“, Anhang „Rechnung“. Anschrift, Leistungszeitraum und Fälligkeit prüfen.",
    "Termin und tatsächliche Arbeitsdauer im RO-Auftrag pflegen. Die Website übernimmt belegte Zeiträume aus offenen RO-Aufträgen automatisch; vor der Zusage den gesamten Kalender prüfen.",
  ].join("\n");
}

type LineItem = { catalogId: string; entityId: number; price: number; label: string };

export function bookingLineItems(
  booking: WorkflowBooking,
  entityMap: Record<string, number>,
): LineItem[] {
  const items: LineItem[] = [];
  if (booking.package_id === "photo-inquiry") return items;
  const pack = packages.find((p) => p.id === booking.package_id);
  const klass = vehicleClasses.find((v) => v.id === booking.class_id);
  const factor = klass?.factor ?? 1;
  const packageEntity =
    entityMap[`${booking.package_id}:${booking.class_id}`] ?? entityMap[booking.package_id];
  if (roappOnlyEnabled() && (!packageEntity || !pack))
    throw new RoappError("roapp_catalog_mapping_missing", { review: true });
  if (packageEntity && pack) {
    items.push({
      catalogId: booking.package_id,
      entityId: packageEntity,
      price: Math.round(pack.price * factor * 100) / 100,
      label: pack.name,
    });
  }
  let extraIds: unknown = [];
  try {
    extraIds = JSON.parse(booking.extra_ids);
  } catch {
    /* ignore */
  }
  if (Array.isArray(extraIds)) {
    for (const raw of extraIds) {
      const id = String(raw);
      const entityId = entityMap[`${id}:${booking.class_id}`] ?? entityMap[id];
      const extra = extras.find((e) => e.id === id);
      if (!entityId || !extra) {
        if (roappOnlyEnabled())
          throw new RoappError("roapp_catalog_mapping_missing", { review: true });
        continue;
      }
      items.push({
        catalogId: id,
        entityId,
        price: Math.round(extra.price * factor * 100) / 100,
        label: extra.name,
      });
    }
  }
  if (booking.pickup_cents > 0) {
    const tier = pickupPricing.tiers.find(
      (tier) => Math.round(tier.amount * 100) === booking.pickup_cents,
    );
    const entityId = tier ? entityMap[`pickup:${tier.id}`] : undefined;
    if (!entityId && roappOnlyEnabled())
      throw new RoappError("roapp_pickup_mapping_missing", { review: true });
    if (entityId && tier)
      items.push({
        catalogId: `pickup:${tier.id}`,
        entityId,
        price: booking.pickup_cents / 100,
        label: tier.label,
      });
  }
  return items;
}

type QueueProgress = {
  ro_contact_id: number | null;
  ro_booking_id: number | null;
  ro_order_id: number | null;
  booking_items_done: boolean;
  order_items_done: boolean;
};

async function saveProgress(sql: Sql, bookingId: number, patch: Partial<QueueProgress>) {
  await sql`update roapp_sync_queue set
    ro_contact_id=coalesce(${patch.ro_contact_id ?? null},ro_contact_id),
    ro_booking_id=coalesce(${patch.ro_booking_id ?? null},ro_booking_id),
    ro_order_id=coalesce(${patch.ro_order_id ?? null},ro_order_id),
    booking_items_done=case when ${patch.booking_items_done ?? null}::boolean is null then booking_items_done else ${patch.booking_items_done ?? false} end,
    order_items_done=case when ${patch.order_items_done ?? null}::boolean is null then order_items_done else ${patch.order_items_done ?? false} end,
    updated_at=now()
    where booking_id=${bookingId}`;
}

export async function syncOneRoappBooking(
  sql: Sql,
  booking: WorkflowBooking,
  request: RoappCall,
  creds: Pick<RoappCredentials, "branchId" | "assigneeId" | "orderTypeId" | "entityMap">,
  progress: QueueProgress,
) {
  const schedule =
    roappOnlyEnabled() && (!booking.preferred_date || !booking.preferred_slot)
      ? undefined
      : bookingSchedule(booking);
  const items = bookingLineItems(booking, creds.entityMap);
  const comment = bookingComment(booking);
  const phone = normalizePhone(booking.phone);
  if (!phone) throw new RoappError("roapp_missing_phone", { review: true });
  const names = splitCustomerName(booking.customer_name);

  let contactId = progress.ro_contact_id;
  if (!contactId) {
    contactId = await findPersonByPhoneOrEmail(request, phone, booking.email);
    if (!contactId) {
      contactId = await createPerson(request, {
        firstName: names.firstName,
        lastName: names.lastName,
        email: booking.email,
        phone,
        notes: `Website-Kunde WG-${booking.id}`,
      });
    }
    await saveProgress(sql, booking.id, { ro_contact_id: contactId });
  }

  let bookingId = progress.ro_booking_id;
  if (!bookingId && !roappOnlyEnabled()) {
    bookingId = await createBooking(request, {
      branchId: creds.branchId,
      assigneeId: creds.assigneeId,
      clientId: contactId,
      scheduledFor: schedule!.scheduledFor,
      scheduledTo: schedule!.scheduledTo,
      comment,
    });
    await saveProgress(sql, booking.id, { ro_booking_id: bookingId });
  }

  if (bookingId && !progress.booking_items_done) {
    for (const item of items) {
      await addBookingItem(request, bookingId, {
        entityId: item.entityId,
        quantity: 1,
        price: item.price,
        comment: item.label,
      });
    }
    await saveProgress(sql, booking.id, { booking_items_done: true });
  }

  let orderId = progress.ro_order_id;
  if (!orderId) {
    orderId = await createOrder(request, {
      branchId: creds.branchId,
      orderTypeId: creds.orderTypeId,
      clientId: contactId,
      assigneeId: creds.assigneeId,
      managerNotes: roappOnlyEnabled() ? bookingManagerNotes(booking.id) : comment,
      malfunction: comment,
      estimatedPrice:
        booking.package_id === "photo-inquiry"
          ? "Nach Fotobegutachtung"
          : `${(booking.total_cents / 100).toFixed(2)} EUR`,
      scheduledFor: schedule?.scheduledFor,
      scheduledTo: schedule?.scheduledTo,
    });
    await saveProgress(sql, booking.id, { ro_order_id: orderId });
    await createOrderComment(request, orderId, `WG-${booking.id}`);
  }

  if (!progress.order_items_done) {
    for (const item of items) {
      await addOrderItem(request, orderId, {
        entityId: item.entityId,
        assigneeId: creds.assigneeId,
        quantity: 1,
        price: item.price,
        comment: item.label,
      });
    }
    await saveProgress(sql, booking.id, { order_items_done: true });
  }

  await syncRoappPhotos(sql, booking.id, orderId, request);
  return { contactId, bookingId, orderId };
}

export async function runRoappSync(
  sql: Sql,
  options: {
    request?: RoappCall;
    creds?: RoappCredentials;
    bookingId?: number;
    limit?: number;
  } = {},
) {
  const result = { synced: 0, failed: 0, review: 0 };
  const [settings] = await sql<{
    roapp_sync_enabled: boolean;
  }>`select roapp_sync_enabled from shop_settings where shop_id=${SHOP}`;
  if (!settings?.roapp_sync_enabled) return result;
  const creds = options.creds || (options.request ? null : roappCredentialsFromEnv());
  if (!options.request && !creds) return result;
  const token = randomUUID();
  const deadline = Date.now() + 35_000;
  const lease =
    await sql`update roapp_sync_runner set lease_token=${token},locked_until=now()+interval '90 seconds'
    where shop_id=${SHOP} and (locked_until is null or locked_until < now()) returning shop_id`;
  if (!lease.length) return result;
  const transport =
    options.request ||
    createRoappClient(creds!, {
      minIntervalMs: 340,
    });
  const request: RoappCall = async (method, path, body, query) => {
    const active = await sql`select shop_id from roapp_sync_runner where shop_id=${SHOP}
      and lease_token=${token} and locked_until>now()`;
    if (!active.length) throw new RoappError("roapp_runner_expired", { review: true });
    if (Date.now() >= deadline) throw new RoappError("roapp_time_budget", { retryable: true });
    return transport(method, path, body, query);
  };
  const activeCreds =
    creds ||
    ({
      branchId: 0,
      assigneeId: 0,
      orderTypeId: 0,
      entityMap: {},
    } as RoappCredentials);
  try {
    for (let i = 0; i < (options.limit ?? 3) && Date.now() < deadline; i++) {
      const [row] = await sql<
        WorkflowBooking & { request_revision: string }
      >`select b.*,q.requested_at::text as request_revision from roapp_sync_queue q join bookings b on b.id=q.booking_id and b.shop_id=q.shop_id
        where q.shop_id=${SHOP} and q.status='pending' and q.next_attempt_at<=now() and (${options.bookingId ?? null}::integer is null or b.id=${options.bookingId ?? null})
        order by q.next_attempt_at,q.booking_id limit 1`;
      if (!row) break;
      const [progress] =
        await sql<QueueProgress>`select ro_contact_id,ro_booking_id,ro_order_id,booking_items_done,order_items_done
        from roapp_sync_queue where booking_id=${row.id}`;
      try {
        if (!options.request && !creds)
          throw new RoappError("roapp_not_configured", { review: true });
        const ids = await syncOneRoappBooking(
          sql,
          row,
          journalRoappWrites(sql, row.id, request),
          options.creds || creds || activeCreds,
          progress || {
            ro_contact_id: null,
            ro_booking_id: null,
            ro_order_id: null,
            booking_items_done: false,
            order_items_done: false,
          },
        );
        await sql`update roapp_sync_queue set synced_version=${row.version},
          ro_contact_id=${ids.contactId},ro_booking_id=${ids.bookingId},ro_order_id=${ids.orderId},
          booking_items_done=true,order_items_done=true,
          status=case when requested_version>${row.version} or requested_at<>${row.request_revision}::timestamptz then 'pending' else 'synced' end,attempts=0,last_error=null,updated_at=now()
          where booking_id=${row.id}`;
        result.synced++;
      } catch (error) {
        const code = error instanceof RoappError ? error.code : "roapp_processing_failed";
        const review = error instanceof RoappError && error.review;
        await sql`update roapp_sync_queue set attempts=attempts+1,
          status=case when ${review} then 'review' when attempts>=5 then 'failed' else 'pending' end,
          last_error=${code},next_attempt_at=now()+interval '5 minutes',updated_at=now() where booking_id=${row.id}`;
        if (review) result.review++;
        else result.failed++;
        break;
      }
    }
  } finally {
    await sql`update roapp_sync_runner set lease_token=null,locked_until=null where shop_id=${SHOP} and lease_token=${token}`;
  }
  return result;
}
