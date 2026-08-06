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
 * Interessenten laden vor der Buchung Fotos ihres Fahrzeugs hoch und
 * beschreiben den Zustand. Im Admin-Bereich lassen sich die Meldungen
 * ansehen und bearbeiten.
 *
 * ZWEI GETRENNTE WEGE, bewusst so gewählt:
 *
 *   Datenbank  Alle Lese- und Schreibzugriffe laufen über die direkte
 *              PostgreSQL-Verbindung (db.server.ts) — genau wie bei den
 *              Buchungen. Die Tabelle hat deshalb keine RLS-Policies und
 *              ist über die öffentliche REST-Schnittstelle unerreichbar.
 *
 *   Dateien    Fotos müssen über die Storage-API laufen. Der Bucket ist
 *              privat; hochladen darf jeder (Interessenten haben keinen
 *              Zugang), lesen und löschen nur Admins. Die Anzeige im
 *              Admin-Bereich erfolgt über kurzlebige signierte Links.
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
  photo_paths: string[];
  status: ConditionStatus;
  admin_note: string;
  created_at: string;
  updated_at: string;
  booking_id: string | null;
  /** Rechnungsnummer der zugehörigen Buchung, falls die Meldung aus dem
   *  Buchungsassistenten stammt. Kommt aus dem Join, nicht aus der Zeile. */
  invoice_number: string | null;
};

const SELECT_COLS = `r.id, r.customer_name, r.customer_email, r.customer_phone, r.vehicle,
  r.plate, r.condition_text, r.photo_paths, r.status, r.admin_note, r.created_at,
  r.updated_at, r.booking_id, b.invoice_number`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Höchstzahl Fotos je Meldung — auch als Check-Constraint in der Datenbank. */
export const MAX_PHOTOS = 8;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 8;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Storage-Pfad, wie ihn der Upload vergibt: <uuid>/<zeit>-<zufall>.<ext> */
const STORAGE_PATH_PATTERN = /^[0-9a-f-]{36}\/\d+-\d+\.(jpg|jpeg|png|webp)$/i;

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

// =====================================================================
// Öffentlich: Fotos hochladen und Meldung einsenden
// =====================================================================

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

/**
 * Ein einzelnes Foto hochladen und den Storage-Pfad zurückgeben.
 *
 * Der Aufruf ist bewusst ohne Anmeldung möglich — Interessenten haben
 * keinen Zugang. Geprüft werden Dateityp, Größe und die tatsächliche
 * Dateisignatur, damit unter dem Deckmantel eines Bildformats kein
 * anderer Inhalt hochgeladen wird.
 */
export const uploadConditionPhoto = createServerFn({ method: "POST" })
  .validator((data: { fileName: string; contentType: string; base64Data: string }) => data)
  .handler(async ({ data }) => {
    if (!ALLOWED_IMAGE_TYPES.has(data.contentType)) {
      throw new Error("Nur JPEG, PNG oder WebP werden unterstützt.");
    }
    if (!data.base64Data || data.base64Data.length > MAX_BASE64_LENGTH) {
      throw new Error("Die Datei ist leer oder größer als 8 MB.");
    }

    const bytes = Buffer.from(data.base64Data, "base64");
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("Die Datei ist größer als 8 MB.");
    }
    if (!hasValidImageSignature(bytes, data.contentType)) {
      throw new Error("Die Datei stimmt nicht mit dem angegebenen Bildformat überein.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Der Upload ist derzeit nicht verfügbar.");

    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: createSupabasePublishableFetch(key) },
    });

    const ext = data.fileName.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    // Zufälliger Ordner je Upload: ohne den Pfad zu kennen, kommt niemand
    // an die Datei — zusätzlich zum privaten Bucket.
    const path = `${crypto.randomUUID()}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${safeExt}`;

    const { error } = await client.storage
      .from(CONDITION_PHOTO_BUCKET)
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (error) throw new Error("Das Foto konnte nicht hochgeladen werden.");

    return { ok: true, path };
  });

export type ConditionReportInput = {
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  plate: string;
  conditionText: string;
  photoPaths: string[];
  /**
   * Gesetzt, wenn die Meldung aus dem Buchungsassistenten stammt. Dann
   * erscheint sie im Admin-Bereich mit Bezug zur jeweiligen Buchung.
   */
  bookingId?: string | null;
};

/**
 * Meldung speichern. Läuft über die direkte Datenbankverbindung, nicht
 * über die REST-Schnittstelle — dieselbe Systematik wie bei Buchungen.
 */
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

    /*
     * Eine Meldung braucht Substanz — aber nicht zwingend Text: Aus dem
     * Buchungsassistenten kommen oft nur Fotos, und ein Pflichttext kurz
     * vor dem Abschluss wäre eine unnötige Hürde. Ohne Fotos ist die
     * Beschreibung dagegen der ganze Inhalt und muss aussagekräftig sein.
     */
    if (photoPaths.length === 0) {
      if (!conditionText) {
        throw new Error("Bitte beschreiben Sie den Zustand oder laden Sie Fotos hoch.");
      }
      if (conditionText.length < 20) {
        throw new Error(
          "Bitte beschreiben Sie den Zustand etwas ausführlicher (mindestens 20 Zeichen).",
        );
      }
    }
    if (photoPaths.length > MAX_PHOTOS) {
      throw new Error(`Es sind höchstens ${MAX_PHOTOS} Fotos möglich.`);
    }
    // Nur selbst vergebene Pfadmuster zulassen, damit über dieses Feld
    // keine fremden Dateien aus dem Bucket verknüpft werden können.
    if (photoPaths.some((path) => !STORAGE_PATH_PATTERN.test(path))) {
      throw new Error("Mindestens ein Foto konnte nicht zugeordnet werden.");
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

    // Benachrichtigung an den Betrieb. Bewusst NACH dem Speichern und in
    // einem eigenen try/catch: Ist der Mailversand gestört, ist die
    // Meldung trotzdem sicher in der Datenbank und im Admin-Bereich
    // sichtbar. Ein Mailfehler darf den Kunden nie eine Fehlermeldung
    // sehen lassen — dieselbe Regel gilt schon bei den Buchungen.
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

/**
 * Erzeugt kurzlebige signierte Links für die Fotos einer Meldung.
 *
 * Der Bucket ist privat, also gibt es keine dauerhaft gültige Adresse.
 * Die Links laufen nach einer Stunde ab; das reicht zum Ansehen und
 * verhindert, dass eine versehentlich weitergegebene Adresse dauerhaft
 * funktioniert.
 */
export const getConditionPhotoUrls = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }): Promise<string[]> => {
    await assertAdmin(context);
    if (!UUID_PATTERN.test(data.id)) throw new Error("Ungültige Meldungs-ID.");

    // Pfade serverseitig lesen: so lassen sich über einen manipulierten
    // Aufruf keine beliebigen Bucket-Dateien signieren.
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

/**
 * Meldung löschen — inklusive der Fotodateien.
 *
 * Reihenfolge: erst die Dateien, dann die Zeile. Scheitert das Löschen
 * der Dateien, bleibt die Zeile erhalten und der Vorgang lässt sich
 * wiederholen. Andersherum wären die Pfade verloren und die Dateien
 * blieben dauerhaft im Speicher liegen.
 */
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
