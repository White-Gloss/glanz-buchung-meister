import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
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
import {
  queueBookingAutomation,
  queueOwnerNotify,
  flushOutboundEmailQueue,
  safeExec,
  OUTBOUND_QUEUED,
  canAutoConfirmAppointment,
  AUTO_CONFIRM_ACTOR,
  type OccupiedAppointment,
} from "@/lib/ops";
import { assertPublicPostLimit } from "@/lib/rate-limit";
import { isEmailAddress } from "@/lib/utils";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { publicBookingSchema } from "@/lib/booking-schema";
import {
  MAX_BASE64_UPLOAD_CHARS,
  decodeUploadBase64,
  deleteConditionPhotos,
  extensionForMime,
  uploadToConditionPhotos,
  validateUploadBatch,
} from "@/lib/booking-photos";
import { randomBytes } from "node:crypto";
import { MAX_UPLOAD_FILES } from "@/lib/upload-policy";
import { createUploadCapability, verifyUploadCapability } from "@/lib/booking-upload-capability";
import { getBookingUploadCookie, setBookingUploadCookie } from "@/lib/booking-upload-cookie.server";

export { publicBookingSchema };
export type { PublicBookingInput } from "@/lib/booking-schema";

const SHOP = "white-gloss";
const extraIdSet = new Set(extras.map((item) => item.id));
const citySlugSet = new Set(cities.map((item) => item.slug));

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
  const inserted = await sql<{ id: number }>`
    insert into customers (shop_id, name, phone, email)
    values (${SHOP}, ${name}, ${phone}, ${email || null})
    on conflict (shop_id, phone) do update
    set name = excluded.name, email = coalesce(excluded.email, customers.email)
    returning id
  `;
  return inserted[0]?.id ?? null;
}

