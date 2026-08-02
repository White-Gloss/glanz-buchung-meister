import { createServerFn } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { query } from "@/lib/db.server";

export const updateServicePrice = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { itemType: string; itemId: string; amount: number }) => {
    const amount = Number(data.amount);
    if (!["package", "addon", "vehicle", "pickup"].includes(data.itemType))
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

    // The booking engine computes customer-facing totals from this Postgres
    // table, so update it before mirroring the value to Supabase.
    const updated = await query<{ item_id: string }>(
      `UPDATE public.service_prices
          SET amount = $1
        WHERE item_type = $2 AND item_id = $3
        RETURNING item_id`,
      [data.amount, data.itemType, data.itemId],
    );
    if (updated.length === 0) throw new Error("Preiseintrag nicht gefunden");

    const { error } = await context.supabase
      .from("service_prices")
      .update({ amount: data.amount })
      .eq("item_type", data.itemType)
      .eq("item_id", data.itemId);
    if (error) {
      throw new Error(
        `Preis wurde im Buchungssystem aktualisiert, aber die Synchronisation mit Supabase ist fehlgeschlagen: ${error.message}`,
      );
    }

    // Cache leeren, damit die Änderung sofort auf allen Seiten sichtbar wird.
    const { invalidateServicePriceCache } = await import("@/lib/pricing.server");
    invalidateServicePriceCache();

    return { ok: true };
  });
