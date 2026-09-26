import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "./db.ts";
import type { WorkflowBooking } from "./booking-workflow.ts";
import { odooJson2, type OdooCredentials } from "./odoo.ts";
import { readOdooCredentials } from "./odoo-credentials.server.ts";
import { packages, vehicleClasses, extras } from "../data/site.ts";

const SHOP = "white-gloss";
const CONTEXT = {
  lang: "de_DE",
  tz: "Europe/Berlin",
  tracking_disable: true,
  mail_create_nosubscribe: true,
  mail_notify_force_send: false,
};
type RecordRow = { id: number; [key: string]: unknown };
export type OdooCall = <T>(
  model: string,
  method: string,
  body: Record<string, unknown>,
) => Promise<T>;
export class OdooSyncError extends Error {
  code: string;
  review: boolean;
  constructor(code: string, review = false) {
    super(code);
    this.code = code;
    this.review = review;
  }
}
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
const stageNames: Record<string, string> = {
  neu: "Neu",
  bestaetigt: "In Bearbeitung",
  erledigt: "Erledigt",
  abgelehnt: "Abgelehnt",
  storniert: "Storniert",
  nicht_erschienen: "Nicht erschienen",
};

export async function queueOdooBooking(sql: Sql, booking: Pick<WorkflowBooking, "id" | "version">) {
  await sql`insert into odoo_sync_queue(booking_id,shop_id,requested_version)
    values(${booking.id},${SHOP},${booking.version}) on conflict(booking_id) do update
    set requested_version=greatest(odoo_sync_queue.requested_version,excluded.requested_version),
    status='pending',next_attempt_at=now(),updated_at=now()`;
}

export function bookingOdooValues(booking: WorkflowBooking, partnerId: number, stageId: number) {
  const pack = packages.find((p) => p.id === booking.package_id)?.name || booking.package_id;
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
  const lines = [
    `Website-Buchung WG-${booking.id}`,
    `Status: ${booking.status === "neu" ? "Wartet auf manuelle Terminbestätigung" : stageNames[booking.status]}`,
    `Paket: ${pack}`,
    `Fahrzeugklasse: ${vehicleClass}`,
    `Extras: ${extraNames.join(", ") || "keine"}`,
    `Wunschtermin: ${booking.preferred_date || "offen"} ${booking.preferred_slot || ""}`,
    `Betrag laut Anfrage: ${(booking.total_cents / 100).toFixed(2)} EUR`,
    booking.city_slug ? `Abholort: ${booking.city_slug}` : "",
    booking.note || "",
    "Terminbestätigung erfolgt im Website-Betriebspanel. Angebote und Rechnungen werden in Odoo manuell erstellt und versendet.",
  ].filter(Boolean);
  return {
    x_name: `WG-${booking.id} · ${booking.customer_name} · ${pack}`,
    x_studio_char_1: `WG-${booking.id}`,
    x_studio_partner_id: partnerId,
    x_studio_stage_id: stageId,
    x_studio_date: booking.preferred_date || false,
    x_studio_value: booking.total_cents / 100,
    x_studio_notes: lines.map((line) => `<p>${escapeHtml(line)}</p>`).join(""),
  };
}

function remoteCall(creds: OdooCredentials, deadline: number): OdooCall {
  return async <T>(model: string, method: string, body: Record<string, unknown>) => {
    if (Date.now() >= deadline) throw new OdooSyncError("odoo_time_budget");
    try {
      const { response, payload } = await odooJson2<T>(creds, model, method, {
        ...body,
        context: CONTEXT,
      });
      if (!response.ok || payload === null)
        throw new OdooSyncError(
          response.status === 401 || response.status === 403
            ? "odoo_access_denied"
            : "odoo_request_failed",
        );
      return payload;
    } catch (error) {
      if (error instanceof OdooSyncError) throw error;
      throw new OdooSyncError("odoo_unreachable");
    }
  };
}

/** A lost create response is reconciled by external ID, never repeated blindly. */
export async function ensureOdooRecord(
  sql: Sql,
  call: OdooCall,
  model: string,
  field: string,
  externalId: string,
  values: Record<string, unknown>,
): Promise<number> {
  const found = await call<RecordRow[]>(model, "search_read", {
    domain: [[field, "=", externalId]],
    fields: ["id"],
    limit: 2,
  });
  if (!Array.isArray(found) || found.length > 1)
    throw new OdooSyncError("odoo_external_id_conflict", true);
  await sql`insert into odoo_record_links(model,external_id) values(${model},${externalId}) on conflict do nothing`;
  const [link] = await sql<{
    remote_id: number | null;
    create_attempted: boolean;
  }>`select remote_id,create_attempted from odoo_record_links where model=${model} and external_id=${externalId}`;
  if (found[0]) {
    const id = found[0].id;
    if (!Number.isSafeInteger(id) || id <= 0 || (link.remote_id && link.remote_id !== id))
      throw new OdooSyncError("odoo_record_changed", true);
    await sql`update odoo_record_links set remote_id=${id},create_attempted=false where model=${model} and external_id=${externalId}`;
    return id;
  }
  if (link.remote_id || link.create_attempted)
    throw new OdooSyncError("odoo_create_needs_review", true);
  const claimed =
    await sql`update odoo_record_links set create_attempted=true where model=${model} and external_id=${externalId} and remote_id is null and create_attempted=false returning external_id`;
  if (!claimed.length) throw new OdooSyncError("odoo_create_needs_review", true);
  const result = await call<number[]>(model, "create", {
    vals_list: [{ ...values, [field]: externalId }],
  });
  const id = Array.isArray(result) && result.length === 1 ? result[0] : null;
  if (!id || !Number.isSafeInteger(id)) throw new OdooSyncError("odoo_create_needs_review", true);
  await sql`update odoo_record_links set remote_id=${id},create_attempted=false where model=${model} and external_id=${externalId}`;
  return id;
}

