import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Sql } from "./db.ts";
import { configuredWhatsAppOwner } from "./whatsapp-provider.ts";

type Environment = Record<string, string | undefined>;
export type WhatsAppWebhookConfig = {
  phoneNumberId: string;
  businessAccountId: string;
  ownerNumber: string;
  appSecret: string;
  verifyToken: string;
};
export type WhatsAppStatus = {
  eventHash: string;
  messageId: string;
  eventKey: string | null;
  recipient: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  errorCode: string | null;
};

export type WhatsAppDeliveryFailureHandler = (
  sql: Sql,
  row: { id: number; channel: string; event_type: string | null; booking_id: number | null },
  code: string,
) => Promise<void>;

export function readWhatsAppWebhookConfiguration(
  env: Environment = process.env,
): WhatsAppWebhookConfig | null {
  const ownerNumber = configuredWhatsAppOwner(env);
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "";
  const businessAccountId = env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() ?? "";
  const appSecret = env.WHATSAPP_APP_SECRET?.trim() ?? "";
  const verifyToken = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() ?? "";
  if (
    env.WHATSAPP_PROVIDER?.trim() !== "meta" ||
    !ownerNumber ||
    !/^\d{1,30}$/.test(phoneNumberId) ||
    !/^\d{1,30}$/.test(businessAccountId) ||
    !appSecret ||
    !verifyToken
  )
    return null;
  return { ownerNumber, phoneNumberId, businessAccountId, appSecret, verifyToken };
}

