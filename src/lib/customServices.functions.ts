import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { ServicePage } from "./servicePages";
import { servicePackages } from "./servicesConfig";

/**
 * EIGENE DIENSTLEISTUNGEN
 * ------------------------
 * Die 7 Kern-Leistungen (`servicePages.ts`) bleiben unverändert im Code, weil
 * für sie handgeschriebene Local-SEO-Texte je Entfernungsband existieren
 * (28 individuelle Absätze für die 91-Seiten-Städte-Matrix — siehe
 * `serviceCityPages.ts`). Diese Datei ergänzt zusätzliche, im Admin-Bereich
 * selbst angelegte Leistungen.
 *
 * WICHTIGER UNTERSCHIED: Eigene Leistungen bekommen EINE Detailseite unter
 * /leistungen/[slug], aber KEINE der 91 Stadt-Kombinationsseiten — dafür
 * fehlen die individuellen Entfernungstexte, und sie automatisch zu
 * generieren würde wieder zu Duplicate Content führen (das war genau das
 * Problem, das die Matrix ursprünglich lösen sollte).
 */

export type CustomServiceRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  eyebrow: string;
  lead: string;
  detail: string;
  benefits: string[];
  meta_title: string;
  meta_description: string;
  related_package_ids: string[];
  is_published: boolean;
  sort_order: number;
};

/** Wandelt eine DB-Zeile in dieselbe Form wie die fest hinterlegten Leistungen. */
export function toServicePage(row: CustomServiceRow): ServicePage {
  return {
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    eyebrow: row.eyebrow,
    title: row.name,
    metaTitle: row.meta_title || `${row.name} | White Gloss Detailing`,
    metaDescription: row.meta_description || row.lead,
    lead: row.lead,
    detail: row.detail,
    benefits: row.benefits,
    // Kein handgeschriebener Ablauf/FAQ für eigene Leistungen — die Seite
    // blendet diese Abschnitte aus, statt Platzhaltertext zu erfinden.
    process: [],
    faq: [],
    relatedPackageIds: row.related_package_ids,
  };
}

/** Öffentliche, veröffentlichte eigene Leistungen — für die Website selbst. */
export const listPublishedCustomServices = createServerFn({ method: "GET" }).handler(
  async (): Promise<CustomServiceRow[]> => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return [];

    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client
      .from("custom_services")
      .select(
        "id, slug, name, short_name, eyebrow, lead, detail, benefits, meta_title, meta_description, related_package_ids, is_published, sort_order",
      )
      .eq("is_published", true)
      .order("sort_order")
      .order("created_at");
    if (error) return [];
    return data ?? [];
  },
);

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Administrator-Zugriff");
}

/** Alle eigenen Leistungen inkl. unveröffentlichter Entwürfe — nur Admin. */
export const listAllCustomServices = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<CustomServiceRow[]> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("custom_services")
      .select("*")
      .order("sort_order")
      .order("created_at");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export type CustomServiceInput = {
  slug: string;
  name: string;
  shortName: string;
  eyebrow: string;
  lead: string;
  detail: string;
  benefits: string[];
  metaTitle: string;
  metaDescription: string;
  relatedPackageIds: string[];
  isPublished: boolean;
};

const RESERVED_SLUGS = new Set([
  "innenraumreinigung",
  "lackkorrektur",
  "keramikversiegelung",
  "lederpflege",
  "fahrzeugaufbereitung",
  "smart-repair",
  "leasingrueckgabe",
]);

const VALID_PACKAGE_IDS = new Set(servicePackages.map((servicePackage) => servicePackage.id));
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeText(value: string, label: string, maxLength: number, required = false): string {
  const normalized = String(value ?? "").trim();
  if (required && !normalized) throw new Error(`${label} ist ein Pflichtfeld.`);
  if (normalized.length > maxLength) {
    throw new Error(`${label} darf höchstens ${maxLength} Zeichen enthalten.`);
  }
  return normalized;
}