export async function syncOneOdooBooking(sql: Sql, booking: WorkflowBooking, call: OdooCall) {
  const stageName = stageNames[booking.status];
  if (!stageName) throw new OdooSyncError("odoo_unknown_booking_status", true);
  // Stage records must be configured before enabling synchronization.
  const stages = await call<RecordRow[]>("x_auftrage_stage", "search_read", {
    domain: [["x_name", "=", stageName]],
    fields: ["id"],
    limit: 2,
  });
  if (stages.length !== 1) throw new OdooSyncError("odoo_stage_missing", true);
  const phone = booking.phone.replace(/[^\d+]/g, "").replace(/^00/, "+");
  const ref = `white-gloss:customer:${createHash("sha256").update(phone).digest("hex").slice(0, 24)}`;
  const partnerId = await ensureOdooRecord(sql, call, "res.partner", "ref", ref, {
    name: booking.customer_name,
    phone: booking.phone,
    email: booking.email || false,
    lang: "de_DE",
  });
  const values = bookingOdooValues(booking, partnerId, stages[0].id);
  const orderId = await ensureOdooRecord(
    sql,
    call,
    "x_auftrage",
    "x_studio_char_1",
    `WG-${booking.id}`,
    values,
  );
  // Contact details manually maintained in Odoo are retained. Booking-specific
  // values are authoritative only on this linked website order, not invoices.
  const written = await call<boolean>("x_auftrage", "write", { ids: [orderId], vals: values });
  if (written !== true) throw new OdooSyncError("odoo_write_failed");
  return orderId;
}

export async function runOdooSync(
  sql: Sql,
  options: { call?: OdooCall; bookingId?: number; limit?: number } = {},
) {
  const result = { synced: 0, failed: 0, review: 0 };
  const [settings] = await sql<{
    odoo_sync_enabled: boolean;
  }>`select odoo_sync_enabled from shop_settings where shop_id=${SHOP}`;
  if (!settings?.odoo_sync_enabled) return result;
  const creds = options.call ? null : await readOdooCredentials(sql);
  if (!options.call && !creds) return result;
  const token = randomUUID(),
    deadline = Date.now() + 35_000;
  const lease =
    await sql`update odoo_sync_runner set lease_token=${token},locked_until=now()+interval '90 seconds'
    where shop_id=${SHOP} and (locked_until is null or locked_until < now()) returning shop_id`;
  if (!lease.length) return result;
  const transport = options.call || remoteCall(creds!, deadline);
  const call: OdooCall = async <T>(
    model: string,
    method: string,
    body: Record<string, unknown>,
  ) => {
    const active = await sql`select shop_id from odoo_sync_runner where shop_id=${SHOP}
      and lease_token=${token} and locked_until>now()`;
    if (!active.length) throw new OdooSyncError("odoo_runner_expired", true);
    return transport<T>(model, method, body);
  };
  try {
    // Recover requests/edits written by an older release or a legacy import.
    // A compatible rollback must not permanently lose a synchronization event.
    await sql`insert into odoo_sync_queue(booking_id,shop_id,requested_version)
      select id,shop_id,version from bookings where shop_id=${SHOP}
      on conflict(booking_id) do update set requested_version=excluded.requested_version,
      status='pending',next_attempt_at=now(),updated_at=now()
      where excluded.requested_version>odoo_sync_queue.requested_version`;
    for (let i = 0; i < (options.limit ?? 3) && Date.now() < deadline; i++) {
      const [row] =
        await sql<WorkflowBooking>`select b.* from odoo_sync_queue q join bookings b on b.id=q.booking_id and b.shop_id=q.shop_id
        where q.shop_id=${SHOP} and q.status='pending' and q.next_attempt_at<=now() and (${options.bookingId ?? null}::integer is null or b.id=${options.bookingId ?? null})
        order by q.next_attempt_at,q.booking_id limit 1`;
      if (!row) break;
      try {
        const orderId = await syncOneOdooBooking(sql, row, call);
        await sql`update odoo_sync_queue set synced_version=${row.version},odoo_order_id=${orderId},
          status=case when requested_version>${row.version} then 'pending' else 'synced' end,attempts=0,last_error=null,updated_at=now()
          where booking_id=${row.id}`;
        result.synced++;
      } catch (error) {
        const code = error instanceof OdooSyncError ? error.code : "odoo_processing_failed";
        const review = error instanceof OdooSyncError && error.review;
        await sql`update odoo_sync_queue set attempts=attempts+1,
          status=case when ${review} then 'review' when attempts>=5 then 'failed' else 'pending' end,
          last_error=${code},next_attempt_at=now()+interval '5 minutes',updated_at=now() where booking_id=${row.id}`;
        if (review) result.review++;
        else result.failed++;
        // An outage must not mark every booking during the same run.
        break;
      }
    }
  } finally {
    await sql`update odoo_sync_runner set lease_token=null,locked_until=null where shop_id=${SHOP} and lease_token=${token}`;
  }
  return result;
}
