import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSql } from "@/lib/db";
import { canConfirmBookings } from "@/lib/booking-owner";
import { kickBookingDelivery } from "@/lib/booking-delivery";
import { probeBitrix, vibeApiKey } from "@/lib/bitrix";
import { readVibeApiKey } from "@/lib/bitrix-credentials.server";
import { ensureBitrixSchema, runBitrixSync } from "@/lib/bitrix-sync";

const SHOP = "white-gloss";

export const bitrixStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    await ensureBitrixSchema(sql);
    const fromEnv = Boolean(vibeApiKey());
    const key = await readVibeApiKey(sql);
    return {
      configured: Boolean(key),
      source: fromEnv ? ("env" as const) : key ? ("panel" as const) : ("none" as const),
    };
  });

export const bitrixSyncOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureBitrixSchema(sql);
    const rows = await sql<{
      booking_id: number;
      requested_version: number;
      synced_version: number;
      status: string;
      last_error: string | null;
      bitrix_deal_id: number | null;
      bitrix_contact_id: number | null;
      updated_at: string;
    }>`
      select q.booking_id,q.requested_version,q.synced_version,q.status,q.last_error,
        q.bitrix_deal_id,q.bitrix_contact_id,q.updated_at::text
      from bitrix_sync_queue q
      where q.shop_id=${SHOP}
      order by q.booking_id desc
      limit 100`;
    return { rows, canManage: await canConfirmBookings(sql, context.userId) };
  });

export const saveBitrixApiKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z.object({ apiKey: z.string().trim().min(20).max(1024) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der angemeldete Inhaber darf den Bitrix-Schlüssel speichern.");
    const probe = await probeBitrix(data.apiKey);
    if (!probe.ok) return { ok: false, connected: false, error: probe.error };
    await ensureBitrixSchema(sql);
    await sql`update shop_settings set vibe_api_key=${data.apiKey},updated_at=now() where shop_id=${SHOP}`;
    kickBookingDelivery(sql);
    return { ok: true, connected: true, error: null as string | null };
  });

export const retryBitrixSync = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ bookingId: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    await ensureBitrixSchema(sql);
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der angemeldete Inhaber darf eine erneute Bitrix-Prüfung starten.");
    await sql`update bitrix_sync_queue set status='pending',attempts=0,next_attempt_at=now(),updated_at=now()
      where shop_id=${SHOP} and booking_id=${data.bookingId} and status in ('failed','review')`;
    kickBookingDelivery(sql);
    return { ok: true };
  });

export const runBitrixNow = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async ({ context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der angemeldete Inhaber darf Bitrix-Übertragungen anstoßen.");
    if (!(await readVibeApiKey(sql))) throw new Error("Bitte zuerst den Bitrix-Schlüssel speichern.");
    return runBitrixSync(sql, { limit: 8 });
  });
