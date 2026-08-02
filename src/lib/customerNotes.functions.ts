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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Alle Kundennotizen als Map (E-Mail → Text) — auf einmal geladen, damit die
 * Kundenliste nicht pro Kunde eine eigene Anfrage braucht. */
export const listCustomerNotes = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("customer_notes")
      .select("customer_email, note, updated_at");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveCustomerNote = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { email: string; note: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const email = normalizeEmail(data.email);
    const note = data.note.trim();

    // Leere Notiz löscht den Eintrag statt eine leere Zeile zu behalten.
    if (!note) {
      const { error } = await context.supabase
        .from("customer_notes")
        .delete()
        .eq("customer_email", email);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const { error } = await context.supabase
      .from("customer_notes")
      .upsert(
        { customer_email: email, note, updated_by: context.userId },
        { onConflict: "customer_email" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
