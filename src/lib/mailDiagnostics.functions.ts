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
 * verifizierung bei Resend. Bleibt eine Mail aus, steht die Ursache
 * ausschließlich im Server-Protokoll — an das man ohne Zugang zum Hosting
 * nicht herankommt.
 *
 * Diese beiden Funktionen machen den Zustand im Admin-Bereich sichtbar:
 * ist der Versand überhaupt eingerichtet, und kommt eine echte Mail an.
 *
 * BEWUSSTE EINSCHRÄNKUNG: Die Testmail geht immer an die Adresse des
 * angemeldeten Administrators aus dem Token — nie an eine frei
 * übergebene Adresse. Sonst wäre der Endpunkt ein Versandweg für
 * beliebige Nachrichten an beliebige Empfänger.
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
  /** RESEND_API_KEY und MAIL_FROM sind beide gesetzt */
  configured: boolean;
  apiKeySet: boolean;
  /** Absenderzeile — kein Geheimnis, steht in jeder versendeten Mail */
  from: string | null;
  /** Zieladresse der internen Benachrichtigung */
  ownerTo: string | null;
  /** Adresse, an die eine Testmail ginge */
  testTo: string | null;
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
      testTo: typeof context.claims.email === "string" ? context.claims.email : null,
    };
  });

export const sendMailSelfTest = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ sent: boolean; to: string; reason?: string }> => {
    await assertAdmin(context);

    const to = typeof context.claims.email === "string" ? context.claims.email : "";
    if (!to) {
      throw new Error("Für dieses Konto ist keine E-Mail-Adresse hinterlegt.");
    }

    const { sendMailSelfTestTo } = await import("./email.server");
    const result = await sendMailSelfTestTo(to);
    return { sent: result.sent, to, reason: result.reason };
  });
