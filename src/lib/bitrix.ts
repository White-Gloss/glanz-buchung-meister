import { BitrixError, type BitrixCall } from "./bitrix-error.ts";
import {
  createBitrixRestClient,
  normalizeBitrixRestWebhook,
  probeBitrixRest,
} from "./bitrix-rest.ts";
export { BitrixError, type BitrixCall } from "./bitrix-error.ts";
export { normalizeBitrixRestWebhook } from "./bitrix-rest.ts";

export function bitrixWebhook() {
  return (
    normalizeBitrixRestWebhook(process.env.BITRIX_WEBHOOK_URL || process.env.VIBE_API_KEY || "") ||
    ""
  );
}

export async function probeBitrix(key: string, options: { fetchImpl?: typeof fetch } = {}) {
  const webhook = normalizeBitrixRestWebhook(key);
  if (!webhook)
    return { ok: false as const, error: "Bitte eine gültige Bitrix24 REST-Webhook-URL einfügen." };
  return probeBitrixRest(webhook, options);
}

export function createBitrixClient(key = bitrixWebhook()): BitrixCall {
  const webhook = normalizeBitrixRestWebhook(key);
  if (!webhook)
    throw new BitrixError("Direkter Bitrix24 REST-Zugang fehlt.", "bitrix_not_configured", 0, {
      review: true,
    });
  return createBitrixRestClient(webhook);
}

export const DEFAULT_PRODUCT_MAP: Record<string, number> = {
  basis: 2,
  premium: 4,
  keramik: 6,
  leder: 8,
  "leder-repair": 10,
  ozon: 12,
  hol20: 16,
  hol50: 18,
  felgen: 20,
  motor: 22,
  alcantara: 24,
  dachhimmel: 26,
  scheinwerfer: 28,
  glas: 30,
  "keramik-ultra": 32,
  cabrio: 34,
  tierhaar: 36,
  "stoff-loch": 38,
};

export function productMapFromEnv(
  raw = process.env.BITRIX_PRODUCT_MAP || process.env.VIBE_PRODUCT_MAP,
): Record<string, number> {
  const map = { ...DEFAULT_PRODUCT_MAP };
  const text = (raw || "").trim();
  if (!text) return map;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    for (const [key, value] of Object.entries(parsed)) {
      const id = Number(value);
      if (Number.isInteger(id) && id > 0) map[key] = id;
    }
  } catch {
    /* keep defaults when the override is not valid JSON */
  }
  return map;
}
