import { ensureBitrixWorkshopSchema } from "./bitrix-workshop-schema.ts";
import { formatBerlinRange } from "./booking-time.ts";
import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "./db.ts";
import type { WorkflowBooking } from "./booking-workflow.ts";
import {
  cities,
  extras,
  packages,
  pickupFee,
  vehicleClasses,
  type PackageId,
} from "../data/site.ts";
import { createSignedPhotoUrl } from "./booking-photos.ts";
import { BitrixError, createBitrixClient, productMapFromEnv, type BitrixCall } from "./bitrix.ts";
import { readBitrixWebhook } from "./bitrix-credentials.server.ts";
import { MAX_UPLOAD_BYTES, UPLOAD_MIME_TYPES } from "./upload-policy.ts";

const SHOP = "white-gloss";
const UF = {
  photos: "ufCrmWgPhotos",
  vehicle: "ufCrmWgVehicle",
  package: "ufCrmWgPackage",
  extras: "ufCrmWgExtras",
  city: "ufCrmWgCity",
  appointment: "ufCrmWgAppointment",
  prefDates: "ufCrmWgPrefDates",
  class: "ufCrmWgClass",
  bookingRef: "ufCrmWgBookingRef",
  bookingVersion: "ufCrmWgBookingVersion",
  workEnd: "ufCrmWgWorkEnd",
  durationMinutes: "ufCrmWgDurationMinutes",
  resourceId: "ufCrmWgResourceId",
  agreedPrice: "ufCrmWgAgreedPrice",
  serviceLines: "ufCrmWgServiceLines",
  acceptedAt: "ufCrmWgAcceptedAt",
  paymentMethod: "ufCrmWgPaymentMethod",
  cashAmount: "ufCrmWgCashAmount",
  paymentDate: "ufCrmWgPaymentDate",
} as const;

const STAGE = {
  neu: "NEW",
  bestaetigt: "EXECUTING",
  erledigt: "FINAL_INVOICE",
  abgelehnt: "LOSE",
  storniert: "APOLOGY",
  inPruefung: "PREPARATION",
  kundenrueckmeldung: "PREPAYMENT_INVOICE",
} as const;

export type BitrixBooking = WorkflowBooking & {
  bitrix_workshop_managed?: boolean;
  bitrix_final_rows?: Record<string, unknown>[] | null;
  bitrix_invoice_id?: number | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_plate?: string | null;
  bitrix_contact_id?: number | null;
  bitrix_deal_id?: number | null;
  bitrix_event_id?: number | null;
  work_start_at?: string | Date | null;
  work_end_at?: string | Date | null;
  agreed_price_cents?: number | null;
  ops_stage?: string;
  invoice_status?: string;
  payment_status?: string;
  resource_id?: number;
  customer_accepted_at?: string | Date | null;
  payment_method?: string | null;
  payment_recorded_cents?: number | null;
  payment_recorded_on?: string | null;
};

type QueueProgress = {
  bitrix_contact_id: number | null;
  bitrix_deal_id: number | null;
  bitrix_event_id: number | null;
  photos_done: boolean;
  photos_revision?: number;
  details_done?: boolean;
  photo_keys?: string[] | null;
  initial_deal?: Record<string, unknown> | null;
  initial_products?: ReturnType<typeof bookingLineItems> | null;
  write_pending?: string | null;
};

type PhotoInput = { key?: string; name: string; mime: string; base64: string };

