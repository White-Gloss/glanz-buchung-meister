/**
 * E-MAIL-VERSAND (serverseitig)
 * -----------------------------
 * Versand über die HTTP-Schnittstelle von Resend – bewusst ohne zusätzliches
 * npm-Paket, damit die Abhängigkeitsliste schlank bleibt.
 *
 * GRUNDREGEL: Ein Fehler beim Mailversand darf NIEMALS eine Buchung
 * verhindern. Alle Funktionen hier fangen ihre Fehler selbst ab und melden
 * lediglich zurück, ob es geklappt hat.
 *
 * Benötigte Umgebungsvariablen (bei Hostinger zu hinterlegen):
 *   RESEND_API_KEY   – API-Schlüssel von resend.com
 *   MAIL_FROM        – Absender, z. B. "White Gloss Detailing <buchung@whitegloss.de>"
 *   MAIL_TO_OWNER    – Zieladresse für die interne Benachrichtigung
 *                      (optional; ohne Angabe wird company.email verwendet)
 */

import { calcLineItems, calcTotals, type Booking } from "./bookings";
import { company, currency, depositConfig, vatNotice } from "./servicesConfig";
import { getPickupCity } from "./pickupLocations";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type MailResult = { sent: boolean; reason?: string };

function config() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  const ownerTo = process.env.MAIL_TO_OWNER || company.email;
  return { apiKey, from, ownerTo };
}

/** true, wenn der Versand grundsätzlich eingerichtet ist. */
export function mailConfigured(): boolean {
  const { apiKey, from } = config();
  return Boolean(apiKey && from);
}

