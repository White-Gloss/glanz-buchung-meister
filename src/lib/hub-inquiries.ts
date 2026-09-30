import { ensureBookingOperationsSchema } from "./booking-operations.ts";
import type { Sql } from "./db.ts";

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

type Row = {
  id: number;
  customer_name: string;
  phone: string;
  email: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  package_id: string;
  class_id: string;
  extra_ids: unknown;
  city_slug: string | null;
  note: string | null;
  total_cents: number | null;
  pickup_cents: number | null;
  preferred_date: string | null;
  preferred_slot: string | null;
  customer_street: string | null;
  customer_postal_code: string | null;
  customer_city: string | null;
  review_email_consent: boolean | null;
};

function text(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function extraIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").slice(0, 12);
  }
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    return extraIds(JSON.parse(value) as unknown);
  } catch {
    return [];
  }
}

function day(value: string | null): string {
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
}

/** Read-only list of open website requests. Does not change a booking. */
export async function listHubInquiries(sql: Sql): Promise<HubInquiry[]> {
  await ensureBookingOperationsSchema(sql);
  const rows = await sql<Row>`
    select id, customer_name, phone, email, vehicle_make, vehicle_model, vehicle_plate,
      package_id, class_id, extra_ids, city_slug, note, total_cents, pickup_cents,
      preferred_date::text as preferred_date, preferred_slot,
      customer_street, customer_postal_code, customer_city, review_email_consent
    from bookings
    where shop_id = 'white-gloss' and status = 'neu'
    order by id desc
    limit 40
  `;
  const photos = new Map<number, number>();
  const ids = rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length > 0) {
    try {
      const counts = await sql.query<{ booking_id: number; photos: number }>(
        "select booking_id, count(*)::int as photos from booking_photos where upload_state = 'ready' and booking_id = any($1::int[]) group by booking_id",
        [ids],
      );
      for (const count of counts) photos.set(Number(count.booking_id), Number(count.photos) || 0);
    } catch {
      /* Photos stay in the shop. A missing table must not hide the inquiries. */
    }
  }
  return rows.flatMap((row) => {
    const id = Number(row.id);
    const name = text(row.customer_name).slice(0, 120);
    if (!Number.isInteger(id) || id < 1 || name.length < 2) return [];
    const photoCount = photos.get(id) ?? 0;
    const note = [text(row.note), photoCount === 1 ? "Ein Foto liegt im Betrieb." : photoCount > 1 ? `${photoCount} Fotos liegen im Betrieb.` : ""]
      .filter(Boolean)
      .join("\n")
      .slice(0, 1500);
    const address = [
      text(row.customer_street),
      [text(row.customer_postal_code), text(row.customer_city)].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", ")
      .slice(0, 200);
    const vehicle = [text(row.vehicle_make), text(row.vehicle_model), text(row.vehicle_plate)]
      .filter(Boolean)
      .join(" ")
      .slice(0, 80);
    return [
      {
        id,
        customer_name: name,
        phone: text(row.phone).slice(0, 40),
        email: text(row.email).slice(0, 160),
        vehicle,
        package_id: text(row.package_id).slice(0, 40),
        class_id: text(row.class_id).slice(0, 40),
        extra_ids: extraIds(row.extra_ids),
        city_slug: text(row.city_slug).slice(0, 80),
        note,
        total_cents: Math.max(0, Math.round(Number(row.total_cents) || 0)),
        pickup_cents: Math.max(0, Math.min(50_000, Math.round(Number(row.pickup_cents) || 0))),
        preferred_date: day(row.preferred_date),
        preferred_slot: text(row.preferred_slot).slice(0, 8),
        address,
        review_email_consent: row.review_email_consent === true,
      },
    ];
  });
}