export async function ensureBitrixSchema(sql: Sql) {
  await ensureBitrixWorkshopSchema(sql);
  await sql`alter table bookings add column if not exists bitrix_contact_id integer`;
  await sql`alter table bookings add column if not exists bitrix_deal_id integer`;
  await sql`alter table bookings add column if not exists bitrix_event_id integer`;
  await sql`alter table bookings add column if not exists bitrix_last_error text`;
  await sql`create table if not exists bitrix_sync_queue (
    booking_id integer primary key references bookings(id),
    shop_id text not null default 'white-gloss',
    requested_version integer not null,
    synced_version integer not null default 0,
    status text not null default 'pending' check(status in ('pending','synced','failed','review')),
    attempts integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    last_error text,
    bitrix_contact_id integer,
    bitrix_deal_id integer,
    bitrix_event_id integer,
    photos_done boolean not null default false,
    updated_at timestamptz not null default now()
  )`;
  await sql`alter table bitrix_sync_queue add column if not exists write_pending text`;
  await sql`alter table bitrix_sync_queue add column if not exists details_done boolean not null default false`;
  await sql`alter table bitrix_sync_queue add column if not exists photo_keys text[]`;
  await sql`alter table bitrix_sync_queue add column if not exists photos_revision integer not null default 0`;
  await sql`alter table bitrix_sync_queue add column if not exists initial_deal jsonb`;
  await sql`alter table bitrix_sync_queue add column if not exists initial_products jsonb`;
  await sql`update bitrix_sync_queue set details_done=true where synced_version>0 and not details_done`;
  await sql`update bitrix_sync_queue set photo_keys='{}' where synced_version=0 and photo_keys is null`;
  await sql`create index if not exists bitrix_sync_due_idx on bitrix_sync_queue(status,next_attempt_at)`;
  await sql`create table if not exists bitrix_sync_runner (
    shop_id text primary key,
    lease_token text,
    locked_until timestamptz
  )`;
  await sql`insert into bitrix_sync_runner(shop_id) values('white-gloss') on conflict do nothing`;
  await sql`alter table shop_settings add column if not exists vibe_api_key text`;
}

export async function queueBitrixBooking(
  sql: Sql,
  booking: Pick<WorkflowBooking, "id" | "version">,
) {
  await ensureBitrixSchema(sql);
  const [source] =
    await sql<BitrixBooking>`select * from bookings where id=${booking.id} and shop_id=${SHOP}`;
  if (!source) throw new Error("Buchung nicht gefunden.");
  const initialDeal = JSON.stringify(bookingDealBody(source, 0));
  const initialProducts = JSON.stringify(bookingLineItems(source, productMapFromEnv()));
  await sql`insert into bitrix_sync_queue(booking_id,shop_id,requested_version,initial_deal,initial_products)
    values(${booking.id},${SHOP},${booking.version},${initialDeal}::jsonb,${initialProducts}::jsonb) on conflict(booking_id) do update
    set requested_version=greatest(bitrix_sync_queue.requested_version,excluded.requested_version),
    status=case when bitrix_sync_queue.status='review' then 'review' else 'pending' end,next_attempt_at=now(),updated_at=now()`;
}

export async function queueBitrixPhotos(
  sql: Sql,
  booking: Pick<WorkflowBooking, "id" | "version">,
) {
  await queueBitrixBooking(sql, booking);
  await sql`update bitrix_sync_queue set photos_done=false,photos_revision=photos_revision+1,status=case when status='review' then 'review' else 'pending' end,next_attempt_at=now(),updated_at=now()
    where booking_id=${booking.id}`;
}

export function parseExtraIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map((id) => String(id)) : [];
  } catch {
    return [];
  }
}

export function bookingVehicle(booking: BitrixBooking): string {
  return [booking.vehicle_make, booking.vehicle_model, booking.vehicle_plate]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(" ");
}

export function stageForStatus(status: WorkflowBooking["status"], opsStage?: string): string {
  if (status === "bestaetigt") return STAGE.bestaetigt;
  if (status === "erledigt") return STAGE.erledigt;
  if (status === "storniert") return STAGE.storniert;
  if (status === "abgelehnt" || status === "nicht_erschienen") {
    return STAGE.abgelehnt;
  }
  if (opsStage === "kundenrueckmeldung") return STAGE.kundenrueckmeldung;
  if (opsStage === "in_pruefung") return STAGE.inPruefung;
  return STAGE.neu;
}

export function splitCustomerName(name: string): { name: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { name: "Kunde", lastName: "Website" };
  if (parts.length === 1) return { name: parts[0], lastName: "" };
  return { name: parts[0], lastName: parts.slice(1).join(" ") };
}

