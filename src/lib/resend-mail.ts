export function mailConfigured(): boolean {
  const key = (process.env.RESEND_API_KEY || "").trim();
  const from = (process.env.MAIL_FROM || "").trim();
  return key.length > 0 && from.length > 0;
}

export async function sendResendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ id?: string }> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const from = (process.env.MAIL_FROM || "").trim();
  if (!apiKey || !from) {
    throw new Error("E-Mail-Versand ist nicht konfiguriert (RESEND_API_KEY / MAIL_FROM).");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[resend-mail] Versand fehlgeschlagen", response.status, detail.slice(0, 300));
    throw new Error("E-Mail konnte nicht über Resend versendet werden.");
  }

  const body = (await response.json().catch(() => null)) as { id?: string } | null;
  return { id: body?.id };
}
