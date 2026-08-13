import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { InboxMessage } from "./inbox.server";

/**
 * ZUGANG ZUM POSTEINGANG
 * -----------------------
 * Ausschließlich für Administratoren. Hier liegt fremde Korrespondenz — ein
 * offener Endpunkt wäre gleichbedeutend damit, das Firmenpostfach ins Netz zu
 * stellen.
 *
 * Die Zugangsdaten werden nie zurückgegeben, auch nicht gekürzt. Sichtbar sind
 * nur Server und Postfachname; beide stehen ohnehin in jeder Mail-Kopfzeile.
 */

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Administrator-Zugriff");
}

/** Übersetzt technische Fehler in etwas, mit dem man weiterkommt. */
function lesbarerFehler(error: unknown): Error {
  const text = error instanceof Error ? error.message : String(error);

  if (/auth|login|credential|invalid/i.test(text)) {
    return new Error(
      "Anmeldung am Postfach fehlgeschlagen. Bitte Postfachname und Passwort auf dem Server prüfen.",
    );
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(text)) {
    return new Error("Der Mailserver ist unter diesem Namen nicht erreichbar. IMAP_HOST prüfen.");
  }
  if (/timeout|ETIMEDOUT|ECONNREFUSED/i.test(text)) {
    return new Error(
      "Keine Verbindung zum Mailserver. Meist ist der Port falsch (IONOS: 993) oder eine Firewall blockiert ihn.",
    );
  }
  return new Error(`Der Posteingang konnte nicht geladen werden: ${text}`);
}

export type InboxStatus = { configured: boolean; host: string | null; user: string | null };

export const getInboxStatus = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<InboxStatus> => {
    await assertAdmin(context);
    const { inboxSettingsSummary } = await import("./inbox.server");
    return inboxSettingsSummary();
  });

export const listInboxMessages = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { limit?: number }) => data)
  .handler(async ({ data, context }): Promise<InboxMessage[]> => {
    await assertAdmin(context);
    const { listInbox } = await import("./inbox.server");
    try {
      return await listInbox(data?.limit ?? 25);
    } catch (error) {
      throw lesbarerFehler(error);
    }
  });

export const testInboxConnection = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ messages: number }> => {
    await assertAdmin(context);
    const { testInbox } = await import("./inbox.server");
    try {
      const ergebnis = await testInbox();
      return { messages: ergebnis.messages };
    } catch (error) {
      throw lesbarerFehler(error);
    }
  });
