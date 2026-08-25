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
  /**
   * Wann der Automations-Endpunkt zuletzt gelaufen ist, oder `null`, wenn es
   * dafür noch kein Lebenszeichen gibt. `null` bedeutet ausdrücklich NICHT
   * „funktioniert nicht": Es kann auch heißen, dass die Migration noch nicht
   * eingespielt ist oder seit deren Einspielen noch kein Lauf stattfand.
   */
  letzterLauf: string | null;
  /** Zähler des letzten Laufs, unverändert wie hinterlegt. */
  letzterLaufDetail: string | null;
};

/**
 * Liefert ausschließlich ungefährliche Ja/Nein-Informationen zu Server-Secrets.
 * Die eigentlichen Schlüssel verlassen den Server niemals.
 */
export const getAutomationSetupStatus = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<AutomationSetupStatus> => {
    await assertAdmin(context);

    // Das Lebenszeichen ist eine Zusatzangabe. Fehlt die Tabelle, bleibt der
    // übrige Status trotzdem stehen — eine fehlende Diagnose ist kein
    // Betriebsfehler.
    let letzterLauf: string | null = null;
    let letzterLaufDetail: string | null = null;
    try {
      const { queryOne } = await import("./db.server");
      const row = await queryOne<{ last_run_at: string; detail: string | null }>(
        `SELECT last_run_at, detail FROM public.automation_heartbeat WHERE area = $1`,
        ["automation-cron"],
      );
      if (row) {
        letzterLauf = String(row.last_run_at);
        letzterLaufDetail = row.detail;
      }
    } catch {
      // Absicht: siehe oben.
    }

    return {
      lexwareApiKeySet: Boolean(process.env.LEXWARE_API_KEY?.trim()),
      reminderCronSecretSet: Boolean(process.env.REMINDER_CRON_SECRET?.trim()),
      letzterLauf,
      letzterLaufDetail,
    };
  });

/* ------------------------------------------------------------------ */
/* Störungsprotokoll                                                   */
/* ------------------------------------------------------------------ */

export type SystemEvent = {
  id: string;
  occurredAt: string;
  area: string;
  event: string;
  severity: "fehler" | "hinweis";
  context: string | null;
  error: string | null;
};

/**
 * Die jüngsten Störungen, damit der Betrieb sie sieht, ohne sich auf den
 * Server zu verbinden.
 *
 * Die Einträge sind bereits beim Schreiben redigiert (siehe `serverLog.ts`);
 * hier steht nichts Personenbezogenes mehr. Fehlt die Tabelle — etwa weil
 * die Migration noch nicht eingespielt ist — kommt eine leere Liste mit
 * einem Hinweis zurück statt einer Fehlermeldung, denn eine fehlende
 * Diagnose ist kein Betriebsfehler.
 */
export const listSystemEvents = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ verfuegbar: boolean; events: SystemEvent[] }> => {
    await assertAdmin(context);

    try {
      const { query } = await import("./db.server");
      const rows = await query<{
        id: string | number;
        occurred_at: string;
        area: string;
        event: string;
        severity: string;
        context: string | null;
        error: string | null;
      }>(
        `SELECT id, occurred_at, area, event, severity, context, error
           FROM public.system_events
          ORDER BY occurred_at DESC
          LIMIT 100`,
      );

      return {
        verfuegbar: true,
        events: rows.map((row) => ({
          id: String(row.id),
          occurredAt: String(row.occurred_at),
          area: row.area,
          event: row.event,
          severity: row.severity === "hinweis" ? "hinweis" : "fehler",
          context: row.context,
          error: row.error,
        })),
      };
    } catch {
      return { verfuegbar: false, events: [] };
    }
  });
