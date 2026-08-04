// Serverseitige Preisauskunft.
//
// Quelle der Wahrheit ist dieselbe Postgres-Datenbank, aus der auch
// `create_booking_public` rechnet. Nur so können angezeigter Preis und
// tatsächlich berechneter Buchungsbetrag nicht auseinanderlaufen.
// Falls der direkte Pool nicht konfiguriert ist, greift der Supabase-Fallback.

import type { ServicePriceRow } from "./servicesConfig";
import { createSupabasePublishableFetch } from "@/integrations/supabase/publishable-key-fetch";

const PRICE_CACHE_TTL_MS = 30_000;
let cachedPrices: { rows: ServicePriceRow[]; expiresAt: number } | null = null;

function normalize(rows: Array<Record<string, unknown>>): ServicePriceRow[] {
  return rows.map((r) => ({
    item_type: r.item_type as ServicePriceRow["item_type"],
    item_id: String(r.item_id),
    label: String(r.label),
    amount: Number(r.amount),
  }));
}

async function readFromPool(): Promise<ServicePriceRow[]> {
  const { query } = await import("./db.server");
  const rows = await query<Record<string, unknown>>(
    `SELECT item_type, item_id, label, amount
       FROM public.service_prices
      ORDER BY item_type, item_id`,
  );
  return normalize(rows);
}

async function readFromSupabase(): Promise<ServicePriceRow[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];

  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: createSupabasePublishableFetch(key) },
  });

  const { data, error } = await client
    .from("service_prices")
    .select("item_type, item_id, label, amount")
    .order("item_type")
    .order("item_id");
  if (error) throw new Error(error.message);
  return normalize(data ?? []);
}

/**
 * Liest die gepflegten Preise. Fehler führen nie zu einem Seitenfehler –
 * im Zweifel gelten die im Code hinterlegten Standardwerte.
 */
export async function readServicePrices(): Promise<ServicePriceRow[]> {
  if (cachedPrices && cachedPrices.expiresAt > Date.now()) return cachedPrices.rows;

  let rows: ServicePriceRow[] | undefined;
  try {
    rows = await readFromPool();
  } catch {
    try {
      rows = await readFromSupabase();
    } catch {
      rows = undefined;
    }
  }

  if (!rows?.length) return cachedPrices?.rows ?? [];

  cachedPrices = { rows, expiresAt: Date.now() + PRICE_CACHE_TTL_MS };
  return rows;
}

/** Cache verwerfen, damit eine Preisänderung im Admin sofort sichtbar wird. */
export function invalidateServicePriceCache() {
  cachedPrices = null;
}
