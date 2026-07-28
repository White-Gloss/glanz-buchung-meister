/**
 * Client-safe Prüfung, ob die Backend-Zugangsdaten im Build eingebettet wurden.
 * Verhindert einen weißen Bildschirm, wenn die Variablen fehlen.
 */
export type SupabaseConfigStatus = {
  ok: boolean;
  missing: string[];
};

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined);
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    (typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined);

  const missing = [
    ...(!url ? ["SUPABASE_URL"] : []),
    ...(!key ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
  ];

  return { ok: missing.length === 0, missing };
}

export function isSupabaseConfigError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("Missing Supabase environment variable");
}
