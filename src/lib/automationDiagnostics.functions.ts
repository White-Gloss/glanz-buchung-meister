import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Administrator-Zugriff");
}

export type AutomationSetupStatus = {
  lexwareApiKeySet: boolean;
  reminderCronSecretSet: boolean;
};

/**
 * Liefert ausschließlich ungefährliche Ja/Nein-Informationen zu Server-Secrets.
 * Die eigentlichen Schlüssel verlassen den Server niemals.
 */
export const getAutomationSetupStatus = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<AutomationSetupStatus> => {
    await assertAdmin(context);

    return {
      lexwareApiKeySet: Boolean(process.env.LEXWARE_API_KEY?.trim()),
      reminderCronSecretSet: Boolean(process.env.REMINDER_CRON_SECRET?.trim()),
    };
  });