export function verifyWhatsAppSignature(
  rawBody: Uint8Array,
  signature: string | null,
  appSecret: string,
): boolean {
  if (!appSecret || !signature || !/^sha256=[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Incoming chat text is deliberately ignored; this endpoint can only record delivery receipts. */
export function parseWhatsAppStatuses(
  payload: unknown,
  config: WhatsAppWebhookConfig,
): WhatsAppStatus[] {
  const root = object(payload);
  if (root?.object !== "whatsapp_business_account") return [];
  if (!Array.isArray(root.entry) || root.entry.length > 200)
    throw new Error("invalid_webhook_payload");
  const statuses: WhatsAppStatus[] = [];
  for (const rawEntry of root.entry) {
    const entry = object(rawEntry);
    if (entry?.id !== config.businessAccountId) continue;
    if (!Array.isArray(entry.changes) || entry.changes.length > 200)
      throw new Error("invalid_webhook_payload");
    for (const rawChange of entry.changes) {
      const change = object(rawChange);
      const value = object(change?.value);
      if (
        change?.field !== "messages" ||
        value?.messaging_product !== "whatsapp" ||
        object(value.metadata)?.phone_number_id !== config.phoneNumberId
      )
        continue;
      if (value.statuses === undefined) continue;
      if (!Array.isArray(value.statuses) || value.statuses.length > 1000)
        throw new Error("invalid_webhook_payload");
      for (const rawStatus of value.statuses) {
        const status = object(rawStatus);
        if (!status || status.recipient_id !== config.ownerNumber) continue;
        if (!["sent", "delivered", "read", "failed"].includes(String(status.status))) continue;
        if (
          typeof status.id !== "string" ||
          !status.id.trim() ||
          status.id.length > 512 ||
          typeof status.timestamp !== "string" ||
          !/^\d{1,12}$/.test(status.timestamp)
        )
          throw new Error("invalid_webhook_payload");
        const milliseconds = Number(status.timestamp) * 1000;
        if (!Number.isFinite(new Date(milliseconds).getTime()))
          throw new Error("invalid_webhook_payload");
        const errors = Array.isArray(status.errors)
          ? status.errors
              .map((error) => object(error)?.code)
              .filter(
                (code): code is number => typeof code === "number" && Number.isSafeInteger(code),
              )
              .sort((a, b) => a - b)
          : [];
        const eventKey =
          typeof status.biz_opaque_callback_data === "string" &&
          /^[A-Za-z0-9:_.-]{1,200}$/.test(status.biz_opaque_callback_data)
            ? status.biz_opaque_callback_data
            : null;
        statuses.push({
          eventHash: createHash("sha256")
            .update(
              JSON.stringify([
                config.businessAccountId,
                config.phoneNumberId,
                status.id,
                status.status,
                status.timestamp,
                errors,
              ]),
            )
            .digest("hex"),
          messageId: status.id,
          eventKey,
          recipient: config.ownerNumber,
          status: status.status as WhatsAppStatus["status"],
          timestamp: new Date(milliseconds).toISOString(),
          errorCode: errors.length ? `meta_${errors[0]}` : null,
        });
        if (statuses.length > 1000) throw new Error("invalid_webhook_payload");
      }
    }
  }
  return statuses;
}

/** Receipt, delivery state and any owner alert commit together before the webhook ACK. */
export async function applyWhatsAppStatuses(
  sql: Sql,
  statuses: WhatsAppStatus[],
  onDeliveryFailed?: WhatsAppDeliveryFailureHandler,
): Promise<number> {
  let updated = 0;
  for (const status of statuses) {
    const rank = { sent: 1, delivered: 2, read: 3, failed: 0 }[status.status];
    updated += await sql.transaction(async (tx) => {
      const rows = await tx<{
        id: number;
        channel: string;
        event_type: string | null;
        booking_id: number | null;
      }>`
      with received as (
        insert into whatsapp_webhook_receipts (event_hash)
        values (${status.eventHash})
        on conflict (event_hash) do nothing
        returning event_hash
      )
      update outbound_queue q
      set provider_message_id = coalesce(q.provider_message_id, ${status.messageId}),
          status = ${status.status === "failed" ? "failed" : "sent"},
          delivery_status = ${status.status},
          delivered_at = case when ${rank} >= 2 then coalesce(q.delivered_at, ${status.timestamp}::timestamptz) else q.delivered_at end,
          read_at = case when ${rank} = 3 then coalesce(q.read_at, ${status.timestamp}::timestamptz) else q.read_at end,
          last_error_code = ${status.status === "failed" ? status.errorCode || "delivery_failed" : null},
          locked_until = null,
          lease_token = null,
          updated_at = now()
      where exists (select 1 from received)
        and q.shop_id = ${"white-gloss"} and q.channel = ${"whatsapp"}
        and q.status <> ${"cancelled"}
        and regexp_replace(q.to_addr, '[^0-9]', '', 'g') = ${status.recipient}
        and (q.provider_message_id = ${status.messageId}
          or (q.provider_message_id is null and q.event_key = ${status.eventKey}))
        and (
          (${status.status} = 'failed' and q.delivery_status in ('pending', 'sent'))
          or (${status.status} <> 'failed'
            and (case q.delivery_status when 'read' then 3 when 'delivered' then 2 when 'sent' then 1 else 0 end) <= ${rank}
            and (q.delivery_status <> 'failed' or ${rank} >= 2))
        )
      returning q.id, q.channel, q.event_type, q.booking_id
    `;
      if (status.status === "failed" && onDeliveryFailed) {
        for (const row of rows)
          await onDeliveryFailed(tx, row, status.errorCode || "delivery_failed");
      }
      return rows.length;
    });
  }
  return updated;
}

const MAX_WEBHOOK_BYTES = 1024 * 1024;

async function rawRequestBody(request: Request): Promise<Uint8Array | null> {
  if (Number(request.headers.get("content-length")) > MAX_WEBHOOK_BYTES) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export function createWhatsAppWebhookHandler(options: {
  getSql: () => Promise<Sql>;
  env?: Environment;
  onError?: (code: string) => void;
  onDeliveryFailed?: WhatsAppDeliveryFailureHandler;
}): (request: Request) => Promise<Response> {
  const response = (body: string, status = 200) =>
    new Response(body, {
      status,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  return async (request) => {
    const config = readWhatsAppWebhookConfiguration(options.env ?? process.env);
    if (!config) return response("Webhook nicht konfiguriert.", 503);
    if (request.method === "GET") {
      const query = new URL(request.url).searchParams;
      const supplied = createHash("sha256")
        .update(query.get("hub.verify_token") ?? "")
        .digest();
      const expected = createHash("sha256").update(config.verifyToken).digest();
      const challenge = query.get("hub.challenge");
      if (
        query.get("hub.mode") !== "subscribe" ||
        !challenge ||
        challenge.length > 512 ||
        !timingSafeEqual(supplied, expected)
      )
        return response("Verifizierung fehlgeschlagen.", 403);
      return response(challenge);
    }
    if (request.method !== "POST") return response("Methode nicht erlaubt.", 405);
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature || !/^sha256=[a-fA-F0-9]{64}$/.test(signature))
      return response("Signatur ungültig.", 403);
    let raw: Uint8Array | null;
    try {
      raw = await rawRequestBody(request);
    } catch {
      return response("Anfrage ungültig.", 400);
    }
    if (raw === null) return response("Anfrage zu groß.", 413);
    if (!verifyWhatsAppSignature(raw, signature, config.appSecret))
      return response("Signatur ungültig.", 403);
    let statuses: WhatsAppStatus[];
    try {
      statuses = parseWhatsAppStatuses(
        JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)),
        config,
      );
    } catch {
      return response("Anfrage ungültig.", 400);
    }
    if (!statuses.length) return response("OK");
    try {
      await applyWhatsAppStatuses(await options.getSql(), statuses, options.onDeliveryFailed);
      return response("OK");
    } catch {
      // Non-2xx asks Meta to redeliver; no success ACK before durable persistence.
      options.onError?.("whatsapp_receipt_storage_failed");
      return response("Verarbeitung vorübergehend nicht möglich.", 503);
    }
  };
}
