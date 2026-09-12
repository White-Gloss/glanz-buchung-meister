import { randomUUID } from "node:crypto";
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
import {
  BitrixError,
  createBitrixClient,
  productMapFromEnv,
  type BitrixCall,
} from "./bitrix.ts";
import { readVibeApiKey } from "./bitrix-credentials.server.ts";

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
} as const;

const STAGE = {
  neu: "NEW",
  bestaetigt: "EXECUTING",
  erledigt: "FINAL_INVOICE",
  abgelehnt: "LOSE",
} as const;

export type BitrixBooking = WorkflowBooking & {
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_plate?: string | null;
  bitrix_contact_id?: number | null;
  bitrix_deal_id?: number | null;
  bitrix_event_id?: number | null;
};

type QueueProgress = {
  bitrix_contact_id: number | null;
  bitrix_deal_id: number | null;
  bitrix_event_id: number | null;
  photos_done: boolean;
};

type PhotoInput = { name: string; mime: string; base64: string };

export async function ensureBitrixSchema(sql: Sql) {
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
  await sql`insert into bitrix_sync_queue(booking_id,shop_id,requested_version)
    values(${booking.id},${SHOP},${booking.version}) on conflict(booking_id) do update
    set requested_version=greatest(bitrix_sync_queue.requested_version,excluded.requested_version),
    status='pending',next_attempt_at=now(),updated_at=now()`;
}

export async function queueBitrixPhotos(sql: Sql, booking: Pick<WorkflowBooking, "id" | "version">) {
  await queueBitrixBooking(sql, booking);
  await sql`update bitrix_sync_queue set photos_done=false,status='pending',next_attempt_at=now(),updated_at=now()
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

export function stageForStatus(status: WorkflowBooking["status"]): string {
  if (status === "bestaetigt") return STAGE.bestaetigt;
  if (status === "erledigt") return STAGE.erledigt;
  if (status === "abgelehnt" || status === "storniert" || status === "nicht_erschienen") {
    return STAGE.abgelehnt;
  }
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
  return items;
}

export function bookingDealBody(booking: BitrixBooking, contactId: number) {
  const pack = packages.find((p) => p.id === booking.package_id);
  const klass = vehicleClasses.find((v) => v.id === booking.class_id);
  const city = cities.find((c) => c.slug === booking.city_slug);
  const extraNames = parseExtraIds(booking.extra_ids).map(
    (id) => extras.find((e) => e.id === id)?.name || id,
  );
  const vehicle = bookingVehicle(booking) || "Fahrzeug laut Anfrage";
  const wish = [booking.preferred_date, booking.preferred_slot].filter(Boolean).join(" ");
  const pickupKm = city?.km;
  const pickup =
    pickupKm == null ? null : pickupFee(pickupKm, booking.package_id as PackageId);
  return {
    title: `WG-${booking.id} · ${vehicle} · ${pack?.name || booking.package_id}`,
    contactId,
    stageId: stageForStatus(booking.status),
    typeId: "SERVICES",
    sourceId: "WEB",
    currency: "EUR",
    amount: booking.total_cents / 100,
    isManualOpportunity: true,
    opened: booking.status === "neu" || booking.status === "bestaetigt",
    comments: [
      `Buchungsanfrage white-gloss.de/#buchung`,
      `Vorgang WG-${booking.id}`,
      `Fahrzeug: ${vehicle}`,
      `Klasse: ${klass?.label || booking.class_id}`,
      `Paket: ${pack?.name || booking.package_id}`,
      extraNames.length ? `Zusatz: ${extraNames.join(", ")}` : null,
      city ? `Ort: ${city.name}` : booking.city_slug ? `Ort: ${booking.city_slug}` : null,
      pickup === null ? "Abholung auf Anfrage – nicht im Richtpreis." : null,
      wish ? `Wunschtermin: ${wish}` : null,
      booking.note || null,
    ]
      .filter(Boolean)
      .join("\n"),
    [UF.vehicle]: vehicle,
    [UF.package]: pack?.name || booking.package_id,
    [UF.extras]: extraNames.join(", "),
    [UF.city]: city?.name || booking.city_slug || "",
    [UF.class]: klass?.label || booking.class_id,
    [UF.prefDates]: wish,
  };
}

