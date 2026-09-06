export function mailConfigured(): boolean {
  const key = (process.env.RESEND_API_KEY || "").trim();
  const from = (process.env.MAIL_FROM || "").trim();
  return key.length > 0 && from.length > 0;
}

export class EmailDeliveryError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly ambiguous: boolean;
  constructor(code: string, retryable: boolean, ambiguous = false) {
    super(code);
    this.name = "EmailDeliveryError";
    this.code = code;
    this.retryable = retryable;
    this.ambiguous = ambiguous;
  }
}

export async function sendResendEmail(input: {
  to: string;
  subject: string;
  text: string;
  idempotencyKey?: string;
  from?: string;
}): Promise<{ id: string }> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const from = (input.from || process.env.MAIL_FROM || "").trim();
  if (!apiKey || !from) {
    throw new EmailDeliveryError("email_not_configured", false);
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
  } catch {
    throw new EmailDeliveryError("email_transport_unknown", true, true);
  }

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { name?: string } | null;
    const concurrent = response.status === 409 && detail?.name === "concurrent_idempotent_requests";
    throw new EmailDeliveryError(
      `email_http_${response.status}`,
      concurrent || response.status === 408 || response.status === 429 || response.status >= 500,
    );
  }

  const body = (await response.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id || typeof body.id !== "string") {
    throw new EmailDeliveryError("email_response_unknown", true, true);
  }
  return { id: body.id };
}
