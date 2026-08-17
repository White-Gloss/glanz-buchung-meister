import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * ZUGANG ZUR WHATSAPP-ANBINDUNG
 * ------------------------------
 * Nur für Administratoren. Der Test verschickt eine echte Nachricht und
 * kostet je nach Meta-Tarif Geld; ein offener Endpunkt wäre ein
 * Einladungsschreiben zum Missbrauch.
 *
 * Das Zugangstoken wird nie zurückgegeben — auch nicht gekürzt. Sichtbar ist
 * nur, OB es gesetzt ist.
 */

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Administrator-Zugriff");
}

export type WhatsAppStatus = {
  configured: boolean;
  to: string | null;
  templateSet: boolean;
};

export const getWhatsAppStatus = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsAppStatus> => {
    await assertAdmin(context);
    const { whatsappSettingsSummary } = await import("./whatsapp.server");
    return whatsappSettingsSummary();
  });

export const sendWhatsAppTest = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ sent: boolean; reason?: string }> => {
    await assertAdmin(context);
    const { sendWhatsAppSelfTest } = await import("./whatsapp.server");
    return sendWhatsAppSelfTest();
  });