async function saveProgress(sql: Sql, bookingId: number, patch: Partial<QueueProgress>) {
  await sql`update bitrix_sync_queue set
    bitrix_contact_id=coalesce(${patch.bitrix_contact_id ?? null},bitrix_contact_id),
    bitrix_deal_id=coalesce(${patch.bitrix_deal_id ?? null},bitrix_deal_id),
    bitrix_event_id=coalesce(${patch.bitrix_event_id ?? null},bitrix_event_id),
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

async function findContact(
  request: BitrixCall,
  email: string | null,
  phone: string,
): Promise<{ id: number } | null> {
  if (email) {
    try {
      const found = await request<{ id: number }[]>("POST", "/contacts/search", {
        filter: { email },
        limit: 5,
      });
      if (found?.[0]?.id) return found[0];
    } catch {
      /* search is best-effort */
    }
  }
  if (phone) {
    try {
      const found = await request<{ id: number }[]>("POST", "/contacts/search", {
        filter: { phone },
        limit: 5,
      });
      if (found?.[0]?.id) return found[0];
    } catch {
      /* search is best-effort */
    }
  }
  return null;
}

async function attachProducts(
  request: BitrixCall,
  dealId: number,
  booking: BitrixBooking,
  productMap: Record<string, number>,
) {
  const products = bookingLineItems(booking, productMap).map((item) => ({
    productId: item.productId,
    productName: item.name,
    price: item.price,
    quantity: 1,
    taxRate: 19,
    taxIncluded: true,
  }));
  if (!products.length) return;
  try {
    await request("POST", `/deals/${dealId}/products`, { products });
  } catch {
    await request("POST", `/deals/${dealId}/products/set`, { products }).catch(() => undefined);
  }
}

async function loadReadyPhotos(sql: Sql, bookingId: number): Promise<PhotoInput[]> {
  const rows = await sql<{ storage_path: string; original_name: string; mime: string }>`
    select storage_path, original_name, mime from booking_photos
    where shop_id=${SHOP} and booking_id=${bookingId} and upload_state='ready'
    order by id limit 8`;
  const photos: PhotoInput[] = [];
  for (const row of rows) {
    if (!row.mime.startsWith("image/")) continue;
    const url = await createSignedPhotoUrl(row.storage_path).catch(() => null);
    if (!url) continue;
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!response?.ok) continue;
    const bytes = new Uint8Array(await response.arrayBuffer());
    photos.push({
      name: row.original_name.slice(0, 100) || "aufnahme.jpg",
      mime: row.mime,
      base64: Buffer.from(bytes).toString("base64"),
    });
  }
  return photos;
}

function durationHours(packageId: string) {
  if (packageId === "keramik") return 16;
  if (packageId === "premium") return 6;
  return 3;
}

async function ensureCalendar(
  request: BitrixCall,
  booking: BitrixBooking,
  dealId: number,
  existingEventId: number | null,
) {
  if (booking.status !== "bestaetigt") return existingEventId;
  const date = (booking.preferred_date || "").trim();
  const slot = (booking.preferred_slot || "").trim();
  if (!date || !slot) return existingEventId;
  if (existingEventId) return existingEventId;
  const start = new Date(`${date}T${slot}:00+02:00`);
  if (Number.isNaN(start.getTime())) return existingEventId;
  const end = new Date(start.getTime() + durationHours(booking.package_id) * 3600 * 1000);
  const vehicle = bookingVehicle(booking) || `WG-${booking.id}`;
  const event = await request<{ id: number }>("POST", "/calendar-events", {
    name: `Aufbereitung · ${vehicle} · ${booking.customer_name}`,
    description: [`WG-${booking.id}`, booking.customer_name, booking.phone, booking.note]
      .filter(Boolean)
      .join("\n"),
    type: "user",
    ownerId: 1,
    sectionId: 2,
    from: start.toISOString(),
    to: end.toISOString(),
    location: "White Gloss, Arnistal 27, 72160 Horb am Neckar",
    accessibility: "busy",
    importance: "high",
  });
  await request("PATCH", `/deals/${dealId}`, {
    [UF.appointment]: start.toISOString(),
    closedAt: end.toISOString(),
    begindate: start.toISOString(),
  }).catch(() => undefined);
  return event.id;
}

export async function syncOneBitrixBooking(
  sql: Sql,
  booking: BitrixBooking,
  request: BitrixCall,
  productMap: Record<string, number>,
  progress: QueueProgress,
  loadPhotos: (bookingId: number) => Promise<PhotoInput[]> = (id) => loadReadyPhotos(sql, id),
) {
  const names = splitCustomerName(booking.customer_name);
  let contactId = progress.bitrix_contact_id;
  if (!contactId) {
    const existing = await findContact(request, booking.email, booking.phone);
    if (existing) contactId = existing.id;
    else {
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

  const body = bookingDealBody(booking, contactId);
  let dealId = progress.bitrix_deal_id;
  if (!dealId) {
    const created = await request<{ id: number }>("POST", "/deals", body);
    dealId = created.id;
    await saveProgress(sql, booking.id, { bitrix_deal_id: dealId });
    await attachProducts(request, dealId, booking, productMap);
  } else {
    await request("PATCH", `/deals/${dealId}`, body);
  }

  if (!progress.photos_done) {
    const photos = await loadPhotos(booking.id);
    if (photos.length) {
      await request("PATCH", `/deals/${dealId}`, {
        [UF.photos]: photos.map((photo) => [photo.name, photo.base64]),
      });
    }
    const pending =
      await sql<{ count: number }>`select count(*)::integer as count from booking_photos
        where shop_id=${SHOP} and booking_id=${booking.id} and upload_state <> 'ready'`;
    const ready =
      await sql<{ count: number }>`select count(*)::integer as count from booking_photos
        where shop_id=${SHOP} and booking_id=${booking.id} and upload_state='ready'`;
    const photosDone = !pending[0]?.count && (photos.length > 0 || !ready[0]?.count);
    if (photosDone) await saveProgress(sql, booking.id, { photos_done: true });
  }

  const eventId = await ensureCalendar(request, booking, dealId, progress.bitrix_event_id);
  if (eventId && eventId !== progress.bitrix_event_id) {
    await saveProgress(sql, booking.id, { bitrix_event_id: eventId });
  }

  return { contactId, dealId, eventId: eventId ?? null };
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
  if (!options.request && !(await readVibeApiKey(sql))) {
    result.skipped = 1;
    return result;
  }
  const token = randomUUID();
  const deadline = Date.now() + 35_000;
  const lease =
    await sql`update bitrix_sync_runner set lease_token=${token},locked_until=now()+interval '90 seconds'
    where shop_id=${SHOP} and (locked_until is null or locked_until < now()) returning shop_id`;
  if (!lease.length) return result;
  const request = options.request || createBitrixClient(await readVibeApiKey(sql));
  const productMap = options.productMap || productMapFromEnv();
  try {
    for (let i = 0; i < (options.limit ?? 3) && Date.now() < deadline; i++) {
      const [row] =
        await sql<BitrixBooking>`select b.* from bitrix_sync_queue q join bookings b on b.id=q.booking_id and b.shop_id=q.shop_id
        where q.shop_id=${SHOP} and q.status='pending' and q.next_attempt_at<=now() and (${options.bookingId ?? null}::integer is null or b.id=${options.bookingId ?? null})
        order by q.next_attempt_at,q.booking_id limit 1`;
      if (!row) break;
      const [progress] = await sql<QueueProgress>`select bitrix_contact_id,bitrix_deal_id,bitrix_event_id,photos_done
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
          status=case when requested_version>${row.version} then 'pending' else 'synced' end,attempts=0,last_error=null,updated_at=now()
          where booking_id=${row.id}`;
        result.synced++;
      } catch (error) {
        const code = error instanceof BitrixError ? error.code : "bitrix_processing_failed";
        const review = error instanceof BitrixError && error.review;
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
