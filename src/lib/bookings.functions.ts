import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  cities,
  extras,
  packages,
  quoteTotal,
  type BookingStatus,
  type PackageId,
  type VehicleClass,
} from "@/data/site";
import { queueBookingAutomation, queueOwnerNotify, safeExec, OUTBOUND_QUEUED } from "@/lib/ops";
import { assertPublicPostLimit } from "@/lib/rate-limit";
import { isEmailAddress } from "@/lib/utils";

const SHOP = "white-gloss";
const extraIdSet = new Set(extras.map((item) => item.id));
const citySlugSet = new Set(cities.map((item) => item.slug));

const publicBookingSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(40),
  email: z
    .string()
    .trim()
    .max(160)
    .refine((v) => v.length === 0 || isEmailAddress(v), "Ungültige E-Mail"),
  date: z.string().max(20).optional(),
  slot: z.string().max(10).optional(),
  note: z.string().max(2000).optional(),
  packageId: z.enum(["basis", "premium", "keramik"]),
  classId: z.enum(["kompakt", "suv", "transporter"]),
  extraIds: z.array(z.string().max(40)).max(20),
  citySlug: z.string().max(80),
  kind: z.enum(["booking", "dent", "condition"]).default("booking"),
  website: z.string().max(120).optional(),
});

export type PublicBookingInput = z.infer<typeof publicBookingSchema>;

export type BookingRow = {
  id: number;
  status: BookingStatus;
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
  created_at: string;
  updated_at: string;
};

function extraNames(ids: string[]) {
  return extras.filter((e) => ids.includes(e.id)).map((e) => e.name);
}

function rejectHoneypot(website?: string) {
  if (website && website.trim().length > 0) {
    throw new Error("Anfrage abgelehnt.");
  }
}

function assertKnownPricing(data: { extraIds: string[]; citySlug: string }) {
  if (data.extraIds.some((id) => !extraIdSet.has(id))) {
    throw new Error("Unbekanntes Extra.");
  }
  if (data.citySlug && !citySlugSet.has(data.citySlug)) {
    throw new Error("Unbekannter Abholort.");
  }
}

async function upsertCustomer(
  sql: Awaited<ReturnType<typeof getSql>>,
  name: string,
  phone: string,
  email?: string,
) {
  const existing = await sql<{ id: number }>`
    select id from customers where shop_id = ${SHOP} and phone = ${phone} limit 1
  `;
  if (existing[0]) {
    await sql`
      update customers
      set name = ${name}, email = coalesce(${email || null}, email)
      where id = ${existing[0].id}
    `;
    return existing[0].id;
  }
  const inserted = await sql<{ id: number }>`
    insert into customers (shop_id, name, phone, email)
    values (${SHOP}, ${name}, ${phone}, ${email || null})
    returning id
  `;
  return inserted[0]?.id ?? null;
}

