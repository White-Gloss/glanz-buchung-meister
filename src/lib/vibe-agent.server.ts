import { createHash } from "node:crypto";
import type { Sql } from "./db.ts";
import { askVibeAi, normalizeVibeAiKey } from "./vibe-ai.ts";
import { readVibeApiKey } from "./bitrix-credentials.server.ts";

const SHOP = "white-gloss";
export async function readVibeAiKey(sql: Sql): Promise<string> {
  const [settings] = await sql<{
    vibe_ai_api_key: string | null;
  }>`select vibe_ai_api_key from shop_settings where shop_id=${SHOP}`;
  const candidate =
    process.env.VIBE_AI_API_KEY?.trim() || settings?.vibe_ai_api_key || (await readVibeApiKey(sql));
  try {
    return normalizeVibeAiKey(candidate);
  } catch {
    return "";
  }
}

export async function loadAgentContext(sql: Sql, bookingId?: number) {
  // Explicit projection: never send API keys, photo capabilities, email bodies or other customers.
  const bookings = await sql`
    select b.id,b.version,b.status,b.ops_stage,b.package_id,b.class_id,b.extra_ids,
      b.preferred_date::text,b.preferred_slot,b.vehicle_make,b.vehicle_model,
      b.note,b.total_cents,b.estimated_price_cents,b.agreed_price_cents,
      b.work_start_at::text,b.work_end_at::text,b.resource_id,
      b.customer_acceptance_required,b.customer_accepted_at::text,
      b.confirmed_at::text,b.invoice_status,b.payment_method,b.payment_status,
      b.payment_recorded_cents,b.payment_recorded_on::text,b.bitrix_deal_id,b.bitrix_last_error,
      (select count(*)::int from booking_photos p where p.shop_id=b.shop_id and p.booking_id=b.id and p.upload_state='ready') as ready_photos,
      (select count(*)::int from booking_photos p where p.shop_id=b.shop_id and p.booking_id=b.id and p.upload_state<>'ready') as pending_photos
    from bookings b where b.shop_id=${SHOP} and b.id=${bookingId ?? 0}
  `;
  if (bookingId && !bookings.length) throw new Error("Buchung nicht gefunden.");
  const deliveries = bookingId
    ? await sql`
    select event_type,channel,status,last_error_code from outbound_queue
    where shop_id=${SHOP} and booking_id=${bookingId} order by id desc limit 12
  `
    : [];
  return {
    capturedAt: new Date().toISOString(),
    timezone: "Europe/Berlin",
    bookings,
    deliveries,
    capabilities: {
      adviceOnly: true,
      visualPhotoAnalysis: false,
      nativeBitrixWorkflowVerified: false,
      note: "Bitrix-Deal-Synchronisation vorhanden. Native Bitrix-Freigaben, Rechnungen, Zahlungszuordnung und Kalender-Rückkanal sind damit nicht nachgewiesen.",
    },
  };
}

export type AgentRun = {
  status: "running" | "succeeded" | "failed";
  result: string | null;
  error: string | null;
};
export async function runVibeAgent(
  sql: Sql,
  userId: string,
  input: { requestId: string; question: string; bookingId?: number },
  ask: typeof askVibeAi = askVibeAi,
): Promise<AgentRun> {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify([input.question, input.bookingId ?? null]))
    .digest("hex");
  const [old] = await sql<
    AgentRun & { fingerprint: string }
  >`select status,result,error,fingerprint from vibe_agent_runs
    where shop_id=${SHOP} and user_id=${userId} and request_id=${input.requestId}::uuid`;
  if (old) {
    if (old.fingerprint !== fingerprint)
      throw new Error("Diese Anfragekennung gehört zu einer anderen Frage.");
    return { status: old.status, result: old.result, error: old.error };
  }
  const key = await readVibeAiKey(sql);
  if (!key) throw new Error("Bitte zuerst den VibeCode-KI-Schlüssel unter Bitrix24 speichern.");
  const context = await loadAgentContext(sql, input.bookingId);
  // Serialize quota and claim across processes; external AI call runs after the commit.
  const claimed = await sql.transaction(async (tx) => {
    await tx`update booking_workflow_locks set revision=revision+1 where shop_id=${SHOP}`;
    const [count] = await tx<{
      n: number;
    }>`select count(*)::int as n from vibe_agent_runs where shop_id=${SHOP}
      and user_id=${userId} and created_at>now()-interval '10 minutes'`;
    if (count.n >= 12)
      throw new Error("KI-Limit erreicht. Bitte in zehn Minuten erneut versuchen.");
    return tx`insert into vibe_agent_runs(shop_id,user_id,request_id,fingerprint,booking_id,status)
      values(${SHOP},${userId},${input.requestId}::uuid,${fingerprint},${input.bookingId ?? null},'running')
      on conflict do nothing returning request_id`;
  });
  if (!claimed.length) return runVibeAgent(sql, userId, input, ask);
  let run: AgentRun;
  try {
    run = { status: "succeeded", result: await ask(key, input.question, context), error: null };
  } catch (error) {
    run = {
      status: "failed",
      result: null,
      error: error instanceof Error ? error.message : "KI-Anfrage fehlgeschlagen.",
    };
  }
  await sql`update vibe_agent_runs set status=${run.status},result=${run.result},error=${run.error},updated_at=now()
    where shop_id=${SHOP} and user_id=${userId} and request_id=${input.requestId}::uuid`;
  return run;
}
