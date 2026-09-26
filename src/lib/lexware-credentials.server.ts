import type { Sql } from "./db.ts";
import {
  lexwareCredentialsFromEnv,
  LEXWARE_DEFAULT_API_BASE,
  type LexwareCredentials,
} from "./lexware.ts";

const SHOP = "white-gloss";

export async function readLexwareCredentials(sql: Sql): Promise<LexwareCredentials | null> {
  const fromEnv = lexwareCredentialsFromEnv();
  if (fromEnv) return fromEnv;
  const [row] = await sql<{ lexware_api_key: string | null }>`
    select lexware_api_key from shop_settings where shop_id=${SHOP}
  `;
  const apiKey = row?.lexware_api_key?.trim();
  if (!apiKey) return null;
  return { apiKey, apiBase: LEXWARE_DEFAULT_API_BASE };
}