function normalizeCustomServiceInput(data: CustomServiceInput): CustomServiceInput {
  const slug = String(data.slug ?? "")
    .trim()
    .toLowerCase();
  if (RESERVED_SLUGS.has(slug)) {
    throw new Error(`„${slug}“ ist bereits eine der festen Kern-Leistungen.`);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 60) {
    throw new Error(
      "Die URL-Kurzform darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten (3–60 Zeichen).",
    );
  }

  const name = normalizeText(data.name, "Name", 100, true);
  const lead = normalizeText(data.lead, "Kurzbeschreibung", 320, true);
  const benefits = (Array.isArray(data.benefits) ? data.benefits : [])
    .map((benefit) => normalizeText(benefit, "Vorteil", 180))
    .filter(Boolean);
  if (benefits.length > 4) throw new Error("Es sind höchstens vier Vorteile möglich.");

  const relatedPackageIds = [
    ...new Set(Array.isArray(data.relatedPackageIds) ? data.relatedPackageIds : []),
  ];
  if (relatedPackageIds.some((id) => !VALID_PACKAGE_IDS.has(id))) {
    throw new Error("Mindestens ein ausgewähltes Paket ist ungültig.");
  }

  return {
    slug,
    name,
    shortName: normalizeText(data.shortName, "Kurzform", 80) || name,
    eyebrow: normalizeText(data.eyebrow, "Kategorie-Text", 120) || "Fahrzeugaufbereitung",
    lead,
    detail: normalizeText(data.detail, "Ausführlicher Text", 2500) || lead,
    benefits,
    metaTitle: normalizeText(data.metaTitle, "Meta-Titel", 70),
    metaDescription: normalizeText(data.metaDescription, "Meta-Beschreibung", 180),
    relatedPackageIds,
    isPublished: Boolean(data.isPublished),
  };
}

export const createCustomService = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: CustomServiceInput) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const normalized = normalizeCustomServiceInput(data);

    const { error } = await context.supabase.from("custom_services").insert({
      slug: normalized.slug,
      name: normalized.name,
      short_name: normalized.shortName,
      eyebrow: normalized.eyebrow,
      lead: normalized.lead,
      detail: normalized.detail,
      benefits: normalized.benefits,
      meta_title: normalized.metaTitle,
      meta_description: normalized.metaDescription,
      related_package_ids: normalized.relatedPackageIds,
      is_published: normalized.isPublished,
      created_by: context.userId,
    });
    if (error) {
      if (error.code === "23505") {
        throw new Error(`Die URL-Kurzform „${normalized.slug}“ ist bereits vergeben.`);
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const updateCustomService = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string } & CustomServiceInput) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!UUID_PATTERN.test(data.id)) throw new Error("Ungültige Leistungs-ID.");
    const normalized = normalizeCustomServiceInput(data);

    const { data: updated, error } = await context.supabase
      .from("custom_services")
      .update({
        slug: normalized.slug,
        name: normalized.name,
        short_name: normalized.shortName,
        eyebrow: normalized.eyebrow,
        lead: normalized.lead,
        detail: normalized.detail,
        benefits: normalized.benefits,
        meta_title: normalized.metaTitle,
        meta_description: normalized.metaDescription,
        related_package_ids: normalized.relatedPackageIds,
        is_published: normalized.isPublished,
      })
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") {
        throw new Error(`Die URL-Kurzform „${normalized.slug}“ ist bereits vergeben.`);
      }
      throw new Error(error.message);
    }
    if (!updated) throw new Error("Die Leistung wurde nicht gefunden oder bereits gelöscht.");
    return { ok: true };
  });

export const deleteCustomService = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!UUID_PATTERN.test(data.id)) throw new Error("Ungültige Leistungs-ID.");
    const { data: deleted, error } = await context.supabase
      .from("custom_services")
      .delete()
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) throw new Error("Die Leistung wurde nicht gefunden oder bereits gelöscht.");
    return { ok: true };
  });