export function bookingLineItems(booking: BitrixBooking, productMap: Record<string, number>) {
  const pack = packages.find((p) => p.id === booking.package_id);
  const klass = vehicleClasses.find((v) => v.id === booking.class_id);
  const factor = klass?.factor ?? 1;
  const items: Array<{ catalogId: string; productId: number; name: string; price: number }> = [];
  const packId = productMap[booking.package_id];
  if (pack && packId) {
    items.push({
      catalogId: booking.package_id,
      productId: packId,
      name: pack.name,
      price: Math.round(pack.price * factor * 100) / 100,
    });
  }
  for (const extraId of parseExtraIds(booking.extra_ids)) {
    const extra = extras.find((e) => e.id === extraId);
    const productId = productMap[extraId];
    if (!extra || !productId) continue;
    items.push({
      catalogId: extraId,
      productId,
      name: extra.name,
      price: Math.round(extra.price * factor * 100) / 100,
    });
  }
  const pickupCents = Math.max(0, booking.pickup_cents | 0);
  if (pickupCents > 0) {
    const pickupId = pickupCents <= 5000 ? "hol20" : "hol50";
    const productId = productMap[pickupId];
    const extra = extras.find((e) => e.id === pickupId);
    if (productId) {
      items.push({
        catalogId: pickupId,
        productId,
        name: extra?.name || `Hol- und Bringservice`,
        price: pickupCents / 100,
      });
    }
  }
  if (booking.agreed_price_cents != null && items.length) {
    const total = items.reduce((sum, item) => sum + Math.round(item.price * 100), 0);
    let remaining = booking.agreed_price_cents;
    items.forEach((item, index) => {
      const cents =
        index === items.length - 1
          ? remaining
          : total
            ? Math.round((Math.round(item.price * 100) / total) * booking.agreed_price_cents!)
            : 0;
      remaining -= cents;
      item.price = cents / 100;
    });
  }
  return items;
}

function packageLabel(booking: BitrixBooking) {
  const pack = packages.find((p) => p.id === booking.package_id);
  if (pack) return pack.name;
  return booking.package_id === "photo-inquiry" ? "Individuelle Fotoanfrage" : booking.package_id;
}

