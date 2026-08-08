import type { Booking } from "./bookings";
import { calcLineItems } from "./bookings";
import { company, currency, servicePackages, vehicleTypes } from "./servicesConfig";
import { getPickupCity } from "./pickupLocations";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type AutomationMailResult = { sent: boolean; reason?: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function layout(headline: string, intro: string, body: string) {
  return `<!doctype html>
<html lang="de"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#71717a;">${escapeHtml(company.name)}</p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(headline)}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${intro}</p>
    ${body}
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:28px 0 16px;">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">
      ${escapeHtml(company.name)} · ${escapeHtml(company.street)} · ${escapeHtml(company.city)}<br>
      Telefon ${escapeHtml(company.phone)} · ${escapeHtml(company.email)}
    </p>
  </div>
</body></html>`;
}

async function send(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  attachment?: { filename: string; content: string };
}): Promise<AutomationMailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!apiKey || !from) return { sent: false, reason: "RESEND_API_KEY oder MAIL_FROM fehlt" };

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": params.idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        reply_to: company.email,
        ...(params.attachment ? { attachments: [params.attachment] } : {}),
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { sent: false, reason: `HTTP ${response.status} ${body.slice(0, 500)}` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "Netzwerkfehler" };
  }
}

export async function sendLexwareInvoiceEmail(params: {
  booking: Booking;
  invoiceId: string;
  invoiceNumber: string | null;
  pdf: Buffer;
}): Promise<AutomationMailResult> {
  const { booking, invoiceId, invoiceNumber, pdf } = params;
  const number = invoiceNumber || booking.invoiceNumber;
  const firstName = booking.customer.name.split(/\s+/)[0] || booking.customer.name;
  const lines = calcLineItems(booking);
  const itemsHtml = lines
    .map(
      (item) =>
        `<tr><td style="padding:7px 0;font-size:14px;">${escapeHtml(item.label)}</td><td style="padding:7px 0;font-size:14px;text-align:right;">${escapeHtml(currency(item.total))}</td></tr>`,
    )
    .join("");

  const html = layout(
    `Ihre Rechnung ${number}`,
    `Hallo ${escapeHtml(firstName)}, im Anhang finden Sie Ihre Rechnung für den bestätigten Termin am <strong>${escapeHtml(formatDate(booking.date))}</strong>.`,
    `<table style="width:100%;border-collapse:collapse;margin:0 0 20px;">${itemsHtml}
       <tr><td style="padding:10px 0 0;font-weight:700;border-top:1px solid #e4e4e7;">Gesamt</td><td style="padding:10px 0 0;text-align:right;font-weight:700;border-top:1px solid #e4e4e7;">${escapeHtml(currency(booking.total))}</td></tr>
     </table>
     <p style="margin:0;font-size:14px;line-height:1.6;">Die PDF-Rechnung wurde direkt aus Lexware erzeugt. Bei Rückfragen antworten Sie einfach auf diese E-Mail.</p>`,
  );
  const text = [
    `Hallo ${firstName},`,
    "",
    `im Anhang finden Sie Ihre Rechnung ${number}.`,
    `Termin: ${formatDate(booking.date)}`,
    `Gesamt: ${currency(booking.total)}`,
    "",
    "Bei Rückfragen antworten Sie einfach auf diese E-Mail.",
    company.name,
  ].join("\n");

  return send({
    to: booking.customer.email,
    subject: `Rechnung ${number} – ${company.name}`,
    html,
    text,
    idempotencyKey: `whitegloss-invoice-${booking.id}-${invoiceId}`,
    attachment: {
      filename: `Rechnung_${number.replace(/[^a-z0-9._-]+/gi, "-")}.pdf`,
      content: pdf.toString("base64"),
    },
  });
}

export async function sendAppointmentReminder(booking: Booking): Promise<AutomationMailResult> {
  const firstName = booking.customer.name.split(/\s+/)[0] || booking.customer.name;
  const pkg = servicePackages.find((item) => item.id === booking.packageId);
  const vehicle = vehicleTypes.find((item) => item.id === booking.vehicleId);
  const pickup = booking.pickupCity ? getPickupCity(booking.pickupCity) : undefined;
  const place = pickup
    ? `Wir holen Ihr Fahrzeug in ${pickup.name} ab. Den genauen Ablauf stimmen wir wie vereinbart ab.`
    : `Adresse: ${company.street}, ${company.city}.`;

  const html = layout(
    "Erinnerung an Ihren Termin",
    `Hallo ${escapeHtml(firstName)}, Ihr Termin bei ${escapeHtml(company.name)} steht bald an.`,
    `<table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
      <tr><td style="padding:6px 0;color:#71717a;">Datum</td><td style="padding:6px 0;text-align:right;">${escapeHtml(formatDate(booking.date))}</td></tr>
      <tr><td style="padding:6px 0;color:#71717a;">Leistung</td><td style="padding:6px 0;text-align:right;">${escapeHtml(pkg?.name ?? booking.packageId)}</td></tr>
      <tr><td style="padding:6px 0;color:#71717a;">Fahrzeug</td><td style="padding:6px 0;text-align:right;">${escapeHtml(vehicle?.name ?? booking.vehicleId)} · ${escapeHtml(booking.customer.plate)}</td></tr>
    </table>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${escapeHtml(place)}</p>
    <p style="margin:0;font-size:14px;line-height:1.6;">Falls Sie den Termin nicht wahrnehmen können, melden Sie sich bitte möglichst frühzeitig unter ${escapeHtml(company.phone)} oder antworten Sie auf diese E-Mail.</p>`,
  );
  const text = [
    `Hallo ${firstName},`,
    "",
    `Ihr Termin bei ${company.name} steht bald an.`,
    formatDate(booking.date),
    `Leistung: ${pkg?.name ?? booking.packageId}`,
    `Kennzeichen: ${booking.customer.plate}`,
    place,
    "",
    `Änderungen: ${company.phone} oder Antwort auf diese E-Mail.`,
  ].join("\n");

  return send({
    to: booking.customer.email,
    subject: `Terminerinnerung: ${formatDate(booking.date)} – ${company.name}`,
    html,
    text,
    idempotencyKey: `whitegloss-reminder-${booking.id}-${booking.date}`,
  });
}
