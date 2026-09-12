import type { Sql } from "./db.ts";
import { normalizeZohoDc, zohoCredentialsFromEnv, type ZohoCredentials } from "./zoho.ts";

const SHOP = "white-gloss";

export async function readZohoCredentials(sql: Sql): Promise<ZohoCredentials | null> {
  const fromEnv = zohoCredentialsFromEnv();
  const [row] = await sql<{
    zoho_dc: string | null;
    zoho_client_id: string | null;
    zoho_client_secret: string | null;
    zoho_refresh_token: string | null;
    zoho_access_token: string | null;
    zoho_access_expires_at: string | Date | null;
    zoho_books_org_id: string | null;
  }>`
    select zoho_dc, zoho_client_id, zoho_client_secret, zoho_refresh_token,
           zoho_access_token, zoho_access_expires_at, zoho_books_org_id
    from shop_settings where shop_id = ${SHOP}
  `.catch(() => []);
  const clientId = (process.env.ZOHO_CLIENT_ID || "").trim() || row?.zoho_client_id?.trim() || "";
  const clientSecret =
    (process.env.ZOHO_CLIENT_SECRET || "").trim() || row?.zoho_client_secret?.trim() || "";
  const refreshToken =
    (process.env.ZOHO_REFRESH_TOKEN || "").trim() || row?.zoho_refresh_token?.trim() || "";
  if (!clientId || !clientSecret || !refreshToken) {
    return fromEnv;
  }
  return {
    dc: normalizeZohoDc(process.env.ZOHO_DC || row?.zoho_dc),
    clientId,
    clientSecret,
    refreshToken,
    accessToken: fromEnv?.accessToken || row?.zoho_access_token?.trim() || undefined,
    accessExpiresAt: row?.zoho_access_expires_at
      ? new Date(row.zoho_access_expires_at).getTime()
      : undefined,
    booksOrgId:
      (process.env.ZOHO_BOOKS_ORG_ID || "").trim() || row?.zoho_books_org_id?.trim() || undefined,
  };
}

export async function zohoOpsEnabled(sql: Sql): Promise<boolean> {
  if ((process.env.ZOHO_OPS_ENABLED || "").trim() === "true") return true;
  const [row] = await sql<{ zoho_ops_enabled: boolean }>`
    select zoho_ops_enabled from shop_settings where shop_id = ${SHOP}
  `;
  return Boolean(row?.zoho_ops_enabled);
}
