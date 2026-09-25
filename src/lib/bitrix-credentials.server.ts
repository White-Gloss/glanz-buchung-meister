import type { Sql } from "./db.ts";
import { bitrixWebhook, normalizeBitrixRestWebhook } from "./bitrix.ts";

export async function readBitrixWebhook(sql: Sql): Promise<string> {
  const fromEnv = bitrixWebhook();
  if (fromEnv) return fromEnv;
  // Keep the existing settings column; old proxy keys are deliberately rejected.
  const [row] = await sql<{
    vibe_api_key: string | null;
  }>`select vibe_api_key from shop_settings where shop_id='white-gloss'`.catch(() => []);
  return normalizeBitrixRestWebhook(row?.vibe_api_key || "") || "";
}
