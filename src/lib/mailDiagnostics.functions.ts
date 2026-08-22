import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * DIAGNOSE DES E-MAIL-VERSANDS
 * ----------------------------
 * Ob der Versand tatsächlich funktioniert, entscheidet sich außerhalb des
 * Codes: an den Umgebungsvariablen beim Hoster und an der Domain-
 * verifizierung bei Resend.
 *
 * Der Testempfänger kommt bewusst aus MAIL_TO_OWNER und damit ausschließlich
 * aus der serverseitigen Konfiguration. So hängt der Test nicht von einer
 * möglicherweise veralteten Login-Adresse des Admin-Kontos ab und bleibt
 * trotzdem gegen frei wählbare Empfänger abgesichert.
 */

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Administrator-Zugriff");
}

export type MailSetupStatus = {
  configured: boolean;
  apiKeySet: boolean;
  from: string | null;
  ownerTo: string | null;
  testTo: string | null;
  selfAddressed: boolean;
};

export const getMailSetupStatus = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<MailSetupStatus> => {
    await assertAdmin(context);
    const { mailConfigured, mailSettingsSummary } = await import("./email.server");
    const summary = mailSettingsSummary();
    return {
      configured: mailConfigured(),
      apiKeySet: summary.apiKeySet,
      from: summary.from,
      ownerTo: summary.ownerTo,
      testTo: summary.ownerTo,
      selfAddressed: summary.selfAddressed,
    };
  });

export const sendMailSelfTest = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ sent: boolean; to: string; reason?: string }> => {
    await assertAdmin(context);

    const { mailSettingsSummary, sendMailSelfTestTo } = await import("./email.server");
    const to = mailSettingsSummary().ownerTo ?? "";
    if (!to) {
      throw new Error("MAIL_TO_OWNER ist nicht konfiguriert.");
    }

    const result = await sendMailSelfTestTo(to);
    return { sent: result.sent, to, reason: result.reason };
  });
