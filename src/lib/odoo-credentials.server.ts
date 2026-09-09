import type { Sql } from "./db.ts";
import { normalizeOdooBaseUrl, odooCredentialsFromEnv, ODOO_DEFAULT_DATABASE } from "./odoo.ts";

export async function readOdooCredentials(sql: Sql) {
  const fromEnv = odooCredentialsFromEnv();
  if (fromEnv) return fromEnv;
  const [row] = await sql<{
    odoo_base_url: string | null;
    odoo_database: string | null;
    odoo_api_key: string | null;
  }>`
    select odoo_base_url,odoo_database,odoo_api_key from shop_settings where shop_id='white-gloss'
  `;
  const baseUrl = normalizeOdooBaseUrl(row?.odoo_base_url);
  const apiKey = row?.odoo_api_key?.trim();
  return baseUrl && apiKey
    ? { baseUrl, apiKey, database: row?.odoo_database || ODOO_DEFAULT_DATABASE }
    : null;
}
