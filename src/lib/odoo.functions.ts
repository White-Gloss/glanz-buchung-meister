import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSql } from "@/lib/db";
import {
  ODOO_DEFAULT_BASE_URL,
  ODOO_DEFAULT_DATABASE,
  normalizeOdooBaseUrl,
  odooCredentialsFromEnv,
  odooJson2,
  probeOdoo,
  type OdooCredentials,
} from "@/lib/odoo";
import { canConfirmBookings } from "@/lib/booking-owner";
import { readOdooCredentials } from "@/lib/odoo-credentials.server";

const SHOP = "white-gloss";

type StoredOdooKey = {
  apiKey: string | null;
  baseUrl: string | null;
  database: string | null;
};

async function ensureOdooSettings(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql`
    create table if not exists shop_settings (
      shop_id text primary key default 'white-gloss',
      operator_pin text not null default 'WG-BETRIEB',
      updated_at timestamptz not null default now()
    )
  `;
  await sql`alter table shop_settings add column if not exists odoo_base_url text`;
  await sql`alter table shop_settings add column if not exists odoo_database text`;
  await sql`alter table shop_settings add column if not exists odoo_api_key text`;
  await sql`
    insert into shop_settings (shop_id, operator_pin)
    values (${SHOP}, ${"WG-BETRIEB"})
    on conflict (shop_id) do nothing
  `;
}

async function storedKey(): Promise<StoredOdooKey> {
  const sql = await getSql();
  await ensureOdooSettings(sql);
  const [row] = await sql<{
    odoo_base_url: string | null;
    odoo_database: string | null;
    odoo_api_key: string | null;
  }>`
    select odoo_base_url, odoo_database, odoo_api_key
    from shop_settings
    where shop_id = ${SHOP}
    limit 1
  `;
  return {
    apiKey: row?.odoo_api_key?.trim() || null,
    baseUrl: row?.odoo_base_url?.trim() || null,
    database: row?.odoo_database?.trim() || null,
  };
}

function resolveCredentials(stored: StoredOdooKey): {
  creds: OdooCredentials | null;
  source: "env" | "panel" | "none";
} {
  const fromEnv = odooCredentialsFromEnv();
  if (fromEnv) return { creds: fromEnv, source: "env" };
  const baseUrl = normalizeOdooBaseUrl(stored.baseUrl || ODOO_DEFAULT_BASE_URL);
  const database = stored.database || ODOO_DEFAULT_DATABASE;
  if (stored.apiKey && baseUrl && database) {
    return { creds: { baseUrl, database, apiKey: stored.apiKey }, source: "panel" };
  }
  return { creds: null, source: "none" };
}

export const odooStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const stored = await storedKey();
    const { creds, source } = resolveCredentials(stored);
    const sql = await getSql();
    const [setting] = await sql<{
      odoo_sync_enabled: boolean;
    }>`select odoo_sync_enabled from shop_settings where shop_id=${SHOP}`;
    const writes = {
      customers: Boolean(setting?.odoo_sync_enabled),
      operations: Boolean(setting?.odoo_sync_enabled),
    };
    if (!creds) {
      return {
        configured: false,
        connected: false,
        source,
        baseUrl: ODOO_DEFAULT_BASE_URL,
        database: ODOO_DEFAULT_DATABASE,
        uid: null as number | null,
        writes,
        error: null as string | null,
      };
    }
    const probe = await probeOdoo(creds);
    return {
      configured: true,
      connected: probe.ok,
      source,
      baseUrl: creds.baseUrl,
      database: creds.database,
      uid: probe.uid,
      writes,
      error: probe.ok ? null : probe.error,
    };
  });

export const odooSyncOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      booking_id: number;
      requested_version: number;
      synced_version: number;
      status: string;
      last_error: string | null;
      odoo_order_id: number | null;
      updated_at: string;
    }>`
      select booking_id,requested_version,synced_version,status,last_error,odoo_order_id,updated_at
      from odoo_sync_queue where shop_id=${SHOP} order by booking_id desc limit 100`;
    return { rows, canManage: await canConfirmBookings(sql, context.userId) };
  });

export const setOdooSyncEnabled = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der angemeldete Inhaber darf die Übertragung umstellen.");
    if (data.enabled) {
      const creds = await readOdooCredentials(sql);
      if (!creds || !(await probeOdoo(creds)).ok)
        throw new Error("Bitte zuerst Odoo erfolgreich verbinden.");
      const fields = await odooJson2<Record<string, unknown>>(creds, "x_auftrage", "fields_get", {
        attributes: ["type"],
      });
      if (
        !fields.response.ok ||
        ![
          "x_studio_notes",
          "x_studio_value",
          "x_studio_partner_id",
          "x_studio_date",
          "x_studio_char_1",
          "x_studio_stage_id",
        ].every((key) => fields.payload?.[key])
      )
        throw new Error("Die Odoo-Auftragsfelder sind noch nicht vollständig eingerichtet.");
      const stages = await odooJson2<{ x_name: string }[]>(
        creds,
        "x_auftrage_stage",
        "search_read",
        { domain: [], fields: ["x_name"], context: { lang: "de_DE" } },
      );
      if (
        !stages.response.ok ||
        !["Neu", "In Bearbeitung", "Erledigt", "Abgelehnt", "Storniert", "Nicht erschienen"].every(
          (name) => stages.payload?.some((stage) => stage.x_name === name),
        )
      )
        throw new Error(
          "Bitte die Auftragsphasen Neu, In Bearbeitung, Erledigt, Abgelehnt, Storniert und Nicht erschienen in Odoo einrichten.",
        );
    }
    await sql`update shop_settings set odoo_sync_enabled=${data.enabled},updated_at=now() where shop_id=${SHOP}`;
    return { enabled: data.enabled };
  });

export const retryOdooSync = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) => z.object({ bookingId: z.number().int().positive() }).parse(input))
  .handler(async ({ data, context }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    if (!(await canConfirmBookings(sql, context.userId)))
      throw new Error("Nur der angemeldete Inhaber darf eine erneute Prüfung starten.");
    await sql`update odoo_sync_queue set status='pending',attempts=0,next_attempt_at=now(),updated_at=now()
      where shop_id=${SHOP} and booking_id=${data.bookingId} and status in ('failed','review')`;
    return { ok: true };
  });

export const saveOdooApiKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z.object({ apiKey: z.string().trim().min(20).max(512) }).parse(input),
  )
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const probe = await probeOdoo({
      baseUrl: ODOO_DEFAULT_BASE_URL,
      database: ODOO_DEFAULT_DATABASE,
      apiKey: data.apiKey,
    });
    if (!probe.ok) {
      return { ok: false, connected: false, uid: probe.uid, error: probe.error };
    }
    const sql = await getSql();
    await ensureOdooSettings(sql);
    await sql`
      update shop_settings
      set
        odoo_base_url = ${ODOO_DEFAULT_BASE_URL},
        odoo_database = ${ODOO_DEFAULT_DATABASE},
        odoo_api_key = ${data.apiKey},
        updated_at = now()
      where shop_id = ${SHOP}
    `;
    return { ok: probe.ok, connected: probe.ok, uid: probe.uid, error: probe.error };
  });