export const createPublicBooking = createServerFn({ method: "POST" })
  .validator((input: unknown) => publicBookingSchema.parse(input))
  .handler(async ({ data }) => {
    assertSameSiteRequest();
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
    const storedNote = [
      data.note?.trim() || "",
      quote.pickupOnRequest
        ? "Abholung auf Anfrage – Preis nicht im gespeicherten Gesamtbetrag."
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const uploadCapability = createUploadCapability();
    const rows = await sql<{ id: number }>`
      insert into bookings (
        shop_id, customer_name, phone, email, preferred_date, preferred_slot,
        package_id, class_id, extra_ids, city_slug, note, total_cents, pickup_cents,
        upload_token_hash, upload_token_expires_at
      ) values (
        ${SHOP}, ${data.name}, ${data.phone}, ${data.email || null},
        ${preferredDate}, ${data.slot || null},
        ${data.packageId}, ${data.classId}, ${JSON.stringify(data.extraIds)},
        ${data.citySlug}, ${storedNote || null}, ${totalCents}, ${pickupCents},
        ${uploadCapability.hash}, ${uploadCapability.expiresAt}
      )
      returning id
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("Buchung konnte nicht gespeichert werden.");

    await upsertCustomer(sql, data.name, data.phone, data.email || undefined);

    const occupiedRows = preferredDate
      ? await sql<{ preferred_date: string; preferred_slot: string | null; package_id: string }>`
          select preferred_date::text as preferred_date, preferred_slot, package_id
          from bookings
          where shop_id = ${SHOP}
            and id <> ${id}
            and status in ('neu', 'bestaetigt')
            and preferred_date = ${preferredDate}
        `
      : [];
    const occupied: OccupiedAppointment[] = occupiedRows.map((row) => ({
      date: row.preferred_date.slice(0, 10),
      slot: row.preferred_slot,
      packageId: row.package_id,
    }));
    const auto = canAutoConfirmAppointment({
      kind: data.kind,
      packageId: data.packageId,
      preferredDate,
      preferredSlot: data.slot || null,
      occupied,
    });
    if (auto.ok) {
      await sql`
        update bookings
        set status = ${"bestaetigt"}, handled_by = ${AUTO_CONFIRM_ACTOR}, updated_at = now()
        where id = ${id} and shop_id = ${SHOP}
      `;
      await queueBookingAutomation(
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
        "bestaetigt",
        AUTO_CONFIRM_ACTOR,
      );
    }

    const subject =
      data.kind === "dent"
        ? "Fotoanfrage Dellen"
        : data.kind === "condition"
          ? "Fotoanfrage Zustand"
          : auto.ok
            ? `Termin zugesagt ${pack?.name ?? data.packageId}`
            : `Anfrage ${pack?.name ?? data.packageId}`;

    const body = [
      `${data.name} · ${data.phone}`,
      data.email ? data.email : "",
      pack ? pack.name : data.packageId,
      city ? `${city.name} (${city.km} km)` : data.citySlug,
      quote.pickupOnRequest ? "Abholung auf Anfrage" : "",
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
    if (!auto.ok) {
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
    }

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
      auto.ok ? "Terminzusage" : subject,
    );

    await safeExec("flush-outbound-mail", () => flushOutboundEmailQueue(sql));

    setBookingUploadCookie(id, uploadCapability);
    return {
      id,
      reference: `WG-${id}`,
      total: quote.total,
      pickupOnRequest: quote.pickupOnRequest,
      confirmed: auto.ok,
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
        privacy: z.literal(true),
        website: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    assertPublicPostLimit("photo-inquiry", 6);
    rejectHoneypot(data.website);
    const sql = await getSql();
    await upsertCustomer(sql, data.name, data.phone);
    const body = [
      `Name: ${data.name}`,
      `Telefon: ${data.phone}`,
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


const attachBookingPhotosSchema = z.object({
  vorgang: z
    .string()
    .trim()
    .regex(/^WG-(\d+)$/i, "Ungültige Vorgangsnummer."),
  files: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(180),
        mime: z.string().trim().min(3).max(80),
        base64: z
          .string()
          .min(1)
          .max(MAX_BASE64_UPLOAD_CHARS, "Die Datei ist zu groß (höchstens 12 MB)."),
      }),
    )
    .min(1)
    .max(MAX_UPLOAD_FILES),
});

export const attachBookingPhotos = createServerFn({ method: "POST" })
  .validator((input: unknown) => attachBookingPhotosSchema.parse(input))
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    assertPublicPostLimit("booking-photos", 6);

    const match = /^WG-(\d+)$/i.exec(data.vorgang.trim());
    const bookingId = Number(match?.[1] ?? 0);
    if (!Number.isInteger(bookingId) || bookingId < 1) {
      throw new Error("Ungültige Vorgangsnummer.");
    }

    const sql = await getSql();
    const bookings = await sql<{
      id: number;
      customer_name: string;
      upload_token_hash: string | null;
      upload_token_expires_at: string | Date | null;
    }>`
      select id, customer_name, upload_token_hash, upload_token_expires_at
      from bookings
      where id = ${bookingId} and shop_id = ${SHOP}
      limit 1
    `;
    const booking = bookings[0];
    if (!booking || !verifyUploadCapability(
      getBookingUploadCookie(bookingId),
      booking.upload_token_hash,
      booking.upload_token_expires_at,
    )) {
      throw new Error(
        "Fotos können nur im Browser der ursprünglichen Anfrage innerhalb von sieben Tagen nachgereicht werden. Bitte kontaktieren Sie uns bei Bedarf.",
      );
    }

    const validated = validateUploadBatch(data.files);
    const storedNames: string[] = [];
    const batchPaths: string[] = [];
    try {
      for (const [index, file] of data.files.entries()) {
        const bytes = decodeUploadBase64(file.base64);
        const { mime, ext, sizeBytes } = validated[index];
        const random = randomBytes(16).toString("hex");
        const storagePath = `bookings/${bookingId}/${random}.${ext || extensionForMime(mime)}`;
        // Track before sending: a lost response can still mean the object was stored.
        batchPaths.push(storagePath);
        await uploadToConditionPhotos(storagePath, bytes, mime);
        const safeName = file.name.slice(0, 180);
        await sql`
          insert into booking_photos (
            shop_id, booking_id, storage_path, mime, size_bytes, original_name
          ) values (
            ${SHOP}, ${bookingId}, ${storagePath}, ${mime}, ${sizeBytes}, ${safeName}
          )
        `;
        storedNames.push(safeName);
      }
    } catch (error) {
      if (batchPaths.length) {
        try {
          await sql`
            delete from booking_photos
            where shop_id = ${SHOP} and booking_id = ${bookingId}
              and storage_path = any(${batchPaths}::text[])
          `;
        } catch {
          console.error("[booking-photos] failed batch metadata cleanup could not complete");
        }
        try {
          await deleteConditionPhotos(batchPaths);
        } catch {
          console.error("[booking-photos] failed batch storage cleanup could not complete");
        }
      }
      throw error;
    }

    const subject = `Fotos zu WG-${bookingId}`;
    const body = [
      `${storedNames.length} Aufnahme(n) zu Vorgang WG-${bookingId}.`,
      storedNames.length ? `Dateien: ${storedNames.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    await safeExec("booking-photos-inbox", () => sql`
        insert into inbox_messages (shop_id, channel, sender, subject, body, booking_id)
        values (
          ${SHOP}, ${"form"}, ${booking.customer_name}, ${subject}, ${body}, ${bookingId}
        )
      `);

    return { ok: true as const, count: storedNames.length };
  });

export const listBookings = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
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
  .middleware([authMiddleware, operatorMiddleware])
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
    await safeExec("flush-outbound-mail", () => flushOutboundEmailQueue(sql));

    return { ok: true as const };
  });
