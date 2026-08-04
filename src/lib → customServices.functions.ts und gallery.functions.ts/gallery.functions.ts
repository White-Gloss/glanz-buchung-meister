import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  return `${url}/storage/v1/object/public/gallery/${storagePath}`;
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

    const bytes = Buffer.from(data.base64Data, "base64");
    if (bytes.byteLength > 8 * 1024 * 1024) {
      throw new Error("Datei ist größer als 8 MB.");
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
      title: data.title.trim(),
      vehicle: data.vehicle.trim(),
      service_slug: data.serviceSlug,
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
    const { error } = await context.supabase
      .from("gallery_items")
      .update({
        title: data.title.trim(),
        vehicle: data.vehicle.trim(),
        service_slug: data.serviceSlug,
        is_published: data.isPublished,
        sort_order: data.sortOrder,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGalleryItem = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string; storagePath: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Erst die Datenbankzeile, dann die Datei — bei einem Fehlschlag der
    // Zeile bleibt die Datei erhalten statt eine Zeile ohne Datei zu haben.
    const { error: dbError } = await context.supabase
      .from("gallery_items")
      .delete()
      .eq("id", data.id);
    if (dbError) throw new Error(dbError.message);

    await context.supabase.storage.from("gallery").remove([data.storagePath]);
    return { ok: true };
  });
