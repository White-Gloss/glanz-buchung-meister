import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { operatorMiddleware } from "@/lib/operator-middleware";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSql } from "@/lib/db";
import {
  ERPNEXT_COMPANY,
  ERPNEXT_DEFAULT_BASE_URL,
  credentialsFromEnv,
  normalizeErpnextBaseUrl,
  probeErpnext,
  writesEnabled,
  type ErpnextCredentials,
} from "@/lib/erpnext";

const SHOP = "white-gloss";

type StoredKeys = {
  apiKey: string | null;
  apiSecret: string | null;
  baseUrl: string | null;
};

async function ensureErpnextSettings(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql`
    create table if not exists shop_settings (
      shop_id text primary key default 'white-gloss',
      operator_pin text not null default 'WG-BETRIEB',
      updated_at timestamptz not null default now()
    )
  `;
  await sql`alter table shop_settings add column if not exists erpnext_base_url text`;
  await sql`alter table shop_settings add column if not exists erpnext_api_key text`;
  await sql`alter table shop_settings add column if not exists erpnext_api_secret text`;
  await sql`
    insert into shop_settings (shop_id, operator_pin)
    values (${SHOP}, ${"WG-BETRIEB"})
    on conflict (shop_id) do nothing
  `;
}

async function storedKeys(): Promise<StoredKeys> {
  const sql = await getSql();
  await ensureErpnextSettings(sql);
  const [row] = await sql<{
    erpnext_base_url: string | null;
    erpnext_api_key: string | null;
    erpnext_api_secret: string | null;
  }>`
    select erpnext_base_url, erpnext_api_key, erpnext_api_secret
    from shop_settings
    where shop_id = ${SHOP}
    limit 1
  `;
  return {
    apiKey: row?.erpnext_api_key?.trim() || null,
    apiSecret: row?.erpnext_api_secret?.trim() || null,
    baseUrl: row?.erpnext_base_url?.trim() || null,
  };
}

function resolveCredentials(stored: StoredKeys): {
  creds: ErpnextCredentials | null;
  source: "env" | "panel" | "none";
} {
  const fromEnv = credentialsFromEnv();
  if (fromEnv) return { creds: fromEnv, source: "env" };
  const baseUrl = normalizeErpnextBaseUrl(stored.baseUrl || ERPNEXT_DEFAULT_BASE_URL);
  if (stored.apiKey && stored.apiSecret && baseUrl) {
    return {
      creds: { baseUrl, apiKey: stored.apiKey, apiSecret: stored.apiSecret },
      source: "panel",
    };
  }
  return { creds: null, source: "none" };
}

export const erpnextStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware, operatorMiddleware])
  .handler(async () => {
    const stored = await storedKeys();
    const { creds, source } = resolveCredentials(stored);
    const customerWrites = writesEnabled(process.env.ERPNEXT_CUSTOMER_WRITE_ENABLED);
    const vehicleWrites = writesEnabled(process.env.ERPNEXT_VEHICLE_ORDER_WRITES_ENABLED);

    if (!creds) {
      return {
        configured: false,
        connected: false,
        source,
        baseUrl: ERPNEXT_DEFAULT_BASE_URL,
        company: ERPNEXT_COMPANY,
        user: null,
        writes: { customer: customerWrites, vehicleOrder: vehicleWrites },
        error: null as string | null,
      };
    }

    const probe = await probeErpnext(creds);
    return {
      configured: true,
      connected: probe.ok,
      source,
      baseUrl: creds.baseUrl,
      company: ERPNEXT_COMPANY,
      user: probe.user,
      writes: { customer: customerWrites, vehicleOrder: vehicleWrites },
      error: probe.ok ? null : probe.error,
    };
  });

export const saveErpnextCredentials = createServerFn({ method: "POST" })
  .middleware([authMiddleware, operatorMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        apiKey: z.string().trim().min(8).max(200),
        apiSecret: z.string().trim().min(8).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const sql = await getSql();
    await ensureErpnextSettings(sql);
    const baseUrl = ERPNEXT_DEFAULT_BASE_URL;
    await sql`
      update shop_settings
      set
        erpnext_base_url = ${baseUrl},
        erpnext_api_key = ${data.apiKey},
        erpnext_api_secret = ${data.apiSecret},
        updated_at = now()
      where shop_id = ${SHOP}
    `;
    const probe = await probeErpnext({
      baseUrl,
      apiKey: data.apiKey,
      apiSecret: data.apiSecret,
    });
    return {
      ok: probe.ok,
      connected: probe.ok,
      user: probe.user,
      error: probe.error,
    };
  });
