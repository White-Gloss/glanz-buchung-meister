import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * Kalender-Feed-Token verwalten.
 *
 * Bewusst über den normalen Supabase-Client (nicht den direkten Postgres-
 * Pool) — hier gibt es keinen Grund, RLS zu umgehen: Die Policies in
 * `calendar_feed_tokens` regeln bereits exakt "nur der eigene Admin sieht
 * seinen eigenen Token".
 */

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Administrator-Zugriff");
}

/** Liefert den bestehenden Token oder legt beim ersten Aufruf einen neuen an. */
export const getCalendarFeedToken = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const existing = await context.supabase
      .from("calendar_feed_tokens")
      .select("token")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) return { token: existing.data.token as string };

    const created = await context.supabase
      .from("calendar_feed_tokens")
      .insert({ user_id: context.userId })
      .select("token")
      .single();
    if (created.error) throw new Error(created.error.message);
    return { token: created.data.token as string };
  });

/** Erzeugt einen neuen Token und macht die bisherige Adresse ungültig. */
export const regenerateCalendarFeedToken = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const result = await context.supabase
      .from("calendar_feed_tokens")
      .update({ token: crypto.randomUUID() })
      .eq("user_id", context.userId)
      .select("token")
      .single();
    if (result.error) throw new Error(result.error.message);
    return { token: result.data.token as string };
  });