export function bookingDealBody(booking: BitrixBooking, contactId: number) {
  const packName = packageLabel(booking);
  const klass = vehicleClasses.find((v) => v.id === booking.class_id);
  const city = cities.find((c) => c.slug === booking.city_slug);
  const extraNames = parseExtraIds(booking.extra_ids).map(
    (id) => extras.find((e) => e.id === id)?.name || id,
  );
  const vehicle = bookingVehicle(booking) || "Fahrzeug laut Anfrage";
  const wish = [booking.preferred_date, booking.preferred_slot].filter(Boolean).join(" ");
  const pickupKm = city?.km;
  const pickup = pickupKm == null ? null : pickupFee(pickupKm, booking.package_id as PackageId);
  const start = booking.work_start_at ? new Date(booking.work_start_at) : null;
  const end = booking.work_end_at ? new Date(booking.work_end_at) : null;
  const hasInterval = start && end && Number.isFinite(start.getTime()) && end > start;
  return {
    title: `WG-${booking.id} · ${vehicle} · ${packName}`,
    contactId,
    stageId: stageForStatus(booking.status, booking.ops_stage),
    typeId: "SERVICES",
    sourceId: "WEB",
    currency: "EUR",
    amount: (booking.agreed_price_cents ?? booking.total_cents) / 100,
    isManualOpportunity: true,
    opened: booking.status === "neu" || booking.status === "bestaetigt",
    comments: [
      `Buchungsanfrage white-gloss.de/#buchung`,
      `Vorgang WG-${booking.id}`,
      `Kunde: ${booking.customer_name}`,
      `Telefon: ${booking.phone}`,
      booking.email ? `E-Mail: ${booking.email}` : null,
      `Fahrzeug: ${vehicle}`,
      `Klasse: ${klass?.label || booking.class_id}`,
      `Paket: ${packName}`,
      extraNames.length ? `Zusatz: ${extraNames.join(", ")}` : null,
      city ? `Ort: ${city.name}` : booking.city_slug ? `Ort: ${booking.city_slug}` : null,
      pickup === null ? "Abholung auf Anfrage – nicht im Richtpreis." : null,
      wish ? `Wunschtermin: ${wish}` : null,
      `Arbeitsstand: ${booking.ops_stage || booking.status}`,
      booking.agreed_price_cents != null
        ? `Vereinbarter Preis: ${(booking.agreed_price_cents / 100).toFixed(2)} EUR`
        : `Vorläufiger Richtpreis: ${(booking.total_cents / 100).toFixed(2)} EUR; noch keine verbindliche Zusage.`,
      booking.work_start_at && booking.work_end_at
        ? `Geplanter Zeitraum: ${formatBerlinRange(new Date(booking.work_start_at), new Date(booking.work_end_at))}`
        : "Arbeitsdauer noch manuell festzulegen.",
      `Rechnungsstatus (Website): ${booking.invoice_status || "nicht_erstellt"}; Zahlung: ${booking.payment_status || "offen"}`,
      "Buchungsfreigabe und Leistungsabschluss erfolgen manuell. Dieser Deal ist keine Rechnung.",
      booking.note || null,
    ]
      .filter(Boolean)
      .join("\n"),
    [UF.vehicle]: vehicle,
    [UF.package]: packName,
    [UF.extras]: extraNames.join(", "),
    [UF.city]: city?.name || booking.city_slug || "",
    [UF.class]: klass?.label || booking.class_id,
    [UF.prefDates]: wish,
    [UF.bookingRef]: `WG-${booking.id}`,
    [UF.bookingVersion]: booking.version,
    [UF.appointment]: hasInterval ? start.toISOString() : null,
    [UF.workEnd]: hasInterval ? end.toISOString() : null,
    [UF.durationMinutes]: hasInterval
      ? Math.round((end.getTime() - start.getTime()) / 60_000)
      : null,
    [UF.resourceId]: booking.resource_id ?? null,
    [UF.agreedPrice]: booking.agreed_price_cents == null ? null : booking.agreed_price_cents / 100,
    [UF.serviceLines]: [packName, ...extraNames].join("\n"),
    // Never infer consent, payment or service completion from a calendar timestamp.
    [UF.acceptedAt]: booking.customer_accepted_at
      ? new Date(booking.customer_accepted_at).toISOString()
      : null,
    [UF.paymentMethod]: booking.payment_method ?? "",
    [UF.cashAmount]:
      booking.payment_method === "bar" && booking.payment_recorded_cents != null
        ? booking.payment_recorded_cents / 100
        : null,
    [UF.paymentDate]: booking.payment_recorded_on ?? null,
  };
}

async function saveProgress(sql: Sql, bookingId: number, patch: Partial<QueueProgress>) {
  await sql`update bitrix_sync_queue set
    bitrix_contact_id=coalesce(${patch.bitrix_contact_id ?? null},bitrix_contact_id),
    bitrix_deal_id=coalesce(${patch.bitrix_deal_id ?? null},bitrix_deal_id),
    bitrix_event_id=coalesce(${patch.bitrix_event_id ?? null},bitrix_event_id),
    write_pending=case when ${Boolean(patch.bitrix_contact_id || patch.bitrix_deal_id || patch.bitrix_event_id)} then null else write_pending end,
    photos_done=case when ${patch.photos_done ?? null}::boolean is null then photos_done else ${patch.photos_done ?? false} end,
    updated_at=now()
    where booking_id=${bookingId}`;
  await sql`update bookings set
    bitrix_contact_id=coalesce(${patch.bitrix_contact_id ?? null},bitrix_contact_id),
    bitrix_deal_id=coalesce(${patch.bitrix_deal_id ?? null},bitrix_deal_id),
    bitrix_event_id=coalesce(${patch.bitrix_event_id ?? null},bitrix_event_id),
    bitrix_last_error=null
    where id=${bookingId} and shop_id=${SHOP}`;
}

