export type WhatsAppNotification = {
  to: string;
  subject: string;
  text: string;
  /** Stable outbox event key; correlation only, not a Meta deduplication guarantee. */
  idempotencyKey: string;
};

export interface WhatsAppProvider {
  sendNotification(input: WhatsAppNotification): Promise<{ id: string }>;
}

type Environment = Record<string, string | undefined>;

export class WhatsAppDeliveryError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly ambiguous: boolean;
  readonly retryAfterMs?: number;

  constructor(code: string, retryable = false, ambiguous = false, retryAfterMs?: number) {
    super(`WhatsApp-Versand: ${code}`);
    this.name = "WhatsAppDeliveryError";
    this.code = code;
    this.retryable = retryable;
    this.ambiguous = ambiguous;
    this.retryAfterMs = retryAfterMs;
  }
}

export function normalizeWhatsAppNumber(value: string | undefined): string | null {
  const number = (value ?? "").trim().replace(/[\s()-]/g, "");
  return /^\+?[1-9]\d{7,14}$/.test(number) ? number.replace(/^\+/, "") : null;
}

export function configuredWhatsAppOwner(env: Environment = process.env): string | null {
  return normalizeWhatsAppNumber(env.ADMIN_WHATSAPP_NUMBER?.trim() || env.OWNER_WHATSAPP);
}

export function validateWhatsAppConfiguration(env: Environment = process.env): {
  enabled: boolean;
  configured: boolean;
  issues: string[];
} {
  const provider = (env.WHATSAPP_PROVIDER ?? "").trim();
  if (!provider || provider === "disabled")
    return { enabled: false, configured: false, issues: [] };
  const issues: string[] = [];
  if (provider !== "meta") issues.push("WHATSAPP_PROVIDER");
  for (const key of [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  ]) {
    if (!env[key]?.trim()) issues.push(key);
  }
  for (const key of ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID"]) {
    if (!/^\d{1,30}$/.test(env[key]?.trim() ?? "")) issues.push(key);
  }
  if (!/^v\d{1,3}\.\d{1,2}$/.test(env.WHATSAPP_API_VERSION?.trim() ?? ""))
    issues.push("WHATSAPP_API_VERSION");
  if (!/^[a-z0-9_]{1,512}$/.test(env.WHATSAPP_TEMPLATE_NAME?.trim() ?? ""))
    issues.push("WHATSAPP_TEMPLATE_NAME");
  if (!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() ?? ""))
    issues.push("WHATSAPP_TEMPLATE_LANGUAGE");
  if (!configuredWhatsAppOwner(env)) issues.push("ADMIN_WHATSAPP_NUMBER / OWNER_WHATSAPP");
  const timeout = Number(env.WHATSAPP_TIMEOUT_MS || 10000);
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 30000)
    issues.push("WHATSAPP_TIMEOUT_MS");
  return { enabled: true, configured: issues.length === 0, issues };
}

function templateText(value: string, maxLength: number): string {
  // Meta template parameters cannot contain line breaks or tabs. Keep the summary bounded.
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length > maxLength)
    throw new WhatsAppDeliveryError("invalid_template_parameter");
  return text;
}

function retryDelay(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(delay) && delay >= 0 ? Math.min(delay, 24 * 60 * 60 * 1000) : undefined;
}

/** Server-only transport. Inject fetch in tests; production always uses graph.facebook.com. */
export function createWhatsAppProvider(
  env: Environment = process.env,
  fetchImpl: typeof fetch = fetch,
): WhatsAppProvider {
  return {
    async sendNotification(input) {
      if (typeof window !== "undefined") throw new WhatsAppDeliveryError("server_only");
      const validation = validateWhatsAppConfiguration(env);
      if (!validation.configured)
        throw new WhatsAppDeliveryError(
          validation.enabled ? "configuration_invalid" : "provider_disabled",
        );
      const to = normalizeWhatsAppNumber(input.to);
      const owner = configuredWhatsAppOwner(env);
      if (!to || to !== owner) throw new WhatsAppDeliveryError("invalid_owner_recipient");
      if (!/^[A-Za-z0-9:_.-]{1,200}$/.test(input.idempotencyKey))
        throw new WhatsAppDeliveryError("invalid_event_key");
      const body = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        biz_opaque_callback_data: input.idempotencyKey,
        template: {
          name: env.WHATSAPP_TEMPLATE_NAME!.trim(),
          language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE!.trim() },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: templateText(input.subject, 160) },
                { type: "text", text: templateText(input.text, 700) },
              ],
            },
          ],
        },
      };
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        Number(env.WHATSAPP_TIMEOUT_MS || 10000),
      );
      try {
        const response = await fetchImpl(
          `https://graph.facebook.com/${env.WHATSAPP_API_VERSION!.trim()}/${env.WHATSAPP_PHONE_NUMBER_ID!.trim()}/messages`,
          {
            method: "POST",
            redirect: "error",
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN!.trim()}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          },
        );
        const data: unknown = await response.json().catch(() => null);
        const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
        if (!response.ok) {
          const error =
            record.error && typeof record.error === "object"
              ? (record.error as Record<string, unknown>)
              : {};
          const code = Number.isSafeInteger(error.code)
            ? `meta_${error.code}`
            : `http_${response.status}`;
          // A returned Graph error is a rejection. A bare 5xx can hide an accepted POST.
          const hasGraphError = Number.isSafeInteger(error.code);
          const rateLimited =
            typeof error.code === "number" && [4, 80007, 130429, 131056].includes(error.code);
          const retryable =
            response.status === 429 ||
            (hasGraphError &&
              (rateLimited || error.is_transient === true || response.status >= 500));
          const ambiguous = response.status >= 500 && !hasGraphError;
          throw new WhatsAppDeliveryError(
            code,
            retryable && !ambiguous,
            ambiguous,
            retryDelay(response.headers.get("retry-after")),
          );
        }
        const messages = Array.isArray(record.messages) ? record.messages : [];
        const id: unknown = messages[0]?.id;
        if (typeof id !== "string" || !id.trim() || id.length > 512)
          throw new WhatsAppDeliveryError("invalid_send_response", false, true);
        return { id };
      } catch (error) {
        if (error instanceof WhatsAppDeliveryError) throw error;
        // A timeout or broken connection does not prove Meta rejected the message.
        throw new WhatsAppDeliveryError(
          controller.signal.aborted ? "send_timeout" : "send_connection_unknown",
          false,
          true,
        );
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function sendWhatsAppNotification(input: WhatsAppNotification): Promise<{ id: string }> {
  return createWhatsAppProvider().sendNotification(input);
}
