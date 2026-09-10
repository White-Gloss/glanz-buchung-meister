import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSql } from "@/lib/db";
import { canConfirmBookings } from "@/lib/booking-owner";
import { lexwareCredentialsFromEnv, probeLexware, LEXWARE_DEFAULT_API_BASE } from "@/lib/lexware";
import { readLexwareCredentials } from "@/lib/lexware-credentials.server";

const SHOP = "white-gloss";

async function ensureLexwareKeyColumn(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql`alter table shop_settings add column if not exists lexware_api_key text`;
}

export const lexwareStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const sql = await getSql();
    await ensureLexwareKeyColumn(sql);
    const [setting] = await sql<{
      lexware_sync_enabled: boolean;
    }>`select lexware_sync_enabled from shop_settings where shop_id=${SHOP}`;
    const fromEnv = Boolean(lexwareCredentialsFromEnv());
    const creds = await readLexwareCredentials(sql);
    return {
      configured: Boolean(creds),
      enabled: Boolean(setting?.lexware_sync_enabled),
      source: fromEnv ? ("env" as const) : creds ? ("panel" as const) : ("none" as const),
      apiBase: creds?.apiBase ?? null,
    };
  });

export const lexwareSyncOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      booking_id: number;
      requested_version: number;
      synced_version: number;
      status: string;
      last_error: string | null;
      lex_contact_id: string | null;
      lex_invoice_id: string | null;
      updated_at: string;
    }>`
      select booking_id,requested_version,synced_version,status,last_error,
        lex_contact_id,lex_invoice_id,updated_at
      from lexware_sync_queue where shop_id=${SHOP} order by booking_id desc limit 100`;
    return { rows, canManage: await canConfirmBookings(sql, context.userId) };
  });

export const saveLexwareApiKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z.object({ apiKey: z.string().trim().min(20).max(512) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der angemeldete Inhaber darf den Lexware-Schlüssel speichern.");
    const probe = await probeLexware({
      apiKey: data.apiKey,
      apiBase: LEXWARE_DEFAULT_API_BASE,
    });
    if (!probe.ok) return { ok: false, connected: false, error: probe.error };
    await ensureLexwareKeyColumn(sql);
    await sql`update shop_settings set lexware_api_key=${data.apiKey},updated_at=now() where shop_id=${SHOP}`;
    return { ok: true, connected: true, error: null as string | null };
  });

export const setLexwareSyncEnabled = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der angemeldete Inhaber darf die Lexware-Übertragung umstellen.");
    if (data.enabled && !(await readLexwareCredentials(sql)))
      throw new Error("Bitte zuerst den Lexware-API-Schlüssel unter Dokumente speichern.");
    await sql`update shop_settings set lexware_sync_enabled=${data.enabled},updated_at=now() where shop_id=${SHOP}`;
    return { enabled: data.enabled };
  });

export const retryLexwareSync = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ bookingId: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der angemeldete Inhaber darf eine erneute Lexware-Prüfung starten.");
    await sql`update lexware_sync_queue set status='pending',attempts=0,next_attempt_at=now(),updated_at=now()
      where shop_id=${SHOP} and booking_id=${data.bookingId} and status in ('failed','review')`;
    return { ok: true };
  });
