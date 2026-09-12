import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { getSql } from "@/lib/db";
import { type BookingStatus } from "@/data/site";
import { kickBookingDelivery } from "@/lib/booking-delivery";
import {
  saveBookingRequest,
  saveManualBookingRequest,
  confirmBookingManually,
  changeBookingStatus,
  editBooking,
} from "@/lib/booking-workflow";
import { canConfirmBookings } from "@/lib/booking-owner";
import { isCalendarDate } from "@/lib/calendar-date";
import { assertPublicPostLimit } from "@/lib/rate-limit";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { publicBookingSchema, manualBookingSchema } from "@/lib/booking-schema";
import { MAX_BASE64_UPLOAD_CHARS } from "@/lib/booking-photos";
import { saveBookingPhotos } from "@/lib/booking-photo-storage";
import { createSignedPhotoUrl } from "@/lib/booking-photos";
import { MAX_UPLOAD_FILES } from "@/lib/upload-policy";
import {
  createRequestUploadCapability,
  verifyUploadCapability,
} from "@/lib/booking-upload-capability";
import { getBookingUploadCookie, setBookingUploadCookie } from "@/lib/booking-upload-cookie.server";

export { publicBookingSchema };
export type { PublicBookingInput } from "@/lib/booking-schema";

const SHOP = "white-gloss";
export type BookingRow = {
  id: number;
  version: number;
  confirmed_at: string | null;
  confirmed_by: string | null;
  cancelled_at: string | null;
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
  qonto_client_id: string | null;
  qonto_invoice_id: string | null;
  qonto_invoice_number: string | null;
  qonto_invoice_status: string | null;
  qonto_invoice_error: string | null;
  qonto_sent_at: string | null;
};

function rejectHoneypot(website?: string) {
  if (website && website.trim().length > 0) {
    throw new Error("Anfrage abgelehnt.");
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
    const sql = await getSql();
    const capability = createRequestUploadCapability(data.idempotencyKey);
    const result = await saveBookingRequest(sql, data, capability);
    const expires = result.booking.upload_token_expires_at;
    if (expires) capability.expiresAt = new Date(expires).toISOString();
    setBookingUploadCookie(result.booking.id, capability);
    // Provider failures never roll back the committed request or its durable outbox.
    kickBookingDelivery(sql);
    return {
      id: result.booking.id,
      reference: `WG-${result.booking.id}`,
      total: result.booking.total_cents / 100,
      pickupOnRequest: result.quote.pickupOnRequest,
      confirmed: false,
    };
  });

export const createManualBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => manualBookingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const result = await saveManualBookingRequest(sql, data, context.userId);
    kickBookingDelivery(sql);
    return { id: result.booking.id, confirmed: false as const };
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
      data.files.length
        ? `Dateien (Namen): ${data.files.join(", ")}`
        : "Keine Dateinamen übermittelt.",
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
    assertPublicPostLimit("booking-photos", 24);

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
    if (
      !booking ||
      !verifyUploadCapability(
        getBookingUploadCookie(bookingId),
        booking.upload_token_hash,
        booking.upload_token_expires_at,
      )
    ) {
      throw new Error(
        "Fotos können nur im Browser der ursprünglichen Anfrage innerhalb von sieben Tagen nachgereicht werden. Bitte kontaktieren Sie uns bei Bedarf.",
      );
    }

    const saved = await saveBookingPhotos(sql, bookingId, data.files);
    const [row] = await sql<{ id: number; version: number }>`
      select id, version from bookings where id = ${bookingId} and shop_id = ${SHOP} limit 1`;
    if (row) {
      const { queueBitrixPhotos } = await import("@/lib/bitrix-sync");
      await queueBitrixPhotos(sql, row).catch(() => undefined);
      kickBookingDelivery(sql);
    }
    return saved;
  });

export const listBookings = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    return sql<BookingRow>`
      select id, status, version, confirmed_at, confirmed_by, cancelled_at, customer_name, phone, email, preferred_date, preferred_slot,
             package_id, class_id, extra_ids, city_slug, note, total_cents, pickup_cents,
             created_at, updated_at,
             qonto_client_id, qonto_invoice_id, qonto_invoice_number,
             qonto_invoice_status, qonto_invoice_error, qonto_sent_at
      from bookings
      where shop_id = ${SHOP}
      order by created_at desc
      limit 200
    `;
  });

export const listBookingPhotos = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ bookingId: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      original_name: string;
      mime: string;
      storage_path: string;
      upload_state: string;
    }>`
      select id,original_name,mime,storage_path,upload_state from booking_photos
      where shop_id=${SHOP} and booking_id=${data.bookingId} order by id limit 8`;
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        name: row.original_name,
        mime: row.mime,
        state: row.upload_state,
        url:
          row.upload_state === "ready"
            ? await createSignedPhotoUrl(row.storage_path).catch(() => null)
            : null,
      })),
    );
  });

const bookingMutation = z.object({
  id: z.number().int().positive(),
  expectedVersion: z.number().int().positive(),
});

export const getBookingPermissions = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async ({ context }) => ({
    canConfirm: await canConfirmBookings(await getSql(), context.userId),
  }));

export const confirmBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => bookingMutation.parse(input))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    try {
      await confirmBookingManually(sql, data.id, data.expectedVersion, context.userId);
    } finally {
      kickBookingDelivery(sql);
    }
    return { ok: true as const };
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    bookingMutation
      .extend({
        status: z.enum([
          "neu",
          "bestaetigt",
          "abgelehnt",
          "storniert",
          "erledigt",
          "nicht_erschienen",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await changeBookingStatus(sql, data.id, data.expectedVersion, data.status, context.userId);
    kickBookingDelivery(sql);
    return { ok: true as const };
  });

export const updateBookingDetails = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    publicBookingSchema
      .pick({
        name: true,
        phone: true,
        email: true,
        date: true,
        slot: true,
        packageId: true,
        classId: true,
        extraIds: true,
        citySlug: true,
        note: true,
      })
      .extend({
        ...bookingMutation.shape,
        date: z
          .string()
          .max(20)
          .optional()
          .refine((v) => !v || isCalendarDate(v), "Ungültiger Abgabetermin"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await editBooking(sql, data.id, data.expectedVersion, data, context.userId);
    kickBookingDelivery(sql);
    return { ok: true as const };
  });

export const getBookingHistory = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    return sql<{
      id: number;
      event: string;
      actor: string;
      version: number;
      before_data: Record<string, string | number | boolean | null> | null;
      after_data: Record<string, string | number | boolean | null>;
      created_at: string;
    }>`
      select id,event,actor,version,before_data,after_data,created_at from booking_events
      where shop_id=${SHOP} and booking_id=${data.id} order by version desc limit 100`;
  });
