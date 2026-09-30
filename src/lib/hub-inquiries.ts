import { createHash, timingSafeEqual } from "node:crypto";
import type { Sql } from "./db.ts";

// Read-only pull contract for the Hub: POST {"action":"list"} with
// "Authorization: Bearer $HUB_SYNC_TOKEN". The route never writes, never calls
// out and never answers 410 (for the Hub, 410 means "route switched off").

const SHOP = "white-gloss";
const MIN_TOKEN = 32;
const MAX_BODY = 4096;
const MAX_INQUIRIES = 40;
const MAX_NOTE = 1499;
const MAX_PICKUP_CENTS = 50_000;
/** Pre-acceptance stages. Anything later is accepted, done, rejected or cancelled. */
const OPEN_STAGES = ["anfrage_eingegangen", "in_pruefung", "kundenrueckmeldung"];

type Row = {
  id: number | string;
  customer_name: string | null;
  phone: string | null;
  email: string | null;
  preferred_date: string | Date | null;
  preferred_slot: string | null;
  package_id: string | null;
  class_id: string | null;
  extra_ids: string | string[] | null;
  city_slug: string | null;
  note: string | null;
  total_cents: number | string | null;
  pickup_cents: number | string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  customer_street: string | null;
  customer_postal_code: string | null;
  customer_city: string | null;
  review_email_consent: boolean | null;
  photo_count: number | string | null;
};

export type HubInquiry = {
  id: number;
  customer_name: string;
  phone: string;
  email: string;
  vehicle: string;
  package_id: string;
  class_id: string;
  extra_ids: string[];
  city_slug: string;
  note: string;
  total_cents: number;
  pickup_cents: number;
  preferred_date: string;
  preferred_slot: string;
  address: string;
  review_email_consent: boolean;
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

export function hubMethodNotAllowed() {
  return new Response(null, {
    status: 405,
    headers: { allow: "POST", "cache-control": "no-store" },
  });
}

function configuredToken() {
  const token = (process.env.HUB_SYNC_TOKEN ?? "").trim();
  return token.length >= MIN_TOKEN ? token : "";
}

function presentedToken(request: Request) {
  const match = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(request.headers.get("authorization") ?? "");
  return match?.[1] ?? "";
}

/** Hashing first makes the comparison constant-time regardless of length. */
function sameSecret(expected: string, presented: string) {
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(presented).digest();
  return timingSafeEqual(a, b) && presented.length > 0;
}

async function isListAction(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return false;
    const body = JSON.parse(raw) as unknown;
    return (
      typeof body === "object" &&
      body !== null &&
      !Array.isArray(body) &&
      (body as { action?: unknown }).action === "list"
    );
  } catch {
    return false;
  }
}

function text(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  return String(value).trim();
}