export const createPublicBooking = createServerFn({ method: "POST" })
  .validator((input: unknown) => publicBookingSchema.parse(input))
  .handler(async ({ data }) => {
    assertPublicPostLimit("booking");
    rejectHoneypot(data.website);
    assertKnownPricing(data);
    const sql = await getSql();
    const quote = quoteTotal({
      packageId: data.packageId as PackageId,
      classId: data.classId as VehicleClass["id"],
      extraIds: data.extraIds,
      citySlug: data.citySlug,
    });
    const city = cities.find((c) => c.slug === data.citySlug);
    const pack = packages.find((p) => p.id === data.packageId);
    const totalCents = Math.round(quote.total * 100);
    const pickupCents = Math.round((quote.pickup ?? 0) * 100);
    const extraList = extraNames(data.extraIds);
    const preferredDate = data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : null;

    const rows = await sql<{ id: number }>`
      insert into bookings (
        shop_id, customer_name, phone, email, preferred_date, preferred_slot,
        package_id, class_id, extra_ids, city_slug, note, total_cents, pickup_cents
      ) values (
        ${SHOP}, ${data.name}, ${data.phone}, ${data.email || null},
        ${preferredDate}, ${data.slot || null},
        ${data.packageId}, ${data.classId}, ${JSON.stringify(data.extraIds)},
        ${data.citySlug}, ${data.note || null}, ${totalCents}, ${pickupCents}
      )
      returning id
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("Buchung konnte nicht gespeichert werden.");

    await upsertCustomer(sql, data.name, data.phone, data.email || undefined);

    const subject =
      data.kind === "dent"
        ? "Fotoanfrage Dellen"
        : data.kind === "condition"
          ? "Fotoanfrage Zustand"
          : `Anfrage ${pack?.name ?? data.packageId}`;

    const body = [
      `${data.name} · ${data.phone}`,
      data.email ? data.email : "",
      pack ? pack.name : data.packageId,
      city ? `${city.name} (${city.km} km)` : data.citySlug,
      extraList.length ? `Extras: ${extraList.join(", ")}` : "",
      preferredDate ? `Wunschtermin: ${preferredDate} ${data.slot ?? ""}` : "",
      data.note ?? "",
    ]
      .filter(Boolean)
      .join("\n");

    await sql`
      insert into inbox_messages (shop_id, channel, sender, subject, body, booking_id)
      values (${SHOP}, ${"form"}, ${data.name}, ${subject}, ${body}, ${id})
    `;

    const ack = [
      `Guten Tag ${data.name},`,
      "",
      `wir haben Ihre Anfrage ${pack?.name ?? data.packageId} erhalten (Vorgang WG-${id}).`,
      "Wir melden uns mit einem konkreten Terminvorschlag.",
      "",
      "White Gloss Detailing",
      "Arnistal 27, 72160 Horb am Neckar",
    ].join("\n");
    if (isEmailAddress(data.email)) {
      await safeExec("ack-out", () =>
        sql`
          insert into outbound_queue (shop_id, channel, to_addr, subject, body, booking_id, status)
          values (
            ${SHOP}, ${"email"}, ${data.email},
            ${`Anfrage eingegangen · White Gloss WG-${id}`}, ${ack}, ${id}, ${OUTBOUND_QUEUED}
          )
        `,
      );
    }
    await safeExec("ack-inbox", () =>
      sql`
        insert into inbox_messages (shop_id, channel, direction, sender, subject, body, booking_id)
        values (
          ${SHOP}, ${"email"}, ${"out"}, ${"White Gloss"},
          ${`Anfrage eingegangen · WG-${id}`}, ${ack}, ${id}
        )
      `,
    );
    await safeExec("ack-event", () =>
      sql`
        insert into automation_events (shop_id, area, event, severity, context)
        values (${SHOP}, ${"mail"}, ${"eingangsbestaetigung"}, ${"info"}, ${`WG-${id}`})
      `,
    );

    await queueOwnerNotify(
      sql,
      {
        id,
        customer_name: data.name,
        email: data.email || null,
        phone: data.phone,
        package_id: data.packageId,
        preferred_date: preferredDate,
        preferred_slot: data.slot || null,
      },
      subject,
    );

    return {
      id,
      reference: `WG-${id}`,
      total: quote.total,
      pickupOnRequest: quote.pickupOnRequest,
    };
  });

export const createPublicPhotoInquiry = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        title: z.string().min(2).max(160),
        name: z.string().trim().min(2).max(120),
        phone: z.string().trim().min(6).max(40),
        text: z.string().max(2000),
        files: z.array(z.string().max(180)).max(8),
        website: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    assertPublicPostLimit("photo-inquiry", 6);
    rejectHoneypot(data.website);
    const sql = await getSql();
    await upsertCustomer(sql, data.name, data.phone);
    const body = [
      data.text,
      data.files.length ? `Dateien (Namen): ${data.files.join(", ")}` : "Keine Dateinamen übermittelt.",
    ].join("\n");
    const channel = /delle|hagel/i.test(data.title) ? "dellen" : "zustand";
    await sql`
      insert into inbox_messages (shop_id, channel, sender, subject, body)
      values (${SHOP}, ${channel}, ${data.name}, ${data.title}, ${body})
    `;
    return { ok: true as const };
  });

export const listBookings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    return sql<BookingRow>`
      select id, status, customer_name, phone, email, preferred_date, preferred_slot,
             package_id, class_id, extra_ids, city_slug, note, total_cents, pickup_cents,
             created_at, updated_at
      from bookings
      where shop_id = ${SHOP}
      order by created_at desc
      limit 200
    `;
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        id: z.number().int().positive(),
        status: z.enum(["neu", "bestaetigt", "abgelehnt", "erledigt"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      customer_name: string;
      email: string | null;
      phone: string;
      package_id: string;
      preferred_date: string | null;
      preferred_slot: string | null;
      total_cents: number;
    }>`
      select id, customer_name, email, phone, package_id, preferred_date, preferred_slot, total_cents
      from bookings
      where id = ${data.id} and shop_id = ${SHOP}
      limit 1
    `;
    const booking = rows[0];
    if (!booking) throw new Error("Buchung nicht gefunden.");

    await sql`
      update bookings
      set status = ${data.status}, handled_by = ${context.userId}, updated_at = now()
      where id = ${data.id} and shop_id = ${SHOP}
    `;

    await queueBookingAutomation(sql, booking, data.status, context.userId);

    return { ok: true as const };
  });
