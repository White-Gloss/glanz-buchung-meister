import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { ServicePriceRow } from "./servicesConfig";

const PRICE_CACHE_TTL_MS = 30_000;
let cachedPrices: { rows: ServicePriceRow[]; expiresAt: number } | null = null;

export const listServicePrices = createServerFn({ method: "GET" }).handler(async () => {
  if (cachedPrices && cachedPrices.expiresAt > Date.now()) return cachedPrices.rows;

  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const url = process.env.SUPABASE_URL!;
  if (!key || !url) return [] as ServicePriceRow[];

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });

  const { data, error } = await client
    .from("service_prices")
    .select("item_type, item_id, label, amount")
    .order("item_type")
    .order("item_id");
  if (error) return cachedPrices?.rows ?? ([] as ServicePriceRow[]);

  const rows = (data ?? []).map((r) => ({
    item_type: r.item_type as ServicePriceRow["item_type"],
    item_id: r.item_id as string,
    label: r.label as string,
    amount: Number(r.amount),
  }));
  cachedPrices = { rows, expiresAt: Date.now() + PRICE_CACHE_TTL_MS };
  return rows;
});
