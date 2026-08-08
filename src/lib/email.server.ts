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

import { calcLineItems, calcTotals, TIME_NOTICE, type Booking } from "./bookings";
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

/**
 * Zustand der Konfiguration für die Anzeige im Admin-Bereich.
 *
 * Gibt bewusst NUR zurück, ob ein Schlüssel gesetzt ist — niemals seinen
 * Wert, auch nicht gekürzt. Absender und interne Zieladresse sind dagegen
 * keine Geheimnisse: sie stehen in jeder versendeten Mail.
 */
export function mailSettingsSummary(): {
  apiKeySet: boolean;
  from: string | null;
  ownerTo: string | null;
} {
  const { apiKey, from, ownerTo } = config();
  return { apiKeySet: Boolean(apiKey), from: from || null, ownerTo: ownerTo || null };
}

/**
 * Testmail an eine bereits geprüfte Adresse.
 *
 * Der Aufrufer verantwortet, dass die Adresse dem angemeldeten
 * Administrator gehört — siehe mailDiagnostics.functions.ts.
 */
export async function sendMailSelfTestTo(to: string): Promise<MailResult> {
  const zeitpunkt = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
  const text = [
    "Diese Testmail bestätigt, dass der E-Mail-Versand der Website funktioniert.",
    "",
    `Gesendet am ${zeitpunkt}.`,
    "",
    "Kommt diese Nachricht an, erhalten Kundinnen und Kunden auch die",
    "Eingangsbestätigung und die Terminbestätigung.",
  ].join("\n");

  return send({
    to,
    subject: `Testmail – ${company.name}`,
    html: layout(
      "E-Mail-Versand funktioniert",
      "Diese Testmail wurde aus dem Admin-Bereich ausgelöst.",
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Gesendet am ${escapeHtml(zeitpunkt)}.</p>
       <p style="margin:0;font-size:15px;line-height:1.6;">Kommt diese Nachricht an, erhalten Kundinnen und Kunden auch die Eingangsbestätigung und die Terminbestätigung.</p>`,
    ),
    text,
  });
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
      <td style="padding:6px 0;font-size:14px;text-align:right;">${escapeHtml(formatDate(booking.date))}</td>
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
        <strong>${currency(booking.agreedPrice ?? totals.gross)}</strong>
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
    `Termin: ${formatDate(booking.date)}`,
    `Kennzeichen: ${booking.customer.plate}`,
  ];
  if (pickup) lines.push(`Abholort: ${pickup.name} (${pickup.distanceKm} km)`);
  lines.push("");
  items.forEach((item) => lines.push(`${item.label}: ${currency(item.total)}`));
  lines.push(`Gesamt: ${currency(booking.agreedPrice ?? totals.gross)}`);
  if (booking.depositStatus !== "nicht_erforderlich") {
    lines.push(`Anzahlung: ${currency(Number(booking.depositAmount))}`);
  }
  lines.push(vatNotice());
  return lines.join("\n");
}

/**
 * Pflichthinweis in JEDER Kunden-Mail: Termine sind datumsbasiert, die
 * Uhrzeit wird wenige Tage vorher persönlich abgestimmt.
 */
const timeNoticeHtml = `<p style="margin:0 0 20px;padding:12px 14px;background:#f4f4f5;border-radius:8px;font-size:14px;line-height:1.6;">
  ${escapeHtml(TIME_NOTICE)}
</p>`;

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
      timeNoticeHtml +
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
    TIME_NOTICE,
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

/**
 * Verbindliche Terminbestätigung an den Kunden.
 *
 * Geht raus, wenn der Status im Admin-Bereich auf „Bestätigt" wechselt.
 * Vorher erhält der Kunde nur die Eingangsbestätigung mit dem
 * ausdrücklichen Hinweis, dass der Termin noch nicht zugesagt ist — ohne
 * diese zweite Mail bliebe er auf ebendiesem Stand sitzen.
 */
export async function sendBookingConfirmed(booking: Booking): Promise<MailResult> {
  const firstName = booking.customer.name.split(" ")[0] || booking.customer.name;
  const { pickup } = bookingSummary(booking);

  const treffpunkt = pickup
    ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;">
         Wir holen Ihr Fahrzeug in <strong>${escapeHtml(pickup.name)}</strong> ab. Den genauen
         Ablauf stimmen wir vorab telefonisch mit Ihnen ab.
       </p>`
    : `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;">
         Bitte bringen Sie das Fahrzeug zum vereinbarten Termin zu uns:<br>
         <strong>${escapeHtml(company.street)}, ${escapeHtml(company.city)}</strong>
       </p>`;

  const anzahlung =
    booking.depositStatus === "nicht_erforderlich"
      ? ""
      : `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;">
           Offen ist noch die Anzahlung von
           <strong>${currency(Number(booking.depositAmount))}</strong>. Wir melden uns dazu
           gesondert bei Ihnen.
         </p>`;

  const html = layout(
    "Ihr Termin ist bestätigt",
    `Hallo ${escapeHtml(firstName)}, wir haben Ihren Termin fest eingeplant. <strong>Diese Bestätigung ist verbindlich.</strong>`,
    itemsTableHtml(booking) +
      timeNoticeHtml +
      treffpunkt +
      anzahlung +
      `<p style="margin:0;font-size:14px;line-height:1.6;">
         Sie müssen den Termin verschieben oder absagen? Antworten Sie einfach auf diese E-Mail
         oder rufen Sie an unter ${escapeHtml(company.phone)}. Bitte geben Sie uns möglichst
         frühzeitig Bescheid.
       </p>`,
  );

  const text = [
    `Hallo ${firstName},`,
    "",
    "wir haben Ihren Termin fest eingeplant. Diese Bestätigung ist verbindlich.",
    "",
    itemsTableText(booking),
    "",
    TIME_NOTICE,
    "",
    pickup
      ? `Wir holen Ihr Fahrzeug in ${pickup.name} ab. Den Ablauf stimmen wir vorab telefonisch ab.`
      : `Bitte bringen Sie das Fahrzeug zu uns: ${company.street}, ${company.city}`,
    ...(booking.depositStatus === "nicht_erforderlich"
      ? []
      : ["", `Offene Anzahlung: ${currency(Number(booking.depositAmount))}. Details folgen.`]),
    "",
    `Verschieben oder absagen: ${company.phone} oder Antwort auf diese E-Mail.`,
    "",
    `${company.name} · ${company.street} · ${company.city}`,
  ].join("\n");

  return send({
    to: booking.customer.email,
    subject: `Termin bestätigt: ${formatDate(booking.date)} – ${company.name}`,
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
    `${escapeHtml(formatDate(booking.date))}${
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

/* ------------------------------------------------------------------ */
/* Zustandsmeldungen                                                   */
/* ------------------------------------------------------------------ */

export type ConditionReportMail = {
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  plate: string;
  conditionText: string;
  photoCount: number;
};

/**
 * Benachrichtigt den Betrieb über eine neue Zustandsmeldung.
 *
 * Die Fotos werden BEWUSST NICHT angehängt, sondern nur gezählt. Zwei
 * Gründe: Acht Bilder zu je 8 MB sprengen jedes Postfach, und die Fotos
 * liegen absichtlich in einem privaten Speicher — als Mailanhang lägen
 * sie unverschlüsselt beim Mailanbieter und in jedem weitergeleiteten
 * Postfach. Die Mail verlinkt deshalb in den Admin-Bereich, wo sie über
 * kurzlebige signierte Links angezeigt werden.
 *
 * Antworten geht direkt an den Interessenten (reply_to).
 */
export async function sendConditionReportNotification(
  report: ConditionReportMail,
): Promise<MailResult> {
  const { ownerTo } = config();

  const fotoText = report.photoCount === 1 ? "1 Foto" : `${report.photoCount} Fotos`;

  const zeile = (bezeichnung: string, wert: string) =>
    `<tr><td style="padding:6px 0;font-size:14px;color:#71717a;">${escapeHtml(bezeichnung)}</td>
         <td style="padding:6px 0;font-size:14px;text-align:right;">${wert}</td></tr>`;

  const html = layout(
    `Zustandsmeldung: ${report.name}`,
    `${escapeHtml(fotoText)} und eine Beschreibung sind eingegangen.`,
    `<table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
       ${zeile("Name", escapeHtml(report.name))}
       ${zeile("E-Mail", `<a href="mailto:${escapeHtml(report.email)}">${escapeHtml(report.email)}</a>`)}
       ${report.phone ? zeile("Telefon", `<a href="tel:${escapeHtml(report.phone.replace(/\s/g, ""))}">${escapeHtml(report.phone)}</a>`) : ""}
       ${report.vehicle ? zeile("Fahrzeug", escapeHtml(report.vehicle)) : ""}
       ${report.plate ? zeile("Kennzeichen", escapeHtml(report.plate)) : ""}
       ${zeile("Fotos", escapeHtml(fotoText))}
     </table>
     <p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#71717a;">
       Beschreibung des Kunden
     </p>
     <p style="margin:0 0 24px;padding:14px 16px;background:#f4f4f5;border-radius:8px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(
       report.conditionText,
     )}</p>
     <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#71717a;">
       Die Fotos sind aus Datenschutzgründen nicht angehängt. Sie sind im Admin-Bereich hinterlegt.
     </p>
     <p style="margin:0;font-size:14px;">
       <a href="${company.web}/admin/zustand" style="display:inline-block;background:#18181b;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;">
         Meldung mit Fotos ansehen
       </a>
     </p>`,
  );

  const text = [
    `Neue Zustandsmeldung – ${report.name}`,
    "",
    `Name:     ${report.name}`,
    `E-Mail:   ${report.email}`,
    ...(report.phone ? [`Telefon:  ${report.phone}`] : []),
    ...(report.vehicle ? [`Fahrzeug: ${report.vehicle}`] : []),
    ...(report.plate ? [`Kennz.:   ${report.plate}`] : []),
    `Fotos:    ${fotoText}`,
    "",
    "Beschreibung:",
    report.conditionText,
    "",
    "Die Fotos sind aus Datenschutzgründen nicht angehängt.",
    `Ansehen: ${company.web}/admin/zustand`,
  ].join("\n");

  return send({
    to: ownerTo,
    subject: `Zustandsmeldung · ${report.name}${report.vehicle ? ` · ${report.vehicle}` : ""}`,
    html,
    text,
    replyTo: report.email,
  });
}

/* ------------------------------------------------------------------ */
/* 4) Gegenangebot an den Kunden                                       */
/* ------------------------------------------------------------------ */

/**
 * Gegenangebot: angepasster Preis mit Begründung und bis zu drei
 * Ersatzterminen.
 *
 * Jeder Termin ist ein Link mit dem Zugriffstoken der Buchung. Ein Klick
 * gilt als Zusage — deshalb steht neben jedem Datum, was er auslöst, und
 * die Links führen auf eine Seite, die den Termin noch einmal zeigt,
 * bevor sie ihn festschreibt. Reine Ein-Klick-Bestätigung wäre riskant:
 * Mailprogramme laden Links teils selbst vor.
 */
export async function sendCounterOfferMail(booking: Booking): Promise<MailResult> {
  const firstName = booking.customer.name.split(" ")[0] || booking.customer.name;
  const preis = booking.agreedPrice ?? booking.total;
  const termine = [booking.date, ...booking.offerAltDates];

  const link = (datum: string) =>
    `${company.web.replace(/\/$/, "")}/angebot/${booking.accessToken}?termin=${datum}`;

  const buttons = termine
    .map((datum, index) => {
      const label = index === 0 ? "Ihr Wunschtermin" : `Ersatztermin ${index}`;
      return `<tr><td style="padding:0 0 10px;">
        <a href="${link(datum)}"
           style="display:block;padding:14px 18px;background:${index === 0 ? "#18181b" : "#ffffff"};
                  color:${index === 0 ? "#ffffff" : "#18181b"};border:1px solid #18181b;
                  border-radius:8px;text-decoration:none;font-size:15px;">
          <strong>${escapeHtml(formatDate(datum))}</strong><br>
          <span style="font-size:12px;opacity:.75;">${escapeHtml(label)} – hier auswählen</span>
        </a>
      </td></tr>`;
    })
    .join("");

  const html = layout(
    "Unser Angebot für Ihr Fahrzeug",
    `Hallo ${escapeHtml(firstName)}, wir haben Ihre Anfrage geprüft und schicken Ihnen hier unser Angebot. <strong>Verbindlich wird es erst, wenn Sie einen Termin auswählen.</strong>`,
    `<table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
       <tr>
         <td style="padding:6px 0;font-size:14px;color:#71717a;">Rechnungsnummer</td>
         <td style="padding:6px 0;font-size:14px;text-align:right;"><strong>${escapeHtml(booking.invoiceNumber)}</strong></td>
       </tr>
       <tr>
         <td style="padding:6px 0;font-size:14px;color:#71717a;">Kennzeichen</td>
         <td style="padding:6px 0;font-size:14px;text-align:right;">${escapeHtml(booking.customer.plate)}</td>
       </tr>
       <tr>
         <td style="padding:12px 0 0;font-size:16px;border-top:1px solid #e4e4e7;"><strong>Angebotspreis</strong></td>
         <td style="padding:12px 0 0;font-size:16px;text-align:right;border-top:1px solid #e4e4e7;white-space:nowrap;">
           <strong>${currency(preis)}</strong>
         </td>
       </tr>
     </table>
     <p style="margin:0 0 20px;font-size:12px;color:#71717a;">${escapeHtml(vatNotice())}</p>
     ${
       booking.offerNote
         ? `<p style="margin:0 0 20px;padding:12px 14px;background:#f4f4f5;border-radius:8px;font-size:14px;line-height:1.6;">
              <strong>Warum dieser Preis:</strong><br>${escapeHtml(booking.offerNote)}
            </p>`
         : ""
     }
     <p style="margin:0 0 12px;font-size:15px;line-height:1.6;"><strong>Bitte wählen Sie einen Termin:</strong></p>
     <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">${buttons}</table>
     ${timeNoticeHtml}
     <p style="margin:0;font-size:14px;line-height:1.6;">
       Passt nichts davon? Antworten Sie einfach auf diese E-Mail oder rufen Sie an unter
       ${escapeHtml(company.phone)} – wir finden einen Termin.
     </p>`,
  );

  const text = [
    `Hallo ${firstName},`,
    "",
    "wir haben Ihre Anfrage geprüft. Verbindlich wird das Angebot erst,",
    "wenn Sie einen Termin auswählen.",
    "",
    `Rechnungsnummer: ${booking.invoiceNumber}`,
    `Kennzeichen: ${booking.customer.plate}`,
    `Angebotspreis: ${currency(preis)}`,
    vatNotice(),
    ...(booking.offerNote ? ["", `Warum dieser Preis: ${booking.offerNote}`] : []),
    "",
    "Bitte wählen Sie einen Termin:",
    ...termine.map(
      (datum, index) =>
        `${index === 0 ? "Ihr Wunschtermin" : `Ersatztermin ${index}`}: ${formatDate(datum)}\n  ${link(datum)}`,
    ),
    "",
    TIME_NOTICE,
    "",
    `Passt nichts davon? ${company.phone} oder Antwort auf diese E-Mail.`,
    "",
    `${company.name} · ${company.street} · ${company.city}`,
  ].join("\n");

  return send({
    to: booking.customer.email,
    subject: `Unser Angebot zu ${booking.invoiceNumber} – ${company.name}`,
    html,
    text,
    replyTo: company.email,
  });
}

/* ------------------------------------------------------------------ */
/* 5) Zusage des Kunden an den Betrieb                                 */
/* ------------------------------------------------------------------ */

export async function sendOfferAcceptedToOwner(booking: Booking): Promise<MailResult> {
  const { ownerTo } = config();
  const preis = booking.agreedPrice ?? booking.total;

  const html = layout(
    `Zusage: ${booking.customer.name}`,
    `${escapeHtml(formatDate(booking.date))} · ${currency(preis)}`,
    `<table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
       <tr><td style="padding:6px 0;font-size:14px;color:#71717a;">Rechnungsnummer</td>
           <td style="padding:6px 0;font-size:14px;text-align:right;">${escapeHtml(booking.invoiceNumber)}</td></tr>
       <tr><td style="padding:6px 0;font-size:14px;color:#71717a;">Kennzeichen</td>
           <td style="padding:6px 0;font-size:14px;text-align:right;">${escapeHtml(booking.customer.plate)}</td></tr>
       <tr><td style="padding:6px 0;font-size:14px;color:#71717a;">Kontakt bevorzugt</td>
           <td style="padding:6px 0;font-size:14px;text-align:right;">${escapeHtml(booking.preferredContact)}</td></tr>
       <tr><td style="padding:6px 0;font-size:14px;color:#71717a;">Telefon</td>
           <td style="padding:6px 0;font-size:14px;text-align:right;">${escapeHtml(booking.customer.phone)}</td></tr>
     </table>
     <p style="margin:0;font-size:14px;line-height:1.6;">
       Der Kunde hat das Angebot angenommen. Der Termin steht damit fest;
       die Uhrzeit ist noch abzustimmen.
     </p>`,
  );

  const text = [
    `Zusage von ${booking.customer.name}`,
    "",
    `Termin: ${formatDate(booking.date)}`,
    `Preis: ${currency(preis)}`,
    `Rechnungsnummer: ${booking.invoiceNumber}`,
    `Kennzeichen: ${booking.customer.plate}`,
    `Kontakt bevorzugt: ${booking.preferredContact}`,
    `Telefon: ${booking.customer.phone}`,
    `E-Mail: ${booking.customer.email}`,
    "",
    "Uhrzeit noch abstimmen.",
  ].join("\n");

  return send({
    to: ownerTo,
    subject: `Zusage ${booking.invoiceNumber}: ${formatDate(booking.date)}`,
    html,
    text,
    replyTo: booking.customer.email,
  });
}
