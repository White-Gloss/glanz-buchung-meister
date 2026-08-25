import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { query, queryOne } from "@/lib/db.server";
import { clientAddress, createBookingRateLimiter } from "./bookingProtection";
import { megabyte, planCleanup, type StoredMedia } from "./conditionMediaCleanup";
import { protokollFehler, protokollHinweis } from "./serverLog";

const conditionUploadRateLimiter = createBookingRateLimiter({
  // Eine Meldung erlaubt maximal fünf Aufnahmen. Das Zeitfenster lässt einen
  // abgebrochenen Upload erneut zu, blockiert aber Speicher-Missbrauch.
  limit: 8,
  windowMs: 15 * 60_000,
});

const conditionReportRateLimiter = createBookingRateLimiter({
  // Jede abgeschickte Meldung schreibt einen Datensatz und löst E-Mail sowie
  // Handy-Benachrichtigung aus. Mehrere Anläufe pro Viertelstunde bleiben für
  // echte Interessenten möglich, Dauerfeuer wird abgewiesen.
  limit: 5,
  windowMs: 15 * 60_000,
});

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
const STORAGE_PATH_PATTERN = /^[0-9a-f-]{36}\/\d+-\d+\.(jpg|jpeg|png|webp|mp4|mov|webm)$/i;

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
    const rateLimit = conditionUploadRateLimiter.check(clientAddress(getRequest()?.headers));
    if (!rateLimit.allowed) {
      throw new Error(
        `Zu viele Uploads. Bitte warten Sie noch etwa ${rateLimit.retryAfterSeconds} Sekunden und versuchen Sie es erneut.`,
      );
    }

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
    // Die Service-Role verlässt nie den Server. Damit kann der private Bucket
    // ohne eine anonyme Storage-Policy beschrieben werden; direkte Uploads an
    // die öffentliche Supabase-API umgehen unsere Datei-Prüfung nicht mehr.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) throw new Error("Der Upload ist derzeit nicht verfügbar.");

    const client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const ext = extensionForContentType(data.contentType);
    const path = `${crypto.randomUUID()}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;

    const { error } = await client.storage
      .from(CONDITION_PHOTO_BUCKET)
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (error) throw new Error("Die Aufnahme konnte nicht hochgeladen werden.");

    return { ok: true, path };
  });

export type ConditionUploadStatus = {
  /** Beide Werte gesetzt — der Server kann in den privaten Speicher schreiben. */
  ready: boolean;
  supabaseUrlSet: boolean;
  serviceRoleKeySet: boolean;
};

/**
 * Ob der Foto-Upload überhaupt funktionieren kann.
 *
 * Seit der Sicherheitshärtung schreibt ausschließlich der Server in den
 * privaten Speicher — Interessenten haben dort keine eigene Berechtigung
 * mehr. Fehlt `SUPABASE_SERVICE_ROLE_KEY` in der Serverumgebung, scheitert
 * deshalb jeder Foto-Upload, und zwar lautlos: Die Kundschaft sieht nur
 * „Der Upload ist derzeit nicht verfügbar", im Adminbereich kommt schlicht
 * nie eine Meldung an. Genau das macht diese Funktion sichtbar.
 *
 * Zurückgegeben werden nur Ja/Nein-Angaben, niemals der Wert eines
 * Schlüssels.
 */
export const getConditionUploadStatus = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConditionUploadStatus> => {
    await assertAdmin(context);
    const supabaseUrlSet = Boolean(process.env.SUPABASE_URL);
    const serviceRoleKeySet = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    return {
      ready: supabaseUrlSet && serviceRoleKeySet,
      supabaseUrlSet,
      serviceRoleKeySet,
    };
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
    const rateLimit = conditionReportRateLimiter.check(clientAddress(getRequest()?.headers));
    if (!rateLimit.allowed) {
      throw new Error(
        `Zu viele Meldungen. Bitte warten Sie noch etwa ${rateLimit.retryAfterSeconds} Sekunden und versuchen Sie es erneut.`,
      );
    }

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
        throw new Error(
          "Bitte beschreiben Sie kurz Ihr Anliegen oder laden Sie ein Foto/Video hoch.",
        );
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
          protokollFehler("mail", "Zustandsmeldung nicht zugestellt", result.reason);
        }
      } else {
        protokollHinweis("mail", "Versand nicht konfiguriert — keine Zustandsmeldung verschickt");
      }
    } catch (error) {
      protokollFehler("mail", "Zustandsmeldung fehlgeschlagen", error);
    }

    // Zusätzlich aufs Geschäftshandy, getrennt abgefangen.
    try {
      const { notifyOwner } = await import("./ownerNotify.server");
      const { conditionReportNotifyText } = await import("./notifyTexts");
      await notifyOwner(
        conditionReportNotifyText({ name, vehicle, photoCount: photoPaths.length }),
        "Zustandsmeldung",
      );
    } catch (error) {
      protokollFehler("benachrichtigung", "Zustandsmeldung übersprungen", error);
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
        WHERE r.condition_text NOT LIKE '[DENT_REPAIR_V1]%'
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

// =====================================================================
// Verwaiste Aufnahmen aufräumen
// =====================================================================

/**
 * Aufnahmen wandern sofort beim Auswählen in den Speicher, damit das
 * Absenden später schnell geht. Bricht jemand das Formular danach ab,
 * bleibt die Datei liegen, ohne dass je eine Meldung dazu entsteht. Das ist
 * kein Fehler, aber der Speicher wächst dadurch still mit.
 *
 * WICHTIG — warum das hier und nicht per Datenbankbefehl passiert:
 * Ein `DELETE` auf der Storage-Tabelle entfernt nur den Eintrag im
 * Verzeichnis, nicht die Datei selbst. Der Platz wäre also weiterhin belegt,
 * nur nicht mehr sichtbar — schlimmer als gar nichts zu tun. Löschen darf
 * ausschließlich die Storage-Schnittstelle, und die verlangt den
 * Serverschlüssel, der den Server nie verlässt.
 */
export type OrphanCleanupResult = {
  /** Dateien ohne zugehörige Meldung, älter als die Schonfrist. */
  gefunden: number;
  /** Tatsächlich gelöscht — bei einer reinen Prüfung immer 0. */
  geloescht: number;
  /** Freigewordener Platz in Megabyte, auf zwei Stellen gerundet. */
  megabyte: number;
  /** Jünger als die Schonfrist und deshalb bewusst stehengelassen. */
  geschont: number;
  /** Dateien, die zu einer Meldung gehören und nie angefasst werden. */
  inVerwendung: number;
  fehler: string | null;
};

/**
 * Verwaiste Aufnahmen finden und auf Wunsch löschen.
 *
 * Standardmäßig wird nur gezählt. Erst `loeschen: true` entfernt etwas —
 * und auch dann nur Dateien, die älter als sieben Tage sind. Die Schonfrist
 * schützt ein Formular, das gerade offen ist: Dort liegen die Aufnahmen
 * bereits im Speicher, während die Meldung noch nicht abgeschickt ist.
 */
export const cleanupOrphanedConditionMedia = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { loeschen?: boolean }) => data ?? {})
  .handler(async ({ data, context }): Promise<OrphanCleanupResult> => {
    await assertAdmin(context);

    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error(
        "Zum Aufräumen fehlt der Serverschlüssel (SUPABASE_SERVICE_ROLE_KEY). Siehe Hinweis oben auf dieser Seite.",
      );
    }

    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Alles, was zu einer Meldung gehört, ist tabu.
    const rows = await query<{ pfad: string }>(
      `SELECT unnest(photo_paths) AS pfad FROM public.condition_reports`,
    );
    const inVerwendung = new Set(rows.map((row) => row.pfad));

    // Der Speicher ist zweistufig abgelegt: <uuid>/<datei>. Deshalb erst die
    // Ordner auflisten, dann je Ordner die Dateien darin.
    const { data: ordner, error: ordnerFehler } = await client.storage
      .from(CONDITION_PHOTO_BUCKET)
      .list("", { limit: 1000 });
    if (ordnerFehler) throw new Error(ordnerFehler.message);

    const gefundeneDateien: StoredMedia[] = [];
    for (const eintrag of ordner ?? []) {
      const { data: dateien, error } = await client.storage
        .from(CONDITION_PHOTO_BUCKET)
        .list(eintrag.name, { limit: 1000 });
      if (error) continue;

      for (const datei of dateien ?? []) {
        gefundeneDateien.push({
          path: `${eintrag.name}/${datei.name}`,
          createdAt: datei.created_at,
          sizeBytes: Number(datei.metadata?.size ?? 0),
        });
      }
    }

    // Die eigentliche Entscheidung steht in conditionMediaCleanup.ts und ist
    // dort einzeln durchgetestet.
    const plan = planCleanup(gefundeneDateien, inVerwendung);
    const basis = {
      gefunden: plan.loeschen.length,
      megabyte: megabyte(plan.bytes),
      geschont: plan.geschont,
      inVerwendung: plan.inVerwendung,
    };

    if (!data.loeschen || plan.loeschen.length === 0) {
      return { ...basis, geloescht: 0, fehler: null };
    }

    const { error } = await client.storage.from(CONDITION_PHOTO_BUCKET).remove(plan.loeschen);
    if (error) return { ...basis, geloescht: 0, fehler: error.message };

    // Aufräumvermerk, kein Fehler: er soll im Adminbereich nachvollziehbar
    // sein. Vom Akteur nur die ersten acht Zeichen — sie genügen, um unter
    // einer Handvoll Administratoren zu unterscheiden, und die vollständige
    // Kennung würde ohnehin als möglicher Schlüssel ersetzt.
    protokollHinweis("zustand", "Verwaiste Aufnahmen entfernt", {
      anzahl: plan.loeschen.length,
      megabyte: basis.megabyte,
      akteur: context.userId.slice(0, 8),
    });
    return { ...basis, geloescht: plan.loeschen.length, fehler: null };
  });
