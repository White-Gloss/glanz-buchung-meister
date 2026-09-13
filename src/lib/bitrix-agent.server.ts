import { createHash } from "node:crypto";
import type { Sql } from "./db.ts";
import { readVibeApiKey } from "./bitrix-credentials.server.ts";
import { createSignedPhotoUrl, sniffMagicMime } from "./booking-photos.ts";
import { askBitrixAgent, type AgentSnapshot, type AgentAnswer } from "./bitrix-agent.ts";

import { ensureBookingAgentSchema } from "./bitrix-agent-schema.ts";

const SHOP = "white-gloss";

export async function agentKey(sql: Sql) {
  await ensureBookingAgentSchema(sql);
  const [settings] = await sql<{
    vibe_ai_api_key: string | null;
  }>`select vibe_ai_api_key from shop_settings where shop_id=${SHOP}`;
  const key =
    process.env.VIBE_AI_API_KEY?.trim() ||
    settings?.vibe_ai_api_key?.trim() ||
    (await readVibeApiKey(sql));
  return /^vibe_api_[A-Za-z0-9_-]+$/.test(key) ? key : "";
}

async function loadPhoto(url: string, mime: string): Promise<string> {
  // URL comes from our private storage signing helper, never model/customer text.
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: "error" });
  if (!response.ok || !response.body) throw new Error("photo_unavailable");
  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 3_000_000) throw new Error("photo_too_large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = Buffer.concat(chunks);
  if (sniffMagicMime(bytes) !== mime) throw new Error("photo_type_mismatch");
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

export async function analyzeBooking(
  sql: Sql,
  userId: string,
  input: {
    requestId: string;
    bookingId?: number;
    expectedVersion?: number;
    question: string;
    includePhotos: boolean;
  },
) {
  const key = await agentKey(sql);
  if (!key)
    throw new Error(
      "Bitte zuerst den persönlichen VibeCode-API-Schlüssel unter Bitrix24 speichern.",
    );
  await ensureBookingAgentSchema(sql);
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const [previous] = await sql<{
    user_id: string;
    fingerprint: string;
    status: string;
    answer: AgentAnswer;
    error: string;
  }>`
    select user_id,fingerprint,status,answer,error from booking_agent_runs
    where request_id=${input.requestId}::uuid and shop_id=${SHOP}`;
  if (previous) {
    if (previous.user_id !== userId || previous.fingerprint !== fingerprint)
      throw new Error(
        "Diese Analysekennung wurde bereits verwendet. Bitte eine neue Analyse starten.",
      );
    if (previous.status === "done") return previous.answer;
    throw new Error(
      previous.error ||
        "Diese Analyse wurde bereits gestartet. Bitte später erneut laden oder eine neue Analyse beginnen.",
    );
  }
  const [booking] = input.bookingId
    ? await sql<Record<string, unknown>>`
    select id,version,status,customer_name,package_id,class_id,extra_ids,
      preferred_date,preferred_slot,total_cents,estimated_price_cents,agreed_price_cents,
      work_start_at,work_end_at,resource_id,ops_stage,customer_acceptance_required,
      customer_accepted_at,vehicle_make,vehicle_model,vehicle_plate,note,internal_notes,
      invoice_status,payment_status,payment_method,payment_recorded_cents,payment_recorded_on,
      bitrix_deal_id,bitrix_last_error
    from bookings where shop_id=${SHOP} and id=${input.bookingId}`
    : [];
  if (input.bookingId && (!booking || booking.version !== input.expectedVersion))
    throw new Error("Die Buchung fehlt oder wurde inzwischen geändert. Bitte Buchungen neu laden.");
  const claimed =
    await sql`insert into booking_agent_runs(request_id,shop_id,user_id,booking_id,booking_version,fingerprint,status)
    values(${input.requestId}::uuid,${SHOP},${userId},${input.bookingId ?? null},${input.expectedVersion ?? null},${fingerprint},'processing')
    on conflict(request_id) do nothing returning request_id`;
  if (!claimed.length) throw new Error("Diese Analyse läuft bereits. Bitte nicht erneut absenden.");
  try {
    const photos =
      input.bookingId && input.includePhotos
        ? await sql<{ id: number; storage_path: string; mime: string; upload_state: string }>`
      select id,storage_path,mime,upload_state from booking_photos
      where shop_id=${SHOP} and booking_id=${input.bookingId} order by id limit 9`
        : [];
    const images: string[] = [],
      photoWarnings: string[] = [];
    const candidates = photos
      .filter(
        (photo) =>
          photo.upload_state === "ready" &&
          ["image/jpeg", "image/png", "image/webp"].includes(photo.mime),
      )
      .slice(0, 4);
    for (const photo of photos.filter((photo) => !candidates.includes(photo))) {
      photoWarnings.push(
        `Aufnahme ${photo.id} nicht analysiert (Video, Upload unvollständig oder Bildlimit).`,
      );
    }
    const loaded = await Promise.allSettled(
      candidates.map(async (photo) =>
        loadPhoto(await createSignedPhotoUrl(photo.storage_path), photo.mime),
      ),
    );
    for (let index = 0; index < loaded.length; index++) {
      const result = loaded[index];
      if (result.status === "fulfilled") images.push(result.value);
      else
        photoWarnings.push(
          `Foto ${candidates[index].id} nicht geladen oder größer als 3 MB; manuell prüfen.`,
        );
    }
    if (!images.length) photoWarnings.push("Keine Fotos an die KI übergeben.");
    const openBookings = booking
      ? []
      : await sql<Record<string, unknown>>`
      select id,version,status,package_id,preferred_date,preferred_slot,work_start_at,work_end_at,ops_stage
      from bookings where shop_id=${SHOP} and status in ('neu','bestaetigt')
      order by created_at desc limit 20`;
    const snapshot: AgentSnapshot = {
      booking: booking ?? null,
      openBookings,
      photosAnalyzed: images.length,
      photoWarnings,
      capabilities: {
        mode: "Nur Analyse und ungesendete Entwürfe; keine Geschäftsaktionen durch KI",
        source:
          "Website-Datenbank; gespeicherter Stand, keine Live-Abfrage des Bitrix-Kalenders oder Bankkontos",
        bitrixDealSync:
          "Vorhandener Übertragungsweg; Erfolg nur aus gespeichertem Deal-/Fehlerstatus ableiten",
        bitrixFullWorkflow:
          "Noch nicht vollständig angebunden: Bitrix-Rückkanal, manuelle Kalendersperren und separate Rechnungs-/Zahlungs-/Versandautomatik benötigen Einrichtung und Prüfung",
        manualApprovalRequired: true,
      },
    };
    const answer = await askBitrixAgent({
      apiKey: key,
      question: input.question,
      snapshot,
      images,
    });
    // A result remains an advisory snapshot even if the booking changed during generation.
    await sql.transaction(async (tx) => {
      await tx`update booking_agent_runs set status='done',answer=${JSON.stringify(answer)}::jsonb,finished_at=now()
        where request_id=${input.requestId}::uuid and user_id=${userId} and shop_id=${SHOP}`;
      await tx`insert into agent_commands(shop_id,channel,input,result,user_id)
        values(${SHOP},'panel',${`${input.bookingId ? `WG-${input.bookingId} · ` : ""}${input.question}`},${JSON.stringify(answer)},${userId})`;
    });
    return answer;
  } catch (error) {
    // Never return provider response bodies, signed URLs, credentials or DB errors.
    const message =
      error instanceof Error && /^(Die KI|VibeCode|Der KI|Das KI|Für den KI)/.test(error.message)
        ? error.message
        : "Analyse fehlgeschlagen. Deine Buchung bleibt gespeichert. Bitte eine neue Analyse starten.";
    await sql`update booking_agent_runs set status='failed',error=${message},finished_at=now()
      where request_id=${input.requestId}::uuid and user_id=${userId} and shop_id=${SHOP}`.catch(
      () => undefined,
    );
    throw new Error(message);
  }
}
