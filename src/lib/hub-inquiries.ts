import { createHash, timingSafeEqual } from "node:crypto";
import type { Sql } from "./db.ts";

const SHOP = "white-gloss";

type Row = {
  id: number;
  customer_name: string;
  phone: string | null;
  email: string | null;
  preferred_date: string | Date | null;
  preferred_slot: string | null;
  package_id: string;
  class_id: string;
  extra_ids: string | string[] | null;
  city_slug: string | null;
  note: string | null;
  total_cents: number | null;
  pickup_cents: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  customer_street: string | null;
  customer_postal_code: string | null;
  customer_city: string | null;
  review_email_consent: boolean | null;
};

const gone = () => new Response(null, { status: 410 });

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function sameSecret(expected: string, presented: string) {
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(presented).digest();
  return timingSafeEqual(a, b);
}

function bearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, "").trim() : "";
}

async function expectedToken(sql: Sql) {
  const fromEnv = (process.env.HUB_SYNC_TOKEN ?? "").trim();
  if (fromEnv.length >= 32) return fromEnv;
  try {
    const columns = await sql<{ column_name: string }>`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'shop_settings' and column_name = 'hub_sync_token'
    `;
    if (!columns[0]) return "";
    const rows = await sql<{ hub_sync_token: string | null }>`
      select hub_sync_token from shop_settings where shop_id = ${SHOP} limit 1
    `;
    return String(rows[0]?.hub_sync_token ?? "").trim();
  } catch {
    return "";
  }
}

function text(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function extras(value: Row["extra_ids"]) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function handleHubInquiries(request: Request) {
  const { getSql } = await import("./db.ts");
  const sql = await getSql();
  const secret = await expectedToken(sql);
  if (secret.length < 32) return gone();
  if (!sameSecret(secret, bearer(request))) return json({ ok: false, error: "unauthorized" }, 401);

  let action = "";
  try {
    const body = (await request.json()) as { action?: unknown };
    action = typeof body.action === "string" ? body.action : "";
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  if (action !== "list") return gone();

  let rows: Row[];
  try {
    rows = await sql<Row>`
      select id, customer_name, phone, email, preferred_date, preferred_slot,
        package_id, class_id, extra_ids, city_slug, note, total_cents, pickup_cents,
        vehicle_make, vehicle_model, vehicle_plate,
        customer_street, customer_postal_code, customer_city, review_email_consent
      from bookings
      where shop_id = ${SHOP} and status = 'neu'
      order by id desc
      limit 40
    `;
  } catch {
    console.error("[hub-inquiries] query_failed");
    return json({ ok: false, error: "query_failed" }, 500);
  }

  return json(
    {
      ok: true,
      inquiries: rows.map((row) => {
        const street = text(row.customer_street);
        const place = [text(row.customer_postal_code), text(row.customer_city)].filter(Boolean).join(" ");
        return {
          id: row.id,
          wg_number: `WG-${row.id}`,
          status: "neu",
          customer_name: row.customer_name,
          phone: text(row.phone),
          email: text(row.email),
          vehicle: [row.vehicle_make, row.vehicle_model, row.vehicle_plate].filter(Boolean).join(" "),
          package_id: row.package_id,
          class_id: row.class_id,
          extra_ids: extras(row.extra_ids),
          city_slug: text(row.city_slug),
          note: text(row.note),
          total_cents: Number(row.total_cents) || 0,
          pickup_cents: Number(row.pickup_cents) || 0,
          preferred_date: text(row.preferred_date).slice(0, 10),
          preferred_slot: text(row.preferred_slot).slice(0, 8),
          address: [street, place].filter(Boolean).join(", "),
          review_email_consent: row.review_email_consent === true,
        };
      }),
    },
    200,
  );
}
