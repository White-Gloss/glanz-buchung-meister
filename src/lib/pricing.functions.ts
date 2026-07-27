import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ServicePriceRow } from "./servicesConfig";

export const listServicePrices = createServerFn({ method: "GET" }).handler(async () => {
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
  if (error) return [] as ServicePriceRow[];

  return (data ?? []).map((r) => ({
    item_type: r.item_type as ServicePriceRow["item_type"],
    item_id: r.item_id as string,
    label: r.label as string,
    amount: Number(r.amount),
  }));
});

export const updateServicePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { itemType: string; itemId: string; amount: number }) => {
    const amount = Number(data.amount);
    if (!["package", "addon", "vehicle"].includes(data.itemType))
      throw new Error("Ungültige Preisart");
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000)
      throw new Error("Ungültiger Betrag");
    return { itemType: data.itemType, itemId: String(data.itemId), amount };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Kein Administrator-Zugriff");

    const { error } = await context.supabase
      .from("service_prices")
      .update({ amount: data.amount })
      .eq("item_type", data.itemType)
      .eq("item_id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
