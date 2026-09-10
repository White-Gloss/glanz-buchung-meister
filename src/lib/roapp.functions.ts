import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSql } from "@/lib/db";
import { canConfirmBookings } from "@/lib/booking-owner";
import { roappCredentialsFromEnv } from "@/lib/roapp";

const SHOP = "white-gloss";

export const roappStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const [setting] = await sql<{
      roapp_sync_enabled: boolean;
    }>`select roapp_sync_enabled from shop_settings where shop_id=${SHOP}`;
    const creds = roappCredentialsFromEnv();
    return {
      configured: Boolean(creds),
      enabled: Boolean(setting?.roapp_sync_enabled),
      branchId: creds?.branchId ?? null,
      assigneeId: creds?.assigneeId ?? null,
      orderTypeId: creds?.orderTypeId ?? null,
      entityCount: creds ? Object.keys(creds.entityMap).length : 0,
      apiBase: creds?.apiBase ?? null,
    };
  });

export const roappSyncOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      booking_id: number;
      requested_version: number;
      synced_version: number;
      status: string;
      last_error: string | null;
      ro_contact_id: number | null;
      ro_booking_id: number | null;
      ro_order_id: number | null;
      updated_at: string;
    }>`
      select booking_id,requested_version,synced_version,status,last_error,
        ro_contact_id,ro_booking_id,ro_order_id,updated_at
      from roapp_sync_queue where shop_id=${SHOP} order by booking_id desc limit 100`;
    return { rows, canManage: await canConfirmBookings(sql, context.userId) };
  });

export const setRoappSyncEnabled = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der angemeldete Inhaber darf die RO-App-Übertragung umstellen.");
    if (data.enabled && !roappCredentialsFromEnv())
      throw new Error(
        "Bitte zuerst ROAPP_API_KEY, ROAPP_BRANCH_ID, ROAPP_ASSIGNEE_ID und ROAPP_ORDER_TYPE_ID in der Serverumgebung setzen.",
      );
    await sql`update shop_settings set roapp_sync_enabled=${data.enabled},updated_at=now() where shop_id=${SHOP}`;
    return { enabled: data.enabled };
  });

export const retryRoappSync = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ bookingId: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der angemeldete Inhaber darf eine erneute RO-App-Prüfung starten.");
    await sql`update roapp_sync_queue set status='pending',attempts=0,next_attempt_at=now(),updated_at=now()
      where shop_id=${SHOP} and booking_id=${data.bookingId} and status in ('failed','review')`;
    return { ok: true };
  });
