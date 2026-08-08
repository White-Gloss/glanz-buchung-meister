import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createSupabasePublishableFetch } from "@/integrations/supabase/publishable-key-fetch";
import type { Database } from "@/integrations/supabase/types";
import { query, queryOne } from "@/lib/db.server";

/**
 * ZUSTANDSMELDUNGEN
 * ------------------
 * Interessenten können Fotos und kurze Videos ihres Fahrzeugs hochladen und
 * den Zustand bzw. ihr gewünschtes Ergebnis beschreiben. Alle Medien liegen
 * in einem privaten Supabase-Storage-Bucket und werden im Admin-Bereich nur
 * über kurzlebige signierte Links angezeigt.
 */

export const CONDITION_PHOTO_BUCKET = "condition-photos";

export const CONDITION_STATUSES = ["Neu", "Gesehen", "Beantwortet", "Erledigt"] as const;
export type ConditionStatus = (typeof CONDITION_STATUSES)[number];

export type ConditionReport = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  vehicle: string;
  plate: string;
  condition_text: string;
  /** Historischer Spaltenname: enthält inzwischen Fotos UND Videos. */
  photo_paths: string[];
  status: ConditionStatus;
  admin_note: string;
  created_at: string;
  updated_at: string;
  booking_id: string | null;
  invoice_number: string | null;
};

const SELECT_COLS = `r.id, r.customer_name, r.customer_email, r.customer_phone, r.vehicle,
  r.plate, r.condition_text, r.photo_paths, r.status, r.admin_note, r.created_at,
  r.updated_at, r.booking_id, b.invoice_number`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Maximal acht Aufnahmen je Meldung; entspricht dem bestehenden DB-Constraint. */
export const MAX_PHOTOS = 8;
/** Nach lokaler Optimierung werden höchstens 12 MB pro Medium angenommen. */
export const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
/** Rückwärtskompatibler Export für ältere Imports. */
export const MAX_IMAGE_BYTES = MAX_MEDIA_BYTES;
const MAX_BASE64_LENGTH = Math.ceil(MAX_MEDIA_BYTES / 3) * 4 + 16;

const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

/** Storage-Pfad: <uuid>/<zeit>-<zufall>.<ext> */
const STORAGE_PATH_PATTERN =
  /^[0-9a-f-]{36}\/\d+-\d+\.(jpg|jpeg|png|webp|mp4|mov|webm)$/i;

function normalizeText(value: string, label: string, maxLength: number, required = false): string {
  const normalized = String(value ?? "").trim();
  if (required && !normalized) throw new Error(`${label} ist ein Pflichtfeld.`);
  if (normalized.length > maxLength) {
    throw new Error(`${label} darf höchstens ${maxLength} Zeichen enthalten.`);
  }
  return normalized;
}

function normalizeEmail(value: string): string {
  const email = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!email) throw new Error("E-Mail-Adresse ist ein Pflichtfeld.");
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("Bitte geben Sie eine gültige E-Mail-Adresse an.");
  }
  return email;
}

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Administrator-Zugriff");
}

function isIsoBaseMedia(bytes: Buffer): boolean {
  return bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp";
}

function hasValidMediaSignature(bytes: Buffer, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (contentType === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  if (contentType === "video/webm") {
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    );
  }
  if (contentType === "video/mp4" || contentType === "video/quicktime") {
    return isIsoBaseMedia(bytes);
  }
  return false;
}

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    case "video/quicktime":
      return "mov";
    default:
      return "jpg";
  }
}

// =====================================================================
// Öffentlich: Medien hochladen und Meldung einsenden
// =====================================================================

/**
 * Einzelnes Foto/Video in den privaten Storage laden.
 *
 * Der Browser verkleinert große Aufnahmen bereits vor diesem Aufruf. Der
 * Server prüft trotzdem Typ, Dateigröße und echte Dateisignatur, damit die
 * öffentliche Upload-Funktion nicht für beliebige Dateien missbraucht wird.
 */
