import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createSupabasePublishableFetch } from "@/integrations/supabase/publishable-key-fetch";
import type { Database } from "@/integrations/supabase/types";

/**
 * VORHER/NACHHER-GALERIE
 * -----------------------
 * Bilder liegen im öffentlichen Storage-Bucket "gallery" (jeder darf lesen,
 * nur Admins dürfen schreiben — siehe Migration). Diese Datei verwaltet nur
 * die Metadaten (Titel, Fahrzeug, Reihenfolge, Veröffentlichungsstatus) und
 * den eigentlichen Datei-Upload.
 */

export type GalleryItemRow = {
  id: string;
  storage_path: string;
  title: string;
  vehicle: string;
  service_slug: string | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 8;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeText(value: string, label: string, maxLength: number): string {
  const normalized = String(value ?? "").trim();
  if (normalized.length > maxLength) {
    throw new Error(`${label} darf höchstens ${maxLength} Zeichen enthalten.`);
  }
  return normalized;
}

function normalizeServiceSlug(value: string | null): string | null {
  if (!value) return null;
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60) {
    throw new Error("Die zugeordnete Leistung ist ungültig.");
  }
  return slug;
}

function hasValidImageSignature(bytes: Buffer, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  return (
    contentType === "image/webp" &&
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Administrator-Zugriff");
}

/** Öffentliche URL zu einem Bild im Bucket — reine URL-Bildung, kein Aufruf nötig. */
export function galleryPublicUrl(storagePath: string): string {
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    (typeof process !== "undefined" ? process.env?.SUPABASE_URL : undefined);
  if (!url) return "";
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/gallery/${storagePath}`;
}

/** Öffentlich sichtbare, veröffentlichte Bilder — für die Website selbst. */
export const listPublishedGalleryItems = createServerFn({ method: "GET" }).handler(
  async (): Promise<GalleryItemRow[]> => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return [];

    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: createSupabasePublishableFetch(key) },
    });
    const { data, error } = await client
      .from("gallery_items")
      .select(
        "id, storage_path, title, vehicle, service_slug, is_published, sort_order, created_at",
      )
      .eq("is_published", true)
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (error) return [];
    return data ?? [];
  },
);

/** Alle Bilder inkl. unveröffentlichter — nur Admin, für den Admin-Bereich. */
export const listAllGalleryItems = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<GalleryItemRow[]> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("gallery_items")
      .select("*")
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Bild hochladen. Die Datei kommt als Base64-Daten-URL an (kleinste
 * gemeinsame Form zwischen Browser-<input type="file"> und Server-Function —
 * TanStack-Server-Functions übertragen JSON, keine rohen Binärdaten).
 * 8 MB Limit greift zusätzlich serverseitig im Storage-Bucket selbst.
 */
export const uploadGalleryImage = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator(
    (data: {
      fileName: string;
      contentType: string;
      base64Data: string;
      title: string;
      vehicle: string;
      serviceSlug: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(data.contentType)) {
      throw new Error("Nur JPEG, PNG oder WebP werden unterstützt.");
    }
    if (!data.base64Data || data.base64Data.length > MAX_BASE64_LENGTH) {
      throw new Error("Datei ist leer oder größer als 8 MB.");
    }

    const bytes = Buffer.from(data.base64Data, "base64");
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("Datei ist größer als 8 MB.");
    }
    if (!hasValidImageSignature(bytes, data.contentType)) {
      throw new Error("Die Datei stimmt nicht mit dem angegebenen Bildformat überein.");
    }

    const ext = data.fileName.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    const path = `${context.userId}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${safeExt}`;

    const { error: uploadError } = await context.supabase.storage
      .from("gallery")
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { error: insertError } = await context.supabase.from("gallery_items").insert({
      storage_path: path,
      title: normalizeText(data.title, "Titel", 160),
      vehicle: normalizeText(data.vehicle, "Fahrzeug", 100),
      service_slug: normalizeServiceSlug(data.serviceSlug),
      created_by: context.userId,
    });
    if (insertError) {
      // Aufräumen: Datei nicht verwaist im Storage liegen lassen, wenn der
      // Metadaten-Eintrag scheitert.
      await context.supabase.storage.from("gallery").remove([path]);
      throw new Error(insertError.message);
    }

    return { ok: true, path };
  });

export const updateGalleryItem = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator(
    (data: {
      id: string;
      title: string;
      vehicle: string;
      serviceSlug: string | null;
      isPublished: boolean;
      sortOrder: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!UUID_PATTERN.test(data.id)) throw new Error("Ungültige Bild-ID.");
    if (!Number.isSafeInteger(data.sortOrder) || data.sortOrder < 0 || data.sortOrder > 10000) {
      throw new Error("Die Reihenfolge ist ungültig.");
    }
    const { data: updated, error } = await context.supabase
      .from("gallery_items")
      .update({
        title: normalizeText(data.title, "Titel", 160),
        vehicle: normalizeText(data.vehicle, "Fahrzeug", 100),
        service_slug: normalizeServiceSlug(data.serviceSlug),
        is_published: data.isPublished,
        sort_order: data.sortOrder,
      })
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Das Bild wurde nicht gefunden oder bereits gelöscht.");
    return { ok: true };
  });

export const deleteGalleryItem = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!UUID_PATTERN.test(data.id)) throw new Error("Ungültige Bild-ID.");

    // Den tatsächlichen Pfad serverseitig lesen. So kann ein manipulierter
    // Browser-Aufruf nicht die Datei eines anderen Galerie-Eintrags löschen.
    const { data: item, error: itemError } = await context.supabase
      .from("gallery_items")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (itemError) throw new Error(itemError.message);
    if (!item) throw new Error("Das Bild wurde nicht gefunden oder bereits gelöscht.");

    // Erst die Datenbankzeile, dann die Datei — bei einem Fehlschlag der
    // Zeile bleibt die Datei erhalten statt eine Zeile ohne Datei zu haben.
    const { data: deleted, error: dbError } = await context.supabase
      .from("gallery_items")
      .delete()
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (dbError) throw new Error(dbError.message);
    if (!deleted) throw new Error("Das Bild wurde nicht gefunden oder bereits gelöscht.");

    const { error: storageError } = await context.supabase.storage
      .from("gallery")
      .remove([item.storage_path]);
    return { ok: true, storageWarning: storageError?.message ?? null };
  });
