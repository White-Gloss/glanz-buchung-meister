import type { Sql } from "./db.ts";
import { vibeApiKey } from "./bitrix.ts";

const SHOP = "white-gloss";

export async function readVibeApiKey(sql: Sql): Promise<string> {
  const fromEnv = vibeApiKey();
  if (fromEnv) return fromEnv;
  const [row] = await sql<{ vibe_api_key: string | null }>`
    select vibe_api_key from shop_settings where shop_id=${SHOP}
  `.catch(() => []);
  return row?.vibe_api_key?.trim() || "";
}