export const uploadConditionPhoto = createServerFn({ method: "POST" })
  .validator((data: { fileName: string; contentType: string; base64Data: string }) => data)
  .handler(async ({ data }) => {
    if (!ALLOWED_MEDIA_TYPES.has(data.contentType)) {
      throw new Error("Unterstützt werden JPEG, PNG, WebP sowie MP4, MOV und WebM.");
    }
    if (!data.base64Data || data.base64Data.length > MAX_BASE64_LENGTH) {
      throw new Error("Die Datei ist leer oder nach der Optimierung noch zu groß.");
    }

    const bytes = Buffer.from(data.base64Data, "base64");
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_MEDIA_BYTES) {
      throw new Error("Die Datei ist nach der Optimierung noch größer als 12 MB.");
    }
    if (!hasValidMediaSignature(bytes, data.contentType)) {
      throw new Error("Die Datei stimmt nicht mit dem angegebenen Foto-/Videoformat überein.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Der Upload ist derzeit nicht verfügbar.");

    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: createSupabasePublishableFetch(key) },
    });

    const ext = extensionForContentType(data.contentType);
    const path = `${crypto.randomUUID()}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;

    const { error } = await client.storage
      .from(CONDITION_PHOTO_BUCKET)
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (error) throw new Error("Die Aufnahme konnte nicht hochgeladen werden.");

    return { ok: true, path };
  });

export type ConditionReportInput = {
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  plate: string;
  conditionText: string;
  /** Historischer Feldname; enthält Fotos und Videos. */
  photoPaths: string[];
  bookingId?: string | null;
};

export const submitConditionReport = createServerFn({ method: "POST" })
  .validator((data: ConditionReportInput) => data)
  .handler(async ({ data }) => {
    const name = normalizeText(data.name, "Name", 120, true);
    const email = normalizeEmail(data.email);
    const phone = normalizeText(data.phone, "Telefonnummer", 40);
    const vehicle = normalizeText(data.vehicle, "Fahrzeug", 120);
    const plate = normalizeText(data.plate, "Kennzeichen", 20);
    const conditionText = normalizeText(data.conditionText, "Zustandsbeschreibung", 4000);
    const photoPaths = [...new Set(Array.isArray(data.photoPaths) ? data.photoPaths : [])];

    // Einzelne Felder dürfen optional sein; die Meldung selbst braucht aber
    // mindestens eine Aufnahme oder einen aussagekräftigen Text.
    if (photoPaths.length === 0) {
      if (!conditionText) {
        throw new Error("Bitte beschreiben Sie kurz Ihr Anliegen oder laden Sie ein Foto/Video hoch.");
      }
      if (conditionText.length < 20) {
        throw new Error(
          "Bitte beschreiben Sie Ihr Anliegen etwas ausführlicher (mindestens 20 Zeichen).",
        );
      }
    }
    if (photoPaths.length > MAX_PHOTOS) {
      throw new Error(`Es sind höchstens ${MAX_PHOTOS} Fotos/Videos möglich.`);
    }
    if (photoPaths.some((path) => !STORAGE_PATH_PATTERN.test(path))) {
      throw new Error("Mindestens eine Aufnahme konnte nicht zugeordnet werden.");
    }

    const bookingId = data.bookingId && UUID_PATTERN.test(data.bookingId) ? data.bookingId : null;

    const row = await queryOne<{ id: string }>(
      `INSERT INTO public.condition_reports
         (customer_name, customer_email, customer_phone, vehicle, plate, condition_text,
          photo_paths, booking_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [name, email, phone, vehicle, plate, conditionText, photoPaths, bookingId],
    );
    if (!row) throw new Error("Die Meldung konnte nicht gespeichert werden.");

    try {
      const { sendConditionReportNotification, mailConfigured } = await import("./email.server");
      if (mailConfigured()) {
        const result = await sendConditionReportNotification({
          name,
          email,
          phone,
          vehicle,
          plate,
          conditionText,
          photoCount: photoPaths.length,
        });
        if (!result.sent) {
          console.error(`[mail] Zustandsmeldung nicht zugestellt: ${result.reason}`);
        }
      } else {
        console.warn(
          "[mail] Versand nicht konfiguriert — keine Benachrichtigung zur Zustandsmeldung verschickt.",
        );
      }
    } catch (error) {
      console.error("[mail] Benachrichtigung zur Zustandsmeldung fehlgeschlagen", error);
    }

    return { ok: true, id: row.id };
  });

// =====================================================================
// Admin
// =====================================================================

export const listConditionReports = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConditionReport[]> => {
    await assertAdmin(context);
    return query<ConditionReport>(
      `SELECT ${SELECT_COLS}
         FROM public.condition_reports r
         LEFT JOIN public.bookings b ON b.id = r.booking_id
        ORDER BY r.created_at DESC`,
    );
  });

/** Kurzlebige signierte Links für private Fotos und Videos. */
export const getConditionPhotoUrls = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }): Promise<string[]> => {
    await assertAdmin(context);
    if (!UUID_PATTERN.test(data.id)) throw new Error("Ungültige Meldungs-ID.");

    const report = await queryOne<{ photo_paths: string[] }>(
      `SELECT photo_paths FROM public.condition_reports WHERE id = $1`,
      [data.id],
    );
    if (!report) throw new Error("Die Meldung wurde nicht gefunden.");
    if (report.photo_paths.length === 0) return [];

    const { data: signed, error } = await context.supabase.storage
      .from(CONDITION_PHOTO_BUCKET)
      .createSignedUrls(report.photo_paths, 3600);
    if (error) throw new Error(error.message);

    return (signed ?? [])
      .map((entry) => entry.signedUrl)
      .filter((url): url is string => Boolean(url));
  });

export const updateConditionReport = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string; status: ConditionStatus; adminNote: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!UUID_PATTERN.test(data.id)) throw new Error("Ungültige Meldungs-ID.");
    if (!CONDITION_STATUSES.includes(data.status)) {
      throw new Error("Ungültiger Status.");
    }
    const adminNote = normalizeText(data.adminNote, "Notiz", 2000);

    const row = await queryOne<{ id: string }>(
      `UPDATE public.condition_reports SET status = $2, admin_note = $3
       WHERE id = $1 RETURNING id`,
      [data.id, data.status, adminNote],
    );
    if (!row) throw new Error("Die Meldung wurde nicht gefunden oder bereits gelöscht.");
    return { ok: true };
  });

/** Meldung löschen — inklusive aller zugehörigen Foto-/Videodateien. */
export const deleteConditionReport = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!UUID_PATTERN.test(data.id)) throw new Error("Ungültige Meldungs-ID.");

    const report = await queryOne<{ photo_paths: string[] }>(
      `SELECT photo_paths FROM public.condition_reports WHERE id = $1`,
      [data.id],
    );
    if (!report) throw new Error("Die Meldung wurde nicht gefunden oder bereits gelöscht.");

    let storageWarning: string | null = null;
    if (report.photo_paths.length > 0) {
      const { error } = await context.supabase.storage
        .from(CONDITION_PHOTO_BUCKET)
        .remove(report.photo_paths);
      storageWarning = error?.message ?? null;
    }

    const deleted = await queryOne<{ id: string }>(
      `DELETE FROM public.condition_reports WHERE id = $1 RETURNING id`,
      [data.id],
    );
    if (!deleted) throw new Error("Die Meldung wurde nicht gefunden oder bereits gelöscht.");

    return { ok: true, storageWarning };
  });