export async function findContact(
  request: BitrixCall,
  email: string | null,
  phone: string,
): Promise<{ id: number } | null> {
  if (email) {
    const found = await request<{ id: number }[]>("POST", "/contacts/search", {
      filter: { email: email.trim() },
      limit: 5,
    });
    // A shared phone is not permission to send documents to another email.
    // Search failures must remain retryable rather than creating duplicates.
    if (found.length > 1)
      throw new BitrixError(
        "Mehrere Kontakte mit derselben E-Mail.",
        "bitrix_contact_ambiguous",
        0,
        { review: true },
      );
    return found?.[0]?.id ? found[0] : null;
  }
  if (phone) {
    const found = await request<{ id: number }[]>("POST", "/contacts/search", {
      filter: { phone },
      limit: 5,
    });
    if (found.length > 1)
      throw new BitrixError(
        "Mehrere Kontakte mit derselben Telefonnummer.",
        "bitrix_contact_ambiguous",
        0,
        { review: true },
      );
    if (found?.[0]?.id) return found[0];
  }
  return null;
}

export async function repairBookingContact(sql: Sql, bookingId: number, request: BitrixCall) {
  const [booking] =
    await sql<BitrixBooking>`select * from bookings where shop_id=${SHOP} and id=${bookingId}`;
  if (!booking?.email || !booking.bitrix_deal_id)
    throw new Error("Keine Buchungs-E-Mail oder kein verknüpfter Bitrix-Auftrag vorhanden.");
  const claimed = await sql<{ booking_id: number }>`update bitrix_sync_queue
    set write_pending='contact_repair',updated_at=now()
    where shop_id=${SHOP} and booking_id=${bookingId} and status='synced' and write_pending is null
    returning booking_id`;
  if (!claimed.length)
    throw new Error(
      "Übertragung läuft oder benötigt Prüfung. Kontaktabgleich später erneut starten.",
    );
  let creating = false;
  try {
    let contact = await findContact(request, booking.email, booking.phone);
    if (!contact) {
      creating = true;
      contact = await request<{ id: number }>("POST", "/contacts", {
        ...splitCustomerName(booking.customer_name),
        email: booking.email,
        phone: booking.phone,
        sourceId: "WEB",
        typeId: "CLIENT",
        opened: true,
      });
    }
    // Persist the selected contact before the idempotent relationship update.
    await saveProgress(sql, bookingId, { bitrix_contact_id: contact.id });
    creating = false;
    await request("PATCH", `/deals/${booking.bitrix_deal_id}`, { contactId: contact.id });
    return { contactId: contact.id, email: booking.email };
  } catch (error) {
    if (creating) {
      await sql`update bitrix_sync_queue set status='review',last_error='Kontaktanlage unklar. Vor Wiederholung extern prüfen.' where booking_id=${bookingId} and shop_id=${SHOP}`;
    } else {
      await sql`update bitrix_sync_queue set write_pending=null where booking_id=${bookingId} and shop_id=${SHOP}`;
    }
    throw error;
  }
}

async function attachProducts(
  request: BitrixCall,
  dealId: number,
  booking: BitrixBooking,
  productMap: Record<string, number>,
  snapshot?: ReturnType<typeof bookingLineItems> | null,
) {
  const items = snapshot ?? bookingLineItems(booking, productMap);
  const expected = booking.agreed_price_cents ?? booking.total_cents;
  const actual = items.reduce((sum, item) => sum + Math.round(item.price * 100), 0);
  if (booking.package_id !== "photo-inquiry" && Math.abs(actual - expected) > items.length)
    throw new BitrixError(
      "Gespeicherter Preis und Leistungspositionen stimmen nicht überein.",
      "bitrix_price_review",
      0,
      { review: true },
    );
  if (items.length && actual !== expected)
    items[items.length - 1].price += (expected - actual) / 100;
  const products = items.map((item) => ({
    productId: item.productId,
    productName: item.name,
    price: item.price,
    quantity: 1,
    taxRate: 19,
    taxIncluded: true,
  }));
  if (!products.length) return;
  await request("PUT", `/deals/${dealId}/products`, { items: products });
}

