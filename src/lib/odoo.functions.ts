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
  odooWritesEnabled,
  probeOdoo,
  type OdooCredentials,
} from "@/lib/odoo";

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
    const writes = {
      customers: odooWritesEnabled(process.env.ODOO_CUSTOMER_WRITE_ENABLED),
      operations: odooWritesEnabled(process.env.ODOO_OPERATIONAL_WRITES_ENABLED),
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
