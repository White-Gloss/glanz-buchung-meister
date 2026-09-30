import { defaultDurationMinutes } from "./booking-time.ts";
import { randomUUID } from "node:crypto";
import type { Sql } from "./db.ts";
import type { WorkflowBooking } from "./booking-workflow.ts";
import { customerAddress } from "./customer-address.ts";
import { packages, vehicleClasses, extras, pickupPricing, cities, site } from "../data/site.ts";
import { roappOnlyEnabled, roappAccountScope, roappCutoverAt } from "./booking-backend.ts";
import { isCalendarDate } from "./calendar-date.ts";
import { journalRoappWrites } from "./roapp-write-journal.ts";
import { syncRoappPhotos } from "./roapp-photo-links.ts";
import {
  addOrderItem,
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

export type RoappCall = RoappRequest;

export async function queueRoappBooking(
  sql: Sql,
  booking: Pick<WorkflowBooking, "id" | "version">,
) {
  if (!roappOnlyEnabled()) return;
  const scope = roappAccountScope();
  const cutover = roappCutoverAt();
  await sql`insert into roapp_sync_queue(booking_id,shop_id,requested_version,account_scope)
    select b.id,b.shop_id,${booking.version},${scope} from bookings b
    where b.id=${booking.id} and b.shop_id=${SHOP} and b.created_at>=${cutover}::timestamptz
    on conflict(booking_id) do update
    set requested_version=greatest(roapp_sync_queue.requested_version,excluded.requested_version),
    status=case when roapp_sync_queue.status='review' then 'review' else 'pending' end,
    next_attempt_at=now(),requested_at=clock_timestamp(),updated_at=now()
    where roapp_sync_queue.account_scope=excluded.account_scope`;
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
  booking: Pick<WorkflowBooking, "preferred_date" | "preferred_slot"> & { package_id?: string },
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
  const end = new Date(
    start.getTime() + (defaultDurationMinutes[booking.package_id || ""] ?? 180) * 60_000,
  );
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
    customerAddress(booking) ? `Rechnungsadresse: ${customerAddress(booking)}` : "",
    booking.email ? `E-Mail: ${booking.email}` : "",
    `Paket: ${pack}`,
    `Fahrzeugklasse: ${vehicleClass}`,
    `Extras: ${extraNames.join(", ") || "keine"}`,
    booking.package_id === "photo-inquiry"
      ? "Preis nach Fotobegutachtung festlegen."
      : `Ab-Preis bei Eingang: ${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(booking.total_cents / 100)}`,
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
    "3. Erst nach der Prüfung „Fixpreis bestätigt“ wählen. RO sendet jetzt das geprüfte Angebot zur Kundenunterschrift.",
    "4. Der Kunde nimmt selbst über den Link an. „Akzeptiert“ nicht stellvertretend setzen.",
    "5. Die Kundenunterschrift prüfen, Abholung oder Anlieferung abstimmen, danach „Termin verbindlich“ wählen. Erinnerung drei Tage vorher. Bei Arbeitsbeginn „In Arbeit“, nach Abschluss „Erledigt“ wählen.",
    process.env.ROAPP_INVOICE_ENABLED?.trim() === "true"
      ? "6. Nach „Erledigt“ erstellt die Website die Rechnung (sieben Tage Zahlungsziel) aus den RO-Positionen und sendet sie per E-Mail. In RO keine zusätzliche Rechnung anlegen. Zahlungen erst nach tatsächlichem Eingang im Website-Betriebspanel erfassen; bei Barzahlung folgt die Quittung automatisch. Status allein ist kein Zahlungsnachweis."
      : "6. Rechnung nach der Leistung erstellen: sieben Tage Zahlungsziel. Nur tatsächlich erhaltenes Bargeld als Zahlung buchen und dann den bezahlten Beleg senden. Status allein ist kein Zahlungsnachweis.",
    "7. Bei erteilter Einwilligung folgt sieben Tage nach Abschluss einmalig die Bewertungs-E-Mail. Keine Auswahl nach Kundenzufriedenheit.",
    "Bei fehlender E-Mail diese vor der Angebotsfreigabe beim Kunden erfragen und ergänzen. Die Einwilligung für RO-Auftrags-E-Mails im Kontakt prüfen.",
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
    where booking_id=${bookingId} and account_scope=${roappAccountScope()}`;
}

export async function syncOneRoappBooking(
  sql: Sql,
  booking: WorkflowBooking,
  request: RoappCall,
  creds: Pick<RoappCredentials, "branchId" | "assigneeId" | "orderTypeId" | "entityMap">,
  progress: QueueProgress,
) {
  if (booking.preferred_date && booking.preferred_slot) bookingSchedule(booking);
  const items = progress.order_items_done ? [] : bookingLineItems(booking, creds.entityMap);
  if (
    !progress.order_items_done &&
    booking.package_id !== "photo-inquiry" &&
    items.reduce((sum, item) => sum + Math.round(item.price * 100), 0) !== booking.total_cents
  )
    throw new RoappError("roapp_quote_changed", { review: true });
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

  const bookingId = null;

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
          : `ab ${(booking.total_cents / 100).toFixed(2)} EUR`,
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
  if (!roappOnlyEnabled()) return result;
  const scope = roappAccountScope();
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
        where q.shop_id=${SHOP} and q.account_scope=${scope} and q.status='pending' and q.next_attempt_at<=now() and (${options.bookingId ?? null}::integer is null or b.id=${options.bookingId ?? null})
        order by q.next_attempt_at,q.booking_id limit 1`;
      if (!row) break;
      const [progress] =
        await sql<QueueProgress>`select ro_contact_id,ro_booking_id,ro_order_id,booking_items_done,order_items_done
        from roapp_sync_queue where booking_id=${row.id} and account_scope=${scope}`;
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
          where booking_id=${row.id} and account_scope=${scope}`;
        result.synced++;
        console.info(
          "[roapp-sync] transferred",
          JSON.stringify({ booking: `WG-${row.id}`, order: ids.orderId }),
        );
      } catch (error) {
        const code = error instanceof RoappError ? error.code : "roapp_processing_failed";
        const review = error instanceof RoappError && error.review;
        const [stored] = await sql<{
          status: string;
        }>`update roapp_sync_queue set attempts=attempts+1,
          status=case when ${review} then 'review' when attempts>=5 then 'failed' else 'pending' end,
          last_error=${code},next_attempt_at=now()+interval '5 minutes',updated_at=now() where booking_id=${row.id} and account_scope=${scope}
          returning status`;
        // Operational metadata only: booking number, code and HTTP status, never customer data.
        console.warn(
          "[roapp-sync] transfer_failed",
          JSON.stringify({
            booking: `WG-${row.id}`,
            status: stored?.status,
            code,
            http: error instanceof RoappError ? error.status : null,
            error: error instanceof RoappError ? undefined : errorKind(error),
          }),
        );
        if (stored && stored.status !== "pending")
          await alertTransferProblem(sql, row.id, stored.status, code).catch(() => undefined);
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

function errorKind(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  return {
    name: error instanceof Error ? error.name : typeof error,
    sqlstate: typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : undefined,
  };
}

/** Plain-language reasons for the owner; codes stay stable for diagnostics. */
export const transferProblemText: Record<string, string> = {
  roapp_catalog_mapping_missing:
    "Eine gebuchte Leistung fehlt in der RO-Zuordnung (ROAPP_ENTITY_MAP) im Server-Environment.",
  roapp_pickup_mapping_missing: "Die Abholpauschale fehlt in der RO-Zuordnung (ROAPP_ENTITY_MAP).",
  roapp_quote_changed: "Die Positionssumme passt nicht zum Website-Preis der Anfrage.",
  roapp_account_identity_missing: "ROAPP_EXPECTED_COMPANY_CREATED_AT fehlt im Server-Environment.",
  roapp_account_identity_mismatch:
    "Das RO-Konto des API-Schlüssels passt nicht zu ROAPP_EXPECTED_COMPANY_CREATED_AT.",
  roapp_access_denied: "RO lehnt den API-Schlüssel ab (ungültig oder ohne Rechte).",
  roapp_request_failed: "RO hat eine Anfrage abgelehnt oder mit einem Fehler beantwortet.",
  roapp_write_needs_reconciliation:
    "Die Antwort von RO war unklar. Bitte in RO prüfen, ob Kontakt/Auftrag angelegt wurden; sonst den Auftrag manuell anlegen.",
  roapp_create_needs_review: "RO hat keine Kennung für den neu angelegten Datensatz geliefert.",
  roapp_contact_ambiguous: "In RO gibt es mehrere Kontakte mit derselben E-Mail-Adresse.",
  roapp_contact_invalid: "Der gefundene RO-Kontakt hat ein unerwartetes Format.",
  roapp_missing_phone: "Die Anfrage enthält keine gültige Telefonnummer.",
  roapp_missing_slot: "Die Anfrage enthält keinen vollständigen Wunschtermin.",
  roapp_invalid_slot: "Der Wunschtermin ist ungültig (z. B. Zeitumstellung).",
  roapp_not_configured: "Die RO-Zugangsdaten fehlen im Server-Environment.",
  roapp_unreachable: "RO war nicht erreichbar.",
  roapp_runner_expired: "Die Übertragung wurde wegen Zeitüberschreitung unterbrochen.",
  roapp_processing_failed: "Unerwarteter Fehler auf der Website bei der Übertragung.",
};

async function alertTransferProblem(sql: Sql, bookingId: number, status: string, code: string) {
  const { enqueueNotification } = await import("./booking-notifications.ts");
  const id = await enqueueNotification(sql, {
    key: `wg-ro-v1:${roappAccountScope()}:${bookingId}:owner:transfer-${status}-${code}`,
    eventType: "wg.ro.owner",
    channel: "email",
    to: site.bookingEmail,
    bookingId,
    subject: `WG-${bookingId}: Anfrage nicht an RO App übertragen`,
    body: [
      `Die Website-Anfrage WG-${bookingId} wurde nicht nach RO App übertragen (${code}).`,
      transferProblemText[code] || "Unbekannter Übertragungsfehler.",
      "Die Anfrage ist auf der Website gespeichert und geht nicht verloren.",
      "Nach der Korrektur im Betriebspanel (Betrieb → Übertragung nach RO) „Erneut übertragen“ wählen.",
    ].join("\n"),
  });
  if (id)
    await sql`insert into automation_events(shop_id, area, event, severity, context)
      values (${SHOP}, 'roapp', 'uebertragung-pruefen', 'error', ${`WG-${bookingId}: ${code}`})`;
}

type TransferRow = {
  booking_id: number;
  status: string;
  last_error: string | null;
  attempts: number;
  ro_order_id: number | null;
  created_at: string;
  updated_at: string;
};

/** Read-only overview for the operating panel and the diagnostics log. */
export async function roappTransferOverview(sql: Sql) {
  const scope = roappAccountScope();
  const cutover = roappCutoverAt();
  const [settings] = await sql<{ roapp_sync_enabled: boolean }>`
    select roapp_sync_enabled from shop_settings where shop_id=${SHOP}`;
  let credentials: "ok" | "missing" | "invalid" = "missing";
  try {
    credentials = roappCredentialsFromEnv() ? "ok" : "missing";
  } catch {
    credentials = "invalid";
  }
  const rows =
    await sql<TransferRow>`select q.booking_id,q.status,q.last_error,q.attempts,q.ro_order_id,
      to_char(b.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
      to_char(q.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
    from roapp_sync_queue q join bookings b on b.id=q.booking_id and b.shop_id=q.shop_id
    where q.shop_id=${SHOP} and q.account_scope=${scope}
    order by b.created_at desc limit 30`;
  const [unqueued] = await sql<{ count: number }>`select count(*)::int as count from bookings b
    where b.shop_id=${SHOP} and b.created_at>=${cutover}::timestamptz
      and not exists (select 1 from roapp_sync_queue q where q.booking_id=b.id and q.account_scope=${scope})`;
  const [recent] = await sql<{ count: number }>`select count(*)::int as count from bookings
    where shop_id=${SHOP} and created_at>now()-interval '7 days'`;
  return {
    syncEnabled: Boolean(settings?.roapp_sync_enabled),
    credentials,
    cutover,
    bookings7d: recent?.count ?? 0,
    unqueuedSinceCutover: unqueued?.count ?? 0,
    rows,
  };
}

let lastDiagnostics = 0;
/** Writes one privacy-safe summary line at most hourly (and after each restart). */
export async function logRoappDiagnostics(sql: Sql, now = Date.now()) {
  if (!roappOnlyEnabled() || now - lastDiagnostics < 3_600_000) return;
  lastDiagnostics = now;
  const overview = await roappTransferOverview(sql);
  const counts: Record<string, number> = {};
  for (const row of overview.rows) counts[row.status] = (counts[row.status] || 0) + 1;
  console.info(
    "[roapp-sync] diagnostics",
    JSON.stringify({
      syncEnabled: overview.syncEnabled,
      credentials: overview.credentials,
      cutover: overview.cutover,
      bookings7d: overview.bookings7d,
      unqueuedSinceCutover: overview.unqueuedSinceCutover,
      queue: counts,
      problems: overview.rows
        .filter((row) => row.status !== "synced")
        .slice(0, 10)
        .map((row) => `WG-${row.booking_id}:${row.status}:${row.last_error || "-"}`),
    }),
  );
}

/** Owner action after fixing the cause. The write journal still blocks any write whose
 * outcome was unclear, so a retry can never create a second RO contact or order. */
export async function retryRoappTransfer(sql: Sql, bookingId: number) {
  const rows = await sql`update roapp_sync_queue set status='pending',attempts=0,last_error=null,
      next_attempt_at=now(),updated_at=now()
    where booking_id=${bookingId} and shop_id=${SHOP} and account_scope=${roappAccountScope()}
      and status in ('review','failed') returning booking_id`;
  return rows.length > 0;
}
