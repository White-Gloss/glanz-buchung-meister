import { createHash } from "node:crypto";
import type { Sql } from "./db.ts";
import { EmailDeliveryError } from "./resend-mail.ts";

export const BOOKING_SENDER = "White-Gloss Detailing <buchung@white-gloss.de>";
export const BOOKING_MAILBOX = "buchung@white-gloss.de";

export async function ensureIonosMailSchema(sql: Sql) {
  await sql`alter table shop_settings add column if not exists booking_ionos_password text`;
  await sql`alter table shop_settings add column if not exists booking_ionos_enabled boolean not null default false`;
  await sql`alter table outbound_queue add column if not exists email_provider text not null default 'resend'`;
}

export async function ionosMailConfig(sql: Sql) {
  await ensureIonosMailSchema(sql);
  const [row] = await sql<{
    booking_ionos_password: string | null;
    booking_ionos_enabled: boolean;
  }>`
    select booking_ionos_password, booking_ionos_enabled from shop_settings where shop_id='white-gloss'
  `;
  const password = process.env.BOOKING_IONOS_PASSWORD || row?.booking_ionos_password || "";
  return { password, enabled: row?.booking_ionos_enabled === true && Boolean(password) };
}

async function transport(password: string) {
  if (!password) throw new EmailDeliveryError("ionos_not_configured", false);
  const { default: nodemailer } = await import("nodemailer");
  return nodemailer.createTransport({
    host: "smtp.ionos.de",
    port: 465,
    secure: true,
    auth: { user: BOOKING_MAILBOX, pass: password },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 25_000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
}

/** Verifies credentials without sending any email. Never returns SMTP diagnostics or secrets. */
export async function verifyIonosMailbox(password: string) {
  const smtp = await transport(password);
  try {
    await smtp.verify();
  } catch {
    throw new Error(
      "IONOS-Anmeldung fehlgeschlagen. Bitte das Passwort für buchung@white-gloss.de prüfen.",
    );
  } finally {
    smtp.close();
  }
}

export async function sendIonosEmail(
  sql: Sql,
  input: {
    to: string;
    subject: string;
    text: string;
    idempotencyKey: string;
    attachments?: { filename: string; content: string; content_type: string }[];
  },
): Promise<{ id: string }> {
  const config = await ionosMailConfig(sql);
  if (!config.enabled) throw new EmailDeliveryError("ionos_not_configured", false);
  if (
    !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(input.to) ||
    /[\r\n]/.test(input.subject) ||
    !input.idempotencyKey
  )
    throw new EmailDeliveryError("ionos_invalid_message", false);
  const smtp = await transport(config.password);
  // Message-ID helps reconciliation, but is NOT provider-side deduplication.
  const id = `<wg-${createHash("sha256").update(input.idempotencyKey).digest("hex")}@white-gloss.de>`;
  try {
    const result = await smtp.sendMail({
      from: BOOKING_SENDER,
      to: input.to,
      subject: input.subject,
      text: input.text,
      messageId: id,
      attachments: input.attachments?.map((file) => ({
        filename: file.filename,
        content: Buffer.from(file.content, "base64"),
        contentType: file.content_type,
      })),
    });
    if (
      !result.accepted?.some(
        (address: unknown) => String(address).toLowerCase() === input.to.toLowerCase(),
      )
    )
      throw new EmailDeliveryError("ionos_response_unknown", false, true);
    return { id };
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error;
    const code = (error as { code?: string })?.code;
    if (code === "EAUTH") throw new EmailDeliveryError("ionos_auth_failed", false);
    // SMTP cannot safely replay a request after connection loss or a lost final reply.
    // Preserve it for reconciliation; do not retry based on the fixed Message-ID.
    throw new EmailDeliveryError("ionos_transport_unknown", false, true);
  } finally {
    smtp.close();
  }
}
