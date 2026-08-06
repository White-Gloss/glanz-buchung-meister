import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createSupabasePublishableFetch } from "@/integrations/supabase/publishable-key-fetch";
import type { Database } from "@/integrations/supabase/types";

/**
 * SEO-FAQs
 * ---------
 * Frage/Antwort-Paare, die auf /faq erscheinen und zusätzlich unter
 * einzelnen Ratgeber-Beiträgen ausgespielt werden können (Verknüpfung in
 * blog.functions.ts). Die Website erzeugt daraus automatisch eine
 * FAQPage-Auszeichnung für Googles Rich Results.
 *
 * Schreibrechte liegen ausschließlich bei Admins — durchgesetzt doppelt:
 * hier über assertAdmin und in der Datenbank über die RLS-Policies.
 */

export type FaqRow = {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  is_published: boolean;
  created_at: string;
};

const PUBLIC_COLUMNS = "id, question, answer, category, sort_order, is_published, created_at";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Googles FAQ-Richtlinien verlangen vollständige, eigenständig
 * verständliche Antworten. Sehr kurze Antworten lösen in der Search
 * Console eine Warnung aus, deshalb die Untergrenze.
 */
const MIN_ANSWER_LENGTH = 20;
const MAX_QUESTION_LENGTH = 300;
const MAX_ANSWER_LENGTH = 2000;
const MAX_CATEGORY_LENGTH = 80;

function normalizeText(value: string, label: string, maxLength: number, required = false): string {
  const normalized = String(value ?? "").trim();
  if (required && !normalized) throw new Error(`${label} ist ein Pflichtfeld.`);
  if (normalized.length > maxLength) {
    throw new Error(`${label} darf höchstens ${maxLength} Zeichen enthalten.`);
  }
  return normalized;
}

export type FaqInput = {
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
};

function normalizeFaqInput(data: FaqInput) {
  const question = normalizeText(data.question, "Frage", MAX_QUESTION_LENGTH, true);
  const answer = normalizeText(data.answer, "Antwort", MAX_ANSWER_LENGTH, true);

  if (answer.length < MIN_ANSWER_LENGTH) {
    throw new Error(
      `Die Antwort ist zu kurz (mindestens ${MIN_ANSWER_LENGTH} Zeichen). Google zeigt unvollständige Antworten nicht als Rich Result an.`,
    );
  }

  const sortOrder = Number(data.sortOrder ?? 0);
  if (!Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 10_000) {
    throw new Error("Die Reihenfolge ist ungültig.");
  }

  return {
    question,
    answer,
    category: normalizeText(data.category, "Kategorie", MAX_CATEGORY_LENGTH),
    sort_order: sortOrder,
    is_published: Boolean(data.isPublished),
  };
}

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Administrator-Zugriff");
}

/**
 * Öffentlich sichtbare FAQs — für die Website selbst.
 *
 * Nutzt bewusst den anonymen Schlüssel statt einer Admin-Sitzung: die
 * Antwort ist für alle Besucher identisch und darf zwischengespeichert
 * werden. Fehler bleiben ohne Folgen (leere Liste statt Fehlerseite).
 */
export const listPublishedFaqs = createServerFn({ method: "GET" }).handler(
  async (): Promise<FaqRow[]> => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return [];

    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: createSupabasePublishableFetch(key) },
    });
    const { data, error } = await client
      .from("faqs")
      .select(PUBLIC_COLUMNS)
      .eq("is_published", true)
      .order("sort_order")
      .order("created_at");
    if (error) return [];
    return data ?? [];
  },
);

/** Alle FAQs inkl. unveröffentlichter Entwürfe — nur Admin. */
export const listAllFaqs = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<FaqRow[]> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("faqs")
      .select(PUBLIC_COLUMNS)
      .order("sort_order")
      .order("created_at");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createFaq = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: FaqInput) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const normalized = normalizeFaqInput(data);

    const { data: created, error } = await context.supabase
      .from("faqs")
      .insert({ ...normalized, created_by: context.userId })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: created?.id ?? null };
  });

export const updateFaq = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string } & FaqInput) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!UUID_PATTERN.test(data.id)) throw new Error("Ungültige FAQ-ID.");
    const normalized = normalizeFaqInput(data);

    const { data: updated, error } = await context.supabase
      .from("faqs")
      .update(normalized)
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Die FAQ wurde nicht gefunden oder bereits gelöscht.");
    return { ok: true };
  });

/**
 * Löschen entfernt über ON DELETE CASCADE automatisch alle Zuordnungen
 * zu Ratgeber-Beiträgen — es bleibt keine tote Referenz zurück.
 */
export const deleteFaq = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!UUID_PATTERN.test(data.id)) throw new Error("Ungültige FAQ-ID.");

    const { data: deleted, error } = await context.supabase
      .from("faqs")
      .delete()
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) throw new Error("Die FAQ wurde nicht gefunden oder bereits gelöscht.");
    return { ok: true };
  });

/**
 * Neue Reihenfolge speichern. Der Client schickt die IDs in der
 * gewünschten Reihenfolge; die Position im Array wird zur sort_order.
 * Das ist robuster als einzelne "hoch/runter"-Aufrufe, weil nach jedem
 * Speichern ein widerspruchsfreier Zustand in der Datenbank steht.
 */
export const reorderFaqs = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { orderedIds: string[] }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const orderedIds = Array.isArray(data.orderedIds) ? data.orderedIds : [];
    if (orderedIds.length > 500) throw new Error("Zu viele Einträge auf einmal.");
    if (orderedIds.some((id) => !UUID_PATTERN.test(id))) {
      throw new Error("Ungültige FAQ-ID in der Reihenfolge.");
    }
    if (new Set(orderedIds).size !== orderedIds.length) {
      throw new Error("Die Reihenfolge enthält doppelte Einträge.");
    }

    // Einzelne Updates statt eines Upserts: der Upsert müsste alle
    // Pflichtspalten mitsenden und würde bei einer veralteten Client-Ansicht
    // Frage und Antwort überschreiben.
    for (const [index, id] of orderedIds.entries()) {
      const { error } = await context.supabase
        .from("faqs")
        .update({ sort_order: index })
        .eq("id", id);
      if (error) throw new Error(error.message);
    }

    return { ok: true, count: orderedIds.length };
  });
