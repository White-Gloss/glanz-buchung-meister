import { randomUUID } from "node:crypto";
import { getSql, type Sql } from "./db.ts";
import { kickBookingDelivery } from "./booking-delivery.ts";
import {
  saveManualBookingRequest,
  confirmBookingManually,
  changeBookingStatus,
  editBooking,
  type WorkflowStatus,
} from "./booking-workflow.ts";
import { canConfirmBookings } from "./booking-owner.ts";
import { ensureQontoInvoiceForBooking, sendQontoInvoiceEmailForBooking } from "./qonto-invoice.ts";
import { qontoConfigured } from "./qonto-mail.ts";
import { hubAuthorized, hubRequestSchema, hubSecretConfigured, type HubRequest } from "./hub-sync-auth.ts";

export { hubAuthorized, hubRequestSchema, hubSecretConfigured } from "./hub-sync-auth.ts";
export type { HubRequest } from "./hub-sync-auth.ts";

const SHOP = "white-gloss";

export type HubBooking = {
  id: number;
  version: number;
  status: "neu" | "bestaetigt" | "abgelehnt" | "storniert" | "erledigt" | "nicht_erschienen";
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
  qonto_client_id: string | null;
  qonto_invoice_id: string | null;
  qonto_invoice_number: string | null;
  qonto_invoice_status: string | null;
  qonto_invoice_error: string | null;
  qonto_sent_at: string | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function hubActor(sql: Sql): Promise<string> {
  const ownerId = process.env.OWNER_USER_ID?.trim();
  if (ownerId && (await canConfirmBookings(sql, ownerId))) return ownerId;
  const email = (process.env.OWNER_EMAIL?.trim() || "").toLowerCase();
  if (email) {
    const [user] = await sql<{ id: string }>`
      select id from "user" where lower(email) = ${email} and "emailVerified" = true limit 1
    `;
    if (user?.id && (await canConfirmBookings(sql, user.id))) return user.id;
  }
  throw new Error("Hub-Sync: Inhaber-Konto fehlt. OWNER_USER_ID auf dem Server setzen.");
}

async function loadBooking(sql: Sql, id: number): Promise<HubBooking | null> {
  const [row] = await sql<HubBooking>`
    select id, status, version, customer_name, phone, email, preferred_date, preferred_slot,
      package_id, class_id, extra_ids, city_slug, note, total_cents, pickup_cents,
      qonto_client_id, qonto_invoice_id, qonto_invoice_number, qonto_invoice_status, qonto_invoice_error, qonto_sent_at
    from bookings where shop_id = ${SHOP} and id = ${id} limit 1
  `;
  return row ?? null;
}

async function listBookings(sql: Sql): Promise<HubBooking[]> {
  return sql<HubBooking>`
    select id, status, version, customer_name, phone, email, preferred_date, preferred_slot,
      package_id, class_id, extra_ids, city_slug, note, total_cents, pickup_cents,
      qonto_client_id, qonto_invoice_id, qonto_invoice_number, qonto_invoice_status, qonto_invoice_error, qonto_sent_at
    from bookings where shop_id = ${SHOP} order by created_at desc limit 200
  `;
}

async function maybeQonto(sql: Sql, booking: HubBooking, status: string): Promise<HubBooking> {
  if (status !== "erledigt") return (await loadBooking(sql, booking.id)) ?? booking;
  await ensureQontoInvoiceForBooking(sql, {
    id: booking.id,
    customer_name: booking.customer_name,
    email: booking.email,
    package_id: booking.package_id,
    extra_ids: booking.extra_ids,
    total_cents: booking.total_cents,
    pickup_cents: booking.pickup_cents,
    qonto_client_id: booking.qonto_client_id,
    qonto_invoice_id: booking.qonto_invoice_id,
    qonto_invoice_number: booking.qonto_invoice_number,
    qonto_invoice_status: booking.qonto_invoice_status,
  });
  return (await loadBooking(sql, booking.id)) ?? booking;
}

async function dispatch(sql: Sql, request: HubRequest): Promise<{ bookings?: HubBooking[]; booking?: HubBooking }> {
  if (request.action === "list") return { bookings: await listBookings(sql) };

  if (request.action === "create") {
    const actor = await hubActor(sql);
    const result = await saveManualBookingRequest(
      sql,
      {
        idempotencyKey: randomUUID(),
        name: request.name,
        phone: request.phone,
        email: request.email ?? "",
        date: request.date,
        slot: request.slot,
        packageId: request.packageId,
        classId: request.classId,
        extraIds: request.extraIds,
        citySlug: request.citySlug ?? "",
        note: request.note,
        kind: "booking",
        notifyCustomer: request.notifyCustomer ?? false,
      },
      actor,
    );
    const booking = await loadBooking(sql, result.booking.id);
    if (!booking) throw new Error("Buchung nicht gefunden.");
    return { booking };
  }

  const actor = await hubActor(sql);
  if (request.action === "confirm") {
    const result = await confirmBookingManually(sql, request.id, request.expectedVersion, actor);
    const booking = await loadBooking(sql, result.booking.id);
    if (!booking) throw new Error("Buchung nicht gefunden.");
    return { booking };
  }
  if (request.action === "status") {
    const result = await changeBookingStatus(
      sql,
      request.id,
      request.expectedVersion,
      request.status as WorkflowStatus,
      actor,
    );
    const booking = await maybeQonto(
      sql,
      {
        id: result.booking.id,
        version: result.booking.version,
        status: result.booking.status,
        customer_name: result.booking.customer_name,
        phone: result.booking.phone,
        email: result.booking.email,
        preferred_date: result.booking.preferred_date,
        preferred_slot: result.booking.preferred_slot,
        package_id: result.booking.package_id,
        class_id: result.booking.class_id,
        extra_ids: result.booking.extra_ids,
        city_slug: result.booking.city_slug,
        note: result.booking.note,
        total_cents: result.booking.total_cents,
        pickup_cents: result.booking.pickup_cents,
        qonto_client_id: null,
        qonto_invoice_id: null,
        qonto_invoice_number: null,
        qonto_invoice_status: null,
        qonto_invoice_error: null,
        qonto_sent_at: null,
      },
      request.status,
    );
    return { booking };
  }
  if (request.action === "edit") {
    const result = await editBooking(
      sql,
      request.id,
      request.expectedVersion,
      {
        name: request.name,
        phone: request.phone,
        email: request.email ?? "",
        date: request.date,
        slot: request.slot,
        packageId: request.packageId,
        classId: request.classId,
        extraIds: request.extraIds,
        citySlug: request.citySlug ?? "",
        note: request.note,
      },
      actor,
    );
    const booking = await loadBooking(sql, result.booking.id);
    if (!booking) throw new Error("Buchung nicht gefunden.");
    return { booking };
  }
  if (request.action === "qonto_ensure") {
    const current = await loadBooking(sql, request.id);
    if (!current) throw new Error("Buchung nicht gefunden.");
    const ensured = await maybeQonto(sql, current, "erledigt");
    return { booking: ensured };
  }
  const sent = await sendQontoInvoiceEmailForBooking(sql, request.id);
  if (!sent.ok) throw new Error(sent.error);
  const booking = await loadBooking(sql, request.id);
  if (!booking) throw new Error("Buchung nicht gefunden.");
  return { booking };
}

export async function handleHubRequest(request: Request): Promise<Response> {
  if (!hubSecretConfigured()) {
    return json({ ok: false, error: "Hub-Sync nicht konfiguriert." }, 503);
  }
  if (!hubAuthorized(request.headers.get("authorization"))) {
    return json({ ok: false, error: "Nicht berechtigt." }, 401);
  }
  if (request.method !== "POST" && request.method !== "GET") {
    return json({ ok: false, error: "Methode nicht erlaubt." }, 405);
  }
  let raw: unknown = { action: "list" };
  if (request.method === "POST") {
    try {
      raw = await request.json();
    } catch {
      return json({ ok: false, error: "Ungültige Anfrage." }, 400);
    }
  }
  const parsed = hubRequestSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "Ungültige Anfrage." }, 400);
  try {
    const sql = await getSql();
    const result = await dispatch(sql, parsed.data);
    kickBookingDelivery(sql);
    return json({
      ok: true,
      qontoConfigured: qontoConfigured(),
      bookings: result.bookings,
      booking: result.booking,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fehler.";
    const conflict = /geändert|Konflikt|zulässig|Bestätigung|Inhaber/i.test(message);
    return json({ ok: false, error: message }, conflict ? 409 : 400);
  }
}