function cents(value: unknown) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function isoDate(value: Row["preferred_date"]) {
  const date = text(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function extras(value: Row["extra_ids"]) {
  let list: unknown = value;
  if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(list)
    ? list.filter((item): item is string => typeof item === "string" && item.trim() !== "")
    : [];
}

function note(row: Row) {
  // Uploaded photos live in private storage; only signed links exist. Those are
  // secret links, so the Hub gets the fact, never a path or link.
  const photos = cents(row.photo_count);
  const lines = [
    text(row.note),
    photos ? `Fotos: ${photos} hochgeladen (nicht öffentlich verlinkt)` : "",
  ].filter(Boolean);
  const joined = lines.join("\n");
  return joined.length > MAX_NOTE ? `${joined.slice(0, MAX_NOTE - 1)}…` : joined;
}

export function toHubInquiry(row: Row): HubInquiry | null {
  const id = Number(row.id);
  const name = text(row.customer_name);
  if (!Number.isSafeInteger(id) || id < 1 || name.length < 2) return null;
  const place = [text(row.customer_postal_code), text(row.customer_city)].filter(Boolean).join(" ");
  return {
    id,
    customer_name: name,
    phone: text(row.phone),
    email: text(row.email),
    vehicle: [row.vehicle_make, row.vehicle_model, row.vehicle_plate]
      .map(text)
      .filter(Boolean)
      .join(" "),
    package_id: text(row.package_id),
    class_id: text(row.class_id),
    extra_ids: extras(row.extra_ids),
    city_slug: text(row.city_slug),
    note: note(row),
    total_cents: cents(row.total_cents),
    pickup_cents: Math.min(cents(row.pickup_cents), MAX_PICKUP_CENTS),
    preferred_date: isoDate(row.preferred_date),
    preferred_slot: text(row.preferred_slot).slice(0, 16),
    address: [text(row.customer_street), place].filter(Boolean).join(", "),
    review_email_consent: row.review_email_consent === true,
  };
}

/** Open = still a request: not accepted, cancelled, rejected, done or billed anywhere. */
export async function readOpenInquiries(sql: Sql): Promise<HubInquiry[]> {
  // RO tables and the address columns are partly created at runtime by other
  // paths. This route only reads, so it adapts instead of running DDL.
  const [optional] = await sql<{ ro_state: boolean; ro_invoices: boolean }>`
    select to_regclass('public.roapp_order_state') is not null as ro_state,
      to_regclass('public.roapp_invoices') is not null as ro_invoices
  `;
  const rows = await sql.query<Row>(
    `select b.id, b.customer_name, b.phone, b.email, b.preferred_date, b.preferred_slot,
       b.package_id, b.class_id, b.extra_ids, b.city_slug, b.note, b.total_cents, b.pickup_cents,
       b.vehicle_make, b.vehicle_model, b.vehicle_plate,
       to_jsonb(b)->>'customer_street' as customer_street,
       to_jsonb(b)->>'customer_postal_code' as customer_postal_code,
       to_jsonb(b)->>'customer_city' as customer_city,
       b.review_email_consent,
       (select count(*) from booking_photos p
         where p.shop_id = b.shop_id and p.booking_id = b.id and p.upload_state = 'ready') as photo_count
     from bookings b
     where b.shop_id = $1
       and b.status = 'neu'
       and b.ops_stage = any($2::text[])
       and b.confirmed_at is null
       and b.cancelled_at is null
       and b.invoice_status = 'nicht_erstellt'
       and b.payment_status = 'offen'
       and b.payment_recorded_cents is null
       and b.qonto_invoice_id is null
       and b.zoho_invoice_id is null
       and b.bitrix_invoice_id is null
       and length(btrim(b.customer_name)) >= 2
       ${optional?.ro_state ? "and not exists (select 1 from roapp_order_state s where s.booking_id = b.id and (s.owner_confirmed_at is not null or s.completed_at is not null))" : ""}
       ${optional?.ro_invoices ? "and not exists (select 1 from roapp_invoices i where i.booking_id = b.id)" : ""}
     order by b.created_at desc, b.id desc
     limit $3`,
    [SHOP, OPEN_STAGES, MAX_INQUIRIES],
  );
  return rows.map(toHubInquiry).filter((row): row is HubInquiry => row !== null);
}

async function defaultSql() {
  const { getSql } = await import("./db.ts");
  return getSql();
}

export async function handleHubInquiries(
  request: Request,
  loadSql: () => Promise<Sql> = defaultSql,
) {
  if (request.method !== "POST") return hubMethodNotAllowed();
  const token = configuredToken();
  if (!token) return json({ error: "not_configured" }, 503);
  if (!sameSecret(token, presentedToken(request))) return json({ error: "unauthorized" }, 401);
  if (!(await isListAction(request))) return json({ error: "bad_request" }, 400);
  try {
    return json({ inquiries: await readOpenInquiries(await loadSql()) }, 200);
  } catch {
    // No query text, parameters or customer data in logs.
    console.error("[hub] list_failed");
    return json({ error: "unavailable" }, 500);
  }
}