async function send(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<MailResult> {
  const { apiKey, from } = config();
  if (!apiKey || !from) {
    return { sent: false, reason: "RESEND_API_KEY oder MAIL_FROM fehlt" };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { sent: false, reason: `HTTP ${response.status} ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "Netzwerkfehler" };
  }
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

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

function bookingSummary(booking: Booking) {
  const items = calcLineItems(booking);
  const totals = calcTotals(items);
  const pickup = booking.pickupCity ? getPickupCity(booking.pickupCity) : undefined;
  return { items, totals, pickup };
}

/** Gemeinsames, bewusst schlichtes Layout – funktioniert in jedem Mailprogramm. */
function layout(headline: string, intro: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="de"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#71717a;">
      ${escapeHtml(company.name)}
    </p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(headline)}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${intro}</p>
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:28px 0 16px;">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">
      ${escapeHtml(company.name)} · ${escapeHtml(company.street)} · ${escapeHtml(company.city)}<br>
      Telefon ${escapeHtml(company.phone)} · <a href="mailto:${escapeHtml(company.email)}" style="color:#71717a;">${escapeHtml(company.email)}</a><br>
      <a href="${company.web}" style="color:#71717a;">${escapeHtml(company.web)}</a>
    </p>
  </div>
</body></html>`;
}

function itemsTableHtml(booking: Booking): string {
  const { items, totals, pickup } = bookingSummary(booking);
  const rows = items
    .map(
      (item) => `<tr>
        <td style="padding:6px 0;font-size:14px;">${escapeHtml(item.label)}</td>
        <td style="padding:6px 0;font-size:14px;text-align:right;white-space:nowrap;">${currency(item.total)}</td>
      </tr>`,
    )
    .join("");

  const depositRow =
    booking.depositStatus === "nicht_erforderlich"
      ? ""
      : `<tr>
          <td style="padding:6px 0;font-size:14px;color:#71717a;">
            Anzahlung (${Math.round(depositConfig.rate * 100)} %)
          </td>
          <td style="padding:6px 0;font-size:14px;text-align:right;color:#71717a;white-space:nowrap;">
            ${currency(Number(booking.depositAmount))}
          </td>
        </tr>`;

  return `
  <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#71717a;">Rechnungsnummer</td>
      <td style="padding:6px 0;font-size:14px;text-align:right;"><strong>${escapeHtml(booking.invoiceNumber)}</strong></td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#71717a;">Termin</td>
      <td style="padding:6px 0;font-size:14px;text-align:right;">${escapeHtml(formatDate(booking.date))}, ${escapeHtml(booking.time)} Uhr</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#71717a;">Kennzeichen</td>
      <td style="padding:6px 0;font-size:14px;text-align:right;">${escapeHtml(booking.customer.plate)}</td>
    </tr>
    ${
      pickup
        ? `<tr>
            <td style="padding:6px 0;font-size:14px;color:#71717a;">Abholort</td>
            <td style="padding:6px 0;font-size:14px;text-align:right;">${escapeHtml(pickup.name)} (${pickup.distanceKm} km)</td>
          </tr>`
        : ""
    }
  </table>

  <table style="width:100%;border-collapse:collapse;border-top:1px solid #e4e4e7;margin:0 0 8px;">
    ${rows}
    <tr>
      <td style="padding:12px 0 0;font-size:16px;border-top:1px solid #e4e4e7;"><strong>Gesamt</strong></td>
      <td style="padding:12px 0 0;font-size:16px;text-align:right;border-top:1px solid #e4e4e7;white-space:nowrap;">
        <strong>${currency(totals.gross)}</strong>
      </td>
    </tr>
    ${depositRow}
  </table>
  <p style="margin:0 0 20px;font-size:12px;color:#71717a;">${escapeHtml(vatNotice())}</p>`;
}

function itemsTableText(booking: Booking): string {
  const { items, totals, pickup } = bookingSummary(booking);
  const lines = [
    `Rechnungsnummer: ${booking.invoiceNumber}`,
    `Termin: ${formatDate(booking.date)}, ${booking.time} Uhr`,
    `Kennzeichen: ${booking.customer.plate}`,
  ];
  if (pickup) lines.push(`Abholort: ${pickup.name} (${pickup.distanceKm} km)`);
  lines.push("");
  items.forEach((item) => lines.push(`${item.label}: ${currency(item.total)}`));
  lines.push(`Gesamt: ${currency(totals.gross)}`);
  if (booking.depositStatus !== "nicht_erforderlich") {
    lines.push(`Anzahlung: ${currency(Number(booking.depositAmount))}`);
  }
  lines.push(vatNotice());
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* 1) Bestätigung an den Kunden                                        */
/* ------------------------------------------------------------------ */

export async function sendCustomerConfirmation(booking: Booking): Promise<MailResult> {
  const firstName = booking.customer.name.split(" ")[0] || booking.customer.name;
  const depositHint =
    booking.depositStatus === "nicht_erforderlich"
      ? '<p style="margin:0 0 20px;font-size:14px;line-height:1.6;">Eine Anzahlung ist für diesen Termin nicht erforderlich.</p>'
      : `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;">
           Da wir Sie noch nicht als Kundin oder Kunden führen, bitten wir um eine Anzahlung von
           <strong>${currency(Number(booking.depositAmount))}</strong>. Wie und bis wann,
           teilen wir Ihnen mit der Terminbestätigung mit.
         </p>`;

  const html = layout(
    "Ihre Terminanfrage ist eingegangen",
    `Hallo ${escapeHtml(firstName)}, vielen Dank für Ihre Anfrage. Wir melden uns zeitnah mit der verbindlichen Bestätigung. <strong>Dieser Termin ist noch nicht final zugesagt.</strong>`,
    itemsTableHtml(booking) +
      depositHint +
      `<p style="margin:0;font-size:14px;line-height:1.6;">
         Etwas stimmt nicht oder Sie möchten den Termin ändern? Antworten Sie einfach auf diese
         E-Mail oder rufen Sie an unter ${escapeHtml(company.phone)}.
       </p>`,
  );

  const text = [
    `Hallo ${firstName},`,
    "",
    "vielen Dank für Ihre Terminanfrage. Wir melden uns zeitnah mit der",
    "verbindlichen Bestätigung. Dieser Termin ist noch nicht final zugesagt.",
    "",
    itemsTableText(booking),
    "",
    booking.depositStatus === "nicht_erforderlich"
      ? "Eine Anzahlung ist für diesen Termin nicht erforderlich."
      : `Anzahlung erforderlich: ${currency(Number(booking.depositAmount))}. Details folgen mit der Bestätigung.`,
    "",
    `Rückfragen: ${company.phone} oder Antwort auf diese E-Mail.`,
    "",
    `${company.name} · ${company.street} · ${company.city}`,
  ].join("\n");

  return send({
    to: booking.customer.email,
    subject: `Ihre Terminanfrage ${booking.invoiceNumber} – ${company.name}`,
    html,
    text,
    replyTo: company.email,
  });
}

/* ------------------------------------------------------------------ */
/* 2) Benachrichtigung an den Betrieb                                  */
/* ------------------------------------------------------------------ */

export async function sendOwnerNotification(booking: Booking): Promise<MailResult> {
  const { ownerTo } = config();
  const { pickup } = bookingSummary(booking);

  const html = layout(
    `Neue Anfrage: ${booking.customer.name}`,
    `${escapeHtml(formatDate(booking.date))} um ${escapeHtml(booking.time)} Uhr${
      pickup ? ` · Abholung in ${escapeHtml(pickup.name)}` : ""
    }`,
    `<table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
       <tr><td style="padding:6px 0;font-size:14px;color:#71717a;">Name</td>
           <td style="padding:6px 0;font-size:14px;text-align:right;">${escapeHtml(booking.customer.name)}</td></tr>
       <tr><td style="padding:6px 0;font-size:14px;color:#71717a;">E-Mail</td>
           <td style="padding:6px 0;font-size:14px;text-align:right;"><a href="mailto:${escapeHtml(booking.customer.email)}">${escapeHtml(booking.customer.email)}</a></td></tr>
       <tr><td style="padding:6px 0;font-size:14px;color:#71717a;">Telefon</td>
           <td style="padding:6px 0;font-size:14px;text-align:right;"><a href="tel:${escapeHtml(booking.customer.phone)}">${escapeHtml(booking.customer.phone)}</a></td></tr>
       <tr><td style="padding:6px 0;font-size:14px;color:#71717a;">Kundenstatus</td>
           <td style="padding:6px 0;font-size:14px;text-align:right;">${booking.isNewCustomer ? "Neukunde" : "Bestandskunde"}</td></tr>
     </table>` +
      itemsTableHtml(booking) +
      `<p style="margin:0;font-size:14px;">
         <a href="${company.web}/admin" style="display:inline-block;background:#18181b;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;">
           Im Admin-Bereich öffnen
         </a>
       </p>`,
  );

  const text = [
    `Neue Terminanfrage – ${booking.customer.name}`,
    "",
    `Name:     ${booking.customer.name}`,
    `E-Mail:   ${booking.customer.email}`,
    `Telefon:  ${booking.customer.phone}`,
    `Status:   ${booking.isNewCustomer ? "Neukunde" : "Bestandskunde"}`,
    "",
    itemsTableText(booking),
    "",
    `Admin: ${company.web}/admin`,
  ].join("\n");

  return send({
    to: ownerTo,
    subject: `Neue Anfrage ${booking.invoiceNumber} · ${booking.customer.name} · ${formatDate(booking.date)}`,
    html,
    text,
    replyTo: booking.customer.email,
  });
}

/* ------------------------------------------------------------------ */
/* Sammelaufruf                                                        */
/* ------------------------------------------------------------------ */

/**
 * Verschickt beide E-Mails. Wirft nie – Fehler werden protokolliert, damit
 * eine gestörte Zustellung die Buchung nicht gefährdet.
 */
export async function sendBookingMails(booking: Booking): Promise<void> {
  if (!mailConfigured()) {
    console.warn(
      `[mail] Versand nicht konfiguriert – keine E-Mail zu ${booking.invoiceNumber} verschickt.`,
    );
    return;
  }

  const [customer, owner] = await Promise.all([
    sendCustomerConfirmation(booking),
    sendOwnerNotification(booking),
  ]);

  if (!customer.sent) console.error(`[mail] Kundenmail fehlgeschlagen: ${customer.reason}`);
  if (!owner.sent) console.error(`[mail] Betriebsmail fehlgeschlagen: ${owner.reason}`);
}
