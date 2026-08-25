import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { query, queryOne } from "./db.server";
import { clientAddress, createBookingRateLimiter } from "./bookingProtection";
import {
  dentRequestStatuses,
  normalizeDentRepairRequest,
  type DentRepairRequestInput,
  type DentRequestStatus,
  type NormalizedDentRepairRequest,
} from "./dentRepair";
import { CONDITION_PHOTO_BUCKET } from "./conditionReports.functions";
import { protokollFehler } from "./serverLog";

const dentRequestRateLimiter = createBookingRateLimiter({
  // Wie bei der Zustandsmeldung: jede Anfrage schreibt einen Datensatz und
  // verschickt Mails an Betrieb und Interessent.
  limit: 5,
  windowMs: 15 * 60_000,
});

const DENT_MARKER = "[DENT_REPAIR_V1]";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DentRepairRequest = {
  id: string;
  reference: string;
  damage_type: string;
  vehicle_area: string;
  dent_count: string;
  dent_size: string;
  vehicle_make: string;
  vehicle_model: string;
  photo_paths: string[];
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  preferred_date: string;
  assessment_mode: string;
  note: string;
  status: DentRequestStatus;
  admin_note: string;
  created_at: string;
  updated_at: string;
};

type StoredDentDetails = Pick<
  NormalizedDentRepairRequest,
  | "damageType"
  | "vehicleArea"
  | "dentCount"
  | "dentSize"
  | "vehicleMake"
  | "vehicleModel"
  | "preferredDate"
  | "assessmentMode"
  | "note"
>;

type ConditionRow = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  vehicle: string;
  condition_text: string;
  photo_paths: string[];
  status: DentRequestStatus;
  admin_note: string;
  created_at: string;
  updated_at: string;
};

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kein Administrator-Zugriff");
}

function referenceOf(id: string): string {
  return `DEL-${id.slice(0, 8).toUpperCase()}`;
}

function encodeDetails(data: NormalizedDentRepairRequest): string {
  const details: StoredDentDetails = {
    damageType: data.damageType,
    vehicleArea: data.vehicleArea,
    dentCount: data.dentCount,
    dentSize: data.dentSize,
    vehicleMake: data.vehicleMake,
    vehicleModel: data.vehicleModel,
    preferredDate: data.preferredDate,
    assessmentMode: data.assessmentMode,
    note: data.note,
  };
  return `${DENT_MARKER}${JSON.stringify(details)}`;
}

function decodeRow(row: ConditionRow): DentRepairRequest {
  if (!row.condition_text.startsWith(DENT_MARKER)) throw new Error("Ungültige Dellen-Anfrage.");
  const details = JSON.parse(row.condition_text.slice(DENT_MARKER.length)) as StoredDentDetails;
  return {
    id: row.id,
    reference: referenceOf(row.id),
    damage_type: details.damageType,
    vehicle_area: details.vehicleArea,
    dent_count: details.dentCount,
    dent_size: details.dentSize,
    vehicle_make: details.vehicleMake,
    vehicle_model: details.vehicleModel,
    photo_paths: row.photo_paths ?? [],
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    preferred_date: details.preferredDate,
    assessment_mode: details.assessmentMode,
    note: details.note,
    status: row.status,
    admin_note: row.admin_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const submitDentRepairRequest = createServerFn({ method: "POST" })
  .validator((data: DentRepairRequestInput) => normalizeDentRepairRequest(data))
  .handler(async ({ data }) => {
    const rateLimit = dentRequestRateLimiter.check(clientAddress(getRequest()?.headers));
    if (!rateLimit.allowed) {
      throw new Error(
        `Zu viele Anfragen. Bitte warten Sie noch etwa ${rateLimit.retryAfterSeconds} Sekunden und versuchen Sie es erneut.`,
      );
    }

    const row = await queryOne<{ id: string }>(
      `INSERT INTO public.condition_reports
         (customer_name, customer_email, customer_phone, vehicle, plate, condition_text, photo_paths)
       VALUES ($1, $2, $3, $4, '', $5, $6)
       RETURNING id`,
      [
        data.name,
        data.email,
        data.phone,
        `${data.vehicleMake} ${data.vehicleModel}`,
        encodeDetails(data),
        data.photoPaths,
      ],
    );
    if (!row) throw new Error("Die Begutachtungsanfrage konnte nicht gespeichert werden.");
    const reference = referenceOf(row.id);
    try {
      const { mailConfigured, sendDentRepairRequestMails } = await import("./email.server");
      if (mailConfigured()) await sendDentRepairRequestMails({ ...data, id: row.id, reference });
    } catch (error) {
      protokollFehler("mail", "Dellen-Begutachtungsanfrage nicht versendet", error);
    }
    return { ok: true as const, id: row.id, reference, customerName: data.name };
  });

export const listDentRepairRequests = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }): Promise<DentRepairRequest[]> => {
    await assertAdmin(context);
    const rows = await query<ConditionRow>(
      `SELECT id, customer_name, customer_email, customer_phone, vehicle, condition_text,
              photo_paths, status, admin_note, created_at, updated_at
         FROM public.condition_reports
        WHERE condition_text LIKE $1
        ORDER BY created_at DESC`,
      [`${DENT_MARKER}%`],
    );
    return rows.map(decodeRow);
  });

