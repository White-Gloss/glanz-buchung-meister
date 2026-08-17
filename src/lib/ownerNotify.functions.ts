import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { NotifyChannel, OwnerNotifyStatus } from "./ownerNotify.server";

/**
 * ZUGANG ZUR SOFORTBENACHRICHTIGUNG
 * ----------------------------------
 * Nur für Administratoren. Der Test verschickt eine echte Nachricht; ein
 * offener Endpunkt wäre eine Einladung, das Handy des Betriebs zuzumüllen —
 * und bei WhatsApp auch, Kosten zu verursachen.
 *
 * Zugangsdaten werden nie zurückgegeben, auch nicht gekürzt. Sichtbar ist
 * nur, OB ein Weg eingerichtet ist.
 */

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Administrator-Zugriff");
}

export type { OwnerNotifyStatus, NotifyChannel };

export const getOwnerNotifyStatus = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerNotifyStatus> => {
    await assertAdmin(context);
    const { ownerNotifyStatus } = await import("./ownerNotify.server");
    return ownerNotifyStatus();
  });

export const sendNotifyTest = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { channel: NotifyChannel }) => data)
  .handler(async ({ data, context }): Promise<{ sent: boolean; reason?: string }> => {
    await assertAdmin(context);

    if (data.channel === "telegram") {
      const { sendTelegramSelfTest } = await import("./telegram.server");
      return sendTelegramSelfTest();
    }
    if (data.channel === "whatsapp") {
      const { sendWhatsAppSelfTest } = await import("./whatsapp.server");
      return sendWhatsAppSelfTest();
    }
    throw new Error("Unbekannter Benachrichtigungsweg.");
  });