export async function loadReadyPhotos(
  sql: Sql,
  bookingId: number,
  options: {
    signUrl?: typeof createSignedPhotoUrl;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<PhotoInput[]> {
  const rows = await sql<{ storage_path: string; original_name: string; mime: string }>`
    select storage_path, original_name, mime from booking_photos
    where shop_id=${SHOP} and booking_id=${bookingId} and upload_state='ready'
    order by id limit 8`;
  const photos: PhotoInput[] = [];
  for (const row of rows) {
    if (!(UPLOAD_MIME_TYPES as readonly string[]).includes(row.mime)) continue;
    const url = await (options.signUrl ?? createSignedPhotoUrl)(row.storage_path).catch(() => null);
    if (!url) continue;
    const response = await (options.fetchImpl ?? fetch)(url, {
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!response?.ok) continue;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) continue;
    photos.push({
      key: row.storage_path,
      name: row.original_name.slice(0, 100) || "aufnahme.jpg",
      mime: row.mime,
      base64: Buffer.from(bytes).toString("base64"),
    });
  }
  return photos;
}

export async function ensureCalendar(
  request: BitrixCall,
  booking: BitrixBooking,
  dealId: number,
  existingEventId: number | null,
) {
  if (["storniert", "abgelehnt", "nicht_erschienen", "neu"].includes(booking.status)) {
    if (existingEventId) {
      try {
        await request("DELETE", `/calendar-events/${existingEventId}`, {
          type: "user",
          ownerId: 1,
        });
      } catch (error) {
        if (!(error instanceof BitrixError && error.status === 404)) throw error;
      }
    }
    return null;
  }
  if (booking.status !== "bestaetigt" && booking.status !== "erledigt") return existingEventId;
  if (!booking.work_start_at || !booking.work_end_at)
    throw new BitrixError(
      "Start und Ende der Arbeit müssen vor der Kalenderübertragung manuell festgelegt werden.",
      "bitrix_schedule_required",
      0,
      { review: true },
    );
  const start = new Date(booking.work_start_at);
  const end = new Date(booking.work_end_at);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start)
    throw new BitrixError("Ungültiger Arbeitszeitraum.", "bitrix_invalid_interval", 0, {
      review: true,
    });
  const vehicle = bookingVehicle(booking) || `WG-${booking.id}`;
  const event = await request<{ id: number }>(
    existingEventId ? "PATCH" : "POST",
    existingEventId ? `/calendar-events/${existingEventId}` : "/calendar-events",
    {
      name: `Aufbereitung · ${vehicle} · ${booking.customer_name}`,
      description: [`WG-${booking.id}`, booking.customer_name, booking.phone, booking.note]
        .filter(Boolean)
        .join("\n"),
      type: "user",
      ownerId: 1,
      sectionId: 2,
      from: start.toISOString(),
      to: end.toISOString(),
      timezoneFrom: "Europe/Berlin",
      timezoneTo: "Europe/Berlin",
      crmFields: [`D_${dealId}`],
      location: "White Gloss, Arnistal 27, 72160 Horb am Neckar",
      accessibility: "busy",
      importance: "high",
    },
  );
  await request("PATCH", `/deals/${dealId}`, {
    [UF.appointment]: start.toISOString(),
    [UF.workEnd]: end.toISOString(),
    [UF.durationMinutes]: Math.round((end.getTime() - start.getTime()) / 60_000),
    closedAt: end.toISOString(),
    begindate: start.toISOString(),
  });
  return existingEventId ?? event.id;
}

export async function syncOneBitrixBooking(
  sql: Sql,
  booking: BitrixBooking,
  request: BitrixCall,
  productMap: Record<string, number>,
  progress: QueueProgress,
  loadPhotos: (bookingId: number) => Promise<PhotoInput[]> = (id) => loadReadyPhotos(sql, id),
) {
  if (progress.write_pending)
    throw new BitrixError(
      "Unklarer Bitrix-Schreibvorgang. Vor Wiederholung externen Datensatz zuordnen.",
      "bitrix_write_uncertain",
      0,
      { review: true },
    );
  const markWrite = async (kind: string) => {
    await sql`update bitrix_sync_queue set write_pending=${kind} where booking_id=${booking.id}`;
  };
  const names = splitCustomerName(booking.customer_name);
  let contactId = progress.bitrix_contact_id;
  if (!contactId) {
    const existing = await findContact(request, booking.email, booking.phone);
    if (existing) contactId = existing.id;
    else {
      await markWrite("contact");
      const created = await request<{ id: number }>("POST", "/contacts", {
        name: names.name,
        lastName: names.lastName,
        email: booking.email || undefined,
        phone: booking.phone,
        sourceId: "WEB",
        typeId: "CLIENT",
        opened: true,
      });
      contactId = created.id;
    }
    await saveProgress(sql, booking.id, { bitrix_contact_id: contactId });
  }

  const body = { ...(progress.initial_deal ?? bookingDealBody(booking, contactId)), contactId };
  let dealId = progress.bitrix_deal_id;
  if (!dealId) {
    await markWrite("deal");
    const created = await request<{ id: number }>("POST", "/deals", body);
    dealId = created.id;
    await saveProgress(sql, booking.id, { bitrix_deal_id: dealId });
  }
  // Once transferred, the native CRM owns prices, products, stages and scheduling.
  // Journal the initial write: an uncertain response must never overwrite later edits.
  if (!progress.details_done && !booking.bitrix_workshop_managed) {
    await markWrite("products");
    await attachProducts(request, dealId, booking, productMap, progress.initial_products);
    await sql`update bitrix_sync_queue set details_done=true,write_pending=null where booking_id=${booking.id}`;
  }

  if (!progress.photos_done) {
    const photos = await loadPhotos(booking.id);
    if (progress.photo_keys === null && photos.length)
      throw new BitrixError(
        "Vorhandene Fotos vor Ergänzung zuordnen.",
        "bitrix_legacy_photos_review",
        0,
        { review: true },
      );
    const transferred = new Set(progress.photo_keys || []);
    const photoKey = (photo: PhotoInput) =>
      photo.key ||
      createHash("sha256")
        .update(photo.name + ":" + photo.base64)
        .digest("hex");
    const newPhotos = photos.filter((photo) => !transferred.has(photoKey(photo)));
    if (newPhotos.length) {
      await markWrite("photos");
      await request("POST", `/deals/${dealId}/photos`, {
        files: newPhotos.map((photo) => [photo.name, photo.base64]),
      });
      for (const photo of newPhotos) transferred.add(photoKey(photo));
      await sql`update bitrix_sync_queue set photo_keys=${[...transferred]},write_pending=null where booking_id=${booking.id}`;
    }
    const pending = await sql<{
      count: number;
    }>`select count(*)::integer as count from booking_photos
        where shop_id=${SHOP} and booking_id=${booking.id} and upload_state <> 'ready'`;
    const ready = await sql<{ count: number }>`select count(*)::integer as count from booking_photos
        where shop_id=${SHOP} and booking_id=${booking.id} and upload_state='ready'`;
    const photosDone = !pending[0]?.count && photos.length === (ready[0]?.count ?? 0);
    if (!photosDone)
      throw new BitrixError(
        "Fahrzeugfotos noch nicht vollständig übertragen.",
        "bitrix_photos_pending",
        0,
        { retryable: true },
      );
    if (photosDone)
      await sql`update bitrix_sync_queue set photos_done=true,updated_at=now()
      where booking_id=${booking.id} and photos_revision=${progress.photos_revision ?? 0}`;
  }

  return { contactId, dealId, eventId: progress.bitrix_event_id ?? null };
}

export async function runBitrixSync(
  sql: Sql,
  options: {
    request?: BitrixCall;
    productMap?: Record<string, number>;
    bookingId?: number;
    limit?: number;
    loadPhotos?: (bookingId: number) => Promise<PhotoInput[]>;
  } = {},
) {
  const result = { synced: 0, failed: 0, review: 0, skipped: 0 };
  await ensureBitrixSchema(sql);
  if (!options.request && !(await readBitrixWebhook(sql))) {
    result.skipped = 1;
    return result;
  }
  const token = randomUUID();
  const deadline = Date.now() + 35_000;
  const lease =
    await sql`update bitrix_sync_runner set lease_token=${token},locked_until=now()+interval '90 seconds'
    where shop_id=${SHOP} and (locked_until is null or locked_until < now()) returning shop_id`;
  if (!lease.length) return result;
  const upstream = options.request || createBitrixClient(await readBitrixWebhook(sql));
  const request: BitrixCall = async <T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> => {
    const renewed = await sql`update bitrix_sync_runner set locked_until=now()+interval '90 seconds'
      where shop_id=${SHOP} and lease_token=${token} and locked_until>now() returning shop_id`;
    if (!renewed.length)
      throw new BitrixError("Bitrix-Synchronisation wurde unterbrochen.", "bitrix_lease_lost", 0, {
        review: true,
      });
    return upstream<T>(method, path, body);
  };
  const productMap = options.productMap || productMapFromEnv();
  try {
    for (let i = 0; i < (options.limit ?? 3) && Date.now() < deadline; i++) {
      const [row] =
        await sql<BitrixBooking>`select b.* from bitrix_sync_queue q join bookings b on b.id=q.booking_id and b.shop_id=q.shop_id
        where q.shop_id=${SHOP} and q.status='pending' and q.next_attempt_at<=now() and (${options.bookingId ?? null}::integer is null or b.id=${options.bookingId ?? null})
        order by q.next_attempt_at,q.booking_id limit 1`;
      if (!row) break;
      const [progress] =
        await sql<QueueProgress>`select bitrix_contact_id,bitrix_deal_id,bitrix_event_id,photos_done,photos_revision,write_pending,details_done,photo_keys,initial_deal,initial_products
        from bitrix_sync_queue where booking_id=${row.id}`;
      try {
        const ids = await syncOneBitrixBooking(
          sql,
          row,
          request,
          productMap,
          progress || {
            bitrix_contact_id: null,
            bitrix_deal_id: null,
            bitrix_event_id: null,
            photos_done: false,
          },
          options.loadPhotos,
        );
        await sql`update bitrix_sync_queue set synced_version=${row.version},
          bitrix_contact_id=${ids.contactId},bitrix_deal_id=${ids.dealId},bitrix_event_id=${ids.eventId},
          status=case when requested_version>${row.version} or photos_revision<>${progress?.photos_revision ?? 0} then 'pending' else 'synced' end,attempts=0,last_error=null,updated_at=now()
          where booking_id=${row.id}`;
        result.synced++;
      } catch (error) {
        const code = error instanceof BitrixError ? error.code : "bitrix_processing_failed";
        const [uncertain] = await sql<{
          write_pending: string | null;
        }>`select write_pending from bitrix_sync_queue where booking_id=${row.id}`;
        const review =
          Boolean(uncertain?.write_pending) || (error instanceof BitrixError && error.review);
        await sql`update bitrix_sync_queue set attempts=attempts+1,
          status=case when ${review} then 'review' when attempts>=5 then 'failed' else 'pending' end,
          last_error=${code},next_attempt_at=now()+interval '5 minutes',updated_at=now() where booking_id=${row.id}`;
        await sql`update bookings set bitrix_last_error=${code} where id=${row.id} and shop_id=${SHOP}`;
        if (review) result.review++;
        else result.failed++;
        break;
      }
    }
  } finally {
    await sql`update bitrix_sync_runner set lease_token=null,locked_until=null where shop_id=${SHOP} and lease_token=${token}`;
  }
  return result;
}