export const getDentRepairPhotoUrls = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }): Promise<string[]> => {
    await assertAdmin(context);
    if (!UUID.test(data.id)) throw new Error("Ungültige Anfrage-ID.");
    const request = await queryOne<{ photo_paths: string[] }>(
      `SELECT photo_paths FROM public.condition_reports WHERE id = $1 AND condition_text LIKE $2`,
      [data.id, `${DENT_MARKER}%`],
    );
    if (!request) throw new Error("Die Anfrage wurde nicht gefunden.");
    if (request.photo_paths.length === 0) return [];
    const { data: signed, error } = await context.supabase.storage
      .from(CONDITION_PHOTO_BUCKET)
      .createSignedUrls(request.photo_paths, 3600);
    if (error) throw new Error(error.message);
    return (signed ?? []).map((entry) => entry.signedUrl).filter(Boolean) as string[];
  });

export const updateDentRepairRequest = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string; status: DentRequestStatus; adminNote: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!UUID.test(data.id)) throw new Error("Ungültige Anfrage-ID.");
    if (!dentRequestStatuses.includes(data.status)) throw new Error("Ungültiger Status.");
    const adminNote = String(data.adminNote ?? "")
      .trim()
      .slice(0, 2000);
    const row = await queryOne<{ id: string }>(
      `UPDATE public.condition_reports SET status = $2, admin_note = $3
        WHERE id = $1 AND condition_text LIKE $4 RETURNING id`,
      [data.id, data.status, adminNote, `${DENT_MARKER}%`],
    );
    if (!row) throw new Error("Die Anfrage wurde nicht gefunden.");
    return { ok: true as const };
  });

export const deleteDentRepairRequest = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .validator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!UUID.test(data.id)) throw new Error("Ungültige Anfrage-ID.");
    const request = await queryOne<{ photo_paths: string[] }>(
      `SELECT photo_paths FROM public.condition_reports WHERE id = $1 AND condition_text LIKE $2`,
      [data.id, `${DENT_MARKER}%`],
    );
    if (!request) throw new Error("Die Anfrage wurde nicht gefunden.");
    let storageWarning: string | null = null;
    if (request.photo_paths.length) {
      const { error } = await context.supabase.storage
        .from(CONDITION_PHOTO_BUCKET)
        .remove(request.photo_paths);
      storageWarning = error?.message ?? null;
    }
    await query(`DELETE FROM public.condition_reports WHERE id = $1 AND condition_text LIKE $2`, [
      data.id,
      `${DENT_MARKER}%`,
    ]);
    return { ok: true as const, storageWarning };
  });
