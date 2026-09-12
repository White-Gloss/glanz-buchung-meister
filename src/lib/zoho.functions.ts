import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { getSql } from "@/lib/db";
import { canConfirmBookings, requireBookingOwner } from "@/lib/booking-owner";
import { createSignedPhotoUrl } from "@/lib/booking-photos";
import { kickBookingDelivery } from "@/lib/booking-delivery";
import { zohoConfigured, zohoCredentialsFromEnv } from "@/lib/zoho";
import { readZohoCredentials } from "@/lib/zoho-credentials.server";
import {
  completeServiceWithPayment,
  confirmBookingWithSchedule,
  ensureZohoSchema,
  listBusyWindows,
  rejectOrCancelBooking,
  zohoOpsEnabled,
  type ZohoBooking,
} from "@/lib/zoho-ops";
import { runZohoSync } from "@/lib/zoho-sync";
import { formatBerlinRange } from "@/lib/zoho-time";

const SHOP = "white-gloss";

const bookingRef = z.object({
  id: z.number().int().positive(),
  expectedVersion: z.number().int().positive(),
});

export const zohoWorkplace = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureZohoSchema(sql).catch(() => undefined);
    const enabled = await zohoOpsEnabled(sql).catch(() => false);
    const creds = await readZohoCredentials(sql).catch(() => null);
    const env = zohoCredentialsFromEnv();
    const bookings = await sql<ZohoBooking>`
      select * from bookings where shop_id = ${SHOP} order by created_at desc limit 80
    `;
    const jobs = await sql<{
      id: number;
      booking_id: number;
      job: string;
      status: string;
      last_error: string | null;
      updated_at: string;
    }>`
      select id, booking_id, job, status, last_error, updated_at::text
      from zoho_job_queue where shop_id = ${SHOP}
      order by id desc limit 40
    `.catch(() => []);
    const photos = await sql<{
      booking_id: number;
      id: number;
      original_name: string;
      mime: string;
      storage_path: string;
      upload_state: string;
    }>`
      select booking_id, id, original_name, mime, storage_path, upload_state
      from booking_photos
      where shop_id = ${SHOP} and booking_id = any(${bookings.length ? bookings.map((row) => row.id) : [0]})
    `.catch(() => []);
    const photoViews = await Promise.all(
      photos.map(async (photo) => ({
        bookingId: photo.booking_id,
        id: photo.id,
        name: photo.original_name,
        mime: photo.mime,
        state: photo.upload_state,
        url:
          photo.upload_state === "ready"
            ? await createSignedPhotoUrl(photo.storage_path).catch(() => null)
            : null,
      })),
    );
    return {
      enabled,
      connected: Boolean(creds || env),
      hasClient: Boolean((process.env.ZOHO_CLIENT_ID || "").trim()),
      hasOrg: Boolean((process.env.ZOHO_BOOKS_ORG_ID || "").trim() || creds?.booksOrgId),
      dc: creds?.dc || env?.dc || "eu",
      canConfirm: await canConfirmBookings(sql, context.userId),
      configured: zohoConfigured(),
      bookings: bookings.map((row) => ({
        ...row,
        workLabel:
          row.work_start_at && row.work_end_at
            ? formatBerlinRange(new Date(row.work_start_at), new Date(row.work_end_at))
            : `${row.preferred_date || "offen"} ${row.preferred_slot || ""}`.trim(),
      })),
      jobs,
      photos: photoViews,
    };
  });

export const zohoConfirm = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    bookingRef
      .extend({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        durationMinutes: z.number().int().positive().max(20_160).optional(),
        agreedCents: z.number().int().positive(),
        resourceId: z.number().int().min(1).max(2).optional(),
        internalNotes: z.string().max(4000).optional(),
        customerAccepted: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    try {
      const result = await confirmBookingWithSchedule(
        sql,
        data.id,
        data.expectedVersion,
        context.userId,
        data,
      );
      return {
        ok: true as const,
        awaitingCustomer: Boolean("awaitingCustomer" in result && result.awaitingCustomer),
        acceptance: "acceptance" in result ? result.acceptance : null,
      };
    } finally {
      kickBookingDelivery(sql);
    }
  });

export const zohoReject = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    bookingRef.extend({ status: z.enum(["abgelehnt", "storniert"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await rejectOrCancelBooking(sql, data.id, data.expectedVersion, context.userId, data.status);
    kickBookingDelivery(sql);
    return { ok: true as const };
  });

export const zohoComplete = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    bookingRef
      .extend({
        payment: z.enum(["bar", "ueberweisung"]),
        cashCents: z.number().int().positive().optional(),
        cashDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        agreedCents: z.number().int().positive().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await completeServiceWithPayment(sql, data.id, data.expectedVersion, context.userId, data);
    kickBookingDelivery(sql);
    return { ok: true as const };
  });

export const zohoRunSync = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    return runZohoSync(sql);
  });

export const setZohoOpsSwitch = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    await requireBookingOwner(sql, context.userId);
    await ensureZohoSchema(sql);
    await sql`
      update shop_settings set zoho_ops_enabled = ${data.enabled}, updated_at = now()
      where shop_id = ${SHOP}
    `;
    return { enabled: data.enabled };
  });

export const publicBusyWindows = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const windows = await listBusyWindows(
      sql,
      `${data.from}T00:00:00+01:00`,
      `${data.to}T23:59:59+02:00`,
    );
    return { windows };
  });
