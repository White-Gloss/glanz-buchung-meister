import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { kickBookingDelivery } from "@/lib/booking-delivery";
import { saveBookingRequest } from "@/lib/booking-workflow";
import { assertPublicPostLimit } from "@/lib/rate-limit";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { publicBookingSchema } from "@/lib/booking-schema";
import { MAX_BASE64_UPLOAD_CHARS, validateUploadBatch } from "@/lib/booking-photos";
import { createHash } from "node:crypto";
import { saveBookingPhotos } from "@/lib/booking-photo-storage";
import { MAX_UPLOAD_FILES } from "@/lib/upload-policy";
import {
  createRequestUploadCapability,
  verifyUploadCapability,
} from "@/lib/booking-upload-capability";
import { getBookingUploadCookie, setBookingUploadCookie } from "@/lib/booking-upload-cookie.server";

export { publicBookingSchema };
export type { PublicBookingInput } from "@/lib/booking-schema";

const SHOP = "white-gloss";
function rejectHoneypot(website?: string) {
  if (website && website.trim().length > 0) {
    throw new Error("Anfrage abgelehnt.");
  }
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

export const createPublicPhotoInquiry = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        title: z.string().min(2).max(160),
        requestId: z.string().uuid(),
        name: z.string().trim().min(2).max(120),
        phone: z.string().trim().min(6).max(40),
        text: z.string().max(2000),
        files: z
          .array(
            z.object({
              name: z.string().min(1).max(180),
              mime: z.string().min(3).max(80),
              base64: z.string().min(1).max(MAX_BASE64_UPLOAD_CHARS),
            }),
          )
          .max(8),
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
    if (data.files.length) validateUploadBatch(data.files);
    {
      const key = createHash("sha256").update(`photo:${data.requestId}`).digest("hex");
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            title: data.title,
            name: data.name,
            phone: data.phone,
            text: data.text,
          }),
        )
        .digest("hex");
      const capability = createRequestUploadCapability(data.requestId);
      const row = await sql.transaction(async (tx) => {
        await tx`update booking_workflow_locks set revision=revision+1 where shop_id=${SHOP}`;
        const [existing] = await tx<{
          id: number;
          version: number;
          request_fingerprint: string;
        }>`select id,version,request_fingerprint from bookings where shop_id=${SHOP} and request_key_hash=${key}`;
        if (existing) {
          if (existing.request_fingerprint !== fingerprint)
            throw new Error("Bitte laden Sie das Formular für eine neue Anfrage neu.");
          return existing;
        }
        const [created] = await tx<{
          id: number;
          version: number;
        }>`insert into bookings(shop_id,customer_name,phone,package_id,class_id,extra_ids,total_cents,note,request_key_hash,request_fingerprint,upload_token_hash,upload_token_expires_at)
          values(${SHOP},${data.name},${data.phone},'photo-inquiry','kompakt','[]',0,${data.title + "\n" + data.text},${key},${fingerprint},${capability.hash},${capability.expiresAt}::timestamptz) returning id,version`;
        return created;
      });
      setBookingUploadCookie(row.id, capability);
      // No remote processing until the selected files have been durably uploaded.
      if (data.files.length) await saveBookingPhotos(sql, row.id, data.files);
      const { queueBitrixBooking } = await import("@/lib/bitrix-sync");
      await queueBitrixBooking(sql, row);
      kickBookingDelivery(sql);
      return { ok: true as const };
    }
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
      await queueBitrixPhotos(sql, row);
      kickBookingDelivery(sql);
    }
    return saved;
  });
