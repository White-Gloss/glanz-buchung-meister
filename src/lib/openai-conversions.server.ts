import { createHash } from "node:crypto";
import { OPENAI_CONSENT_VERSION, type OpenAiMeasurement } from "./openai-measurement.ts";

/** Explicit allowlist. Never accept a booking object or forward request headers. */
export async function reportOpenAiLead(
  requestId: string,
  measurement: OpenAiMeasurement | undefined,
  options: {
    apiKey?: string;
    pixelId?: string;
    fetch?: typeof fetch;
    now?: number;
    validateOnly?: boolean;
  } = {},
): Promise<"disabled" | "sent" | "failed"> {
  const apiKey = options.apiKey ?? process.env.OPENAI_CONVERSIONS_API_KEY;
  const pixelId = options.pixelId ?? process.env.OPENAI_CONVERSIONS_PIXEL_ID;
  if (measurement?.consent !== OPENAI_CONSENT_VERSION || !apiKey || !pixelId) return "disabled";
  const event = {
    // The request UUID is also an upload capability: never disclose it directly.
    id: createHash("sha256").update(`openai-lead:${requestId}`).digest("hex"),
    type: "lead_created",
    timestamp_ms: options.now ?? Date.now(),
    source_url: "https://white-gloss.de/",
    action_source: "web",
    opt_out: true,
    ...(measurement.oppref ? { oppref: measurement.oppref } : {}),
    data: { type: "customer_action" },
  };
  try {
    const response = await (options.fetch ?? fetch)(
      `https://bzr.openai.com/v1/events?pid=${encodeURIComponent(pixelId)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ validate_only: options.validateOnly === true, events: [event] }),
        signal: AbortSignal.timeout(2000),
        redirect: "error",
      },
    );
    return response.ok ? "sent" : "failed";
  } catch {
    // Measurement failure must never reject an already committed customer request.
    return "failed";
  }
}
