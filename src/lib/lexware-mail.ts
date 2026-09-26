import type { Sql } from "./db.ts";
import { createLexwareClient, normalizeLexwareApiBase, type LexwareRequest } from "./lexware.ts";
import { readLexwareCredentials } from "./lexware-credentials.server.ts";
import { enqueueNotification } from "./booking-notifications.ts";
import { EmailDeliveryError } from "./resend-mail.ts";
import { isEmailAddress } from "./utils.ts";

const SHOP = "white-gloss";
type Kind = "invoice" | "reminder";
type Invoice = {
  id: string;
  voucherStatus: string;
  voucherNumber?: string;
  remark?: string;
  address?: { contactId?: string };
  totalPrice?: { currency?: string };
};
type Payment = {
  openAmount: string | number;
  currency?: string;
  voucherStatus?: string;
  paymentStatus?: string;
};
type Voucher = { id: string; voucherStatus: string; dueDate?: string; archived?: boolean };
type Booking = {
  booking_id: number;
  lex_invoice_id: string;
  lex_contact_id: string;
  email: string;
  customer_name: string;
};

export function lexwareMailKey(id: string, kind: Kind) {
  return `lexware-mail:v1:${id}:${kind}`;
}
export function euros(amount: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

/** No inferred balances: missing, invalid, voided and paid responses fail closed. */
export function reminderEligible(payment: Payment, voucher: Voucher, now = new Date()): boolean {
  const amount = Number(payment.openAmount);
  if (
    payment.currency !== "EUR" ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    payment.paymentStatus !== "openRevenue" ||
    !["open", "overdue"].includes(payment.voucherStatus || "") ||
    voucher.archived ||
    voucher.voucherStatus !== "overdue" ||
    !voucher.dueDate
  )
    return false;
  const due = voucher.dueDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
  const grace = new Date(`${due}T12:00:00Z`);
  if (!Number.isFinite(grace.getTime()) || grace.toISOString().slice(0, 10) !== due) return false;
  grace.setUTCDate(grace.getUTCDate() + 7);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return today >= grace.toISOString().slice(0, 10);
}

async function bookingForMail(sql: Sql, bookingId: number) {
  const [row] =
    await sql<Booking>`select q.booking_id,q.lex_invoice_id,q.lex_contact_id,b.email,b.customer_name
    from lexware_sync_queue q join bookings b on b.id=q.booking_id and b.shop_id=q.shop_id
    where q.shop_id=${SHOP} and q.booking_id=${bookingId} and q.lex_invoice_id is not null
      and q.billing_data is not null and q.write_pending is null and b.qonto_invoice_id is null`;
  if (!row || !isEmailAddress(row.email))
    throw new Error("Geprüfte Lexware-Rechnung und gültige Kundenadresse erforderlich.");
  return row;
}

async function inspect(request: LexwareRequest, booking: Booking, kind: Kind) {
  const invoice = await request<Invoice>(
    "GET",
    `/invoices/${encodeURIComponent(booking.lex_invoice_id)}`,
  );
  if (
    invoice.id !== booking.lex_invoice_id ||
    invoice.address?.contactId !== booking.lex_contact_id ||
    invoice.remark !== `Website-Buchung WG-${booking.booking_id}` ||
    !invoice.voucherNumber ||
    !["open", "paid", "overdue"].includes(invoice.voucherStatus)
  )
    return null;
  if (kind === "invoice") return { invoice, amount: 0 };
  const payment = await request<Payment>("GET", `/payments/${encodeURIComponent(invoice.id)}`);
  const list = await request<{ content: Voucher[] }>("GET", "/voucherlist", null, {
    voucherType: "invoice",
    voucherStatus: "open,overdue,paid,voided",
    voucherNumber: invoice.voucherNumber,
    size: "100",
  });
  const voucher = list.content?.find((v) => v.id === invoice.id);
  if (!voucher || !reminderEligible(payment, voucher)) return null;
  return { invoice, amount: Number(payment.openAmount) };
}

export async function queueLexwareMail(sql: Sql, bookingId: number, kind: Kind) {
  const booking = await bookingForMail(sql, bookingId);
  const credentials = await readLexwareCredentials(sql);
  if (!credentials) throw new Error("Lexware ist nicht verbunden.");
  const current = await inspect(createLexwareClient(credentials), booking, kind);
  if (!current)
    throw new Error(
      kind === "invoice"
        ? "Rechnung ist noch ein Entwurf, storniert oder nicht eindeutig zugeordnet."
        : "Keine seit mindestens sieben Tagen überfällige, offene Rechnung bestätigt.",
    );
  if (kind === "reminder") {
    const [sent] =
      await sql`select id from outbound_queue where shop_id=${SHOP} and event_key=${lexwareMailKey(booking.lex_invoice_id, "invoice")} and status='sent' and delivery_status not in ('bounced','complained','failed')`;
    if (!sent) throw new Error("Zuerst den erfolgreichen Rechnungsversand prüfen.");
  }
  const number = current.invoice.voucherNumber!;
  const subject =
    kind === "invoice"
      ? `Ihre Rechnung ${number} · White Gloss WG-${bookingId}`
      : `Zahlungserinnerung zu ${number} · White Gloss WG-${bookingId}`;
  const body =
    kind === "invoice"
      ? `Guten Tag ${booking.customer_name},\n\nim Anhang erhalten Sie Ihre Rechnung ${number} zum Auftrag WG-${bookingId}. Die Zahlungsinformationen finden Sie in der Rechnung.\n\nVielen Dank!\nWhite Gloss Detailing`
      : `Guten Tag ${booking.customer_name},\n\nlaut dem aktuellen Zahlungsstand ist die Rechnung ${number} überfällig.\nOffener Betrag: ${euros(current.amount)}\nBitte überweisen Sie den offenen Betrag unter Angabe der Rechnungsnummer. Sollte sich Ihre Zahlung mit dieser Nachricht überschnitten haben, betrachten Sie diese Erinnerung bitte als gegenstandslos. Es werden keine zusätzlichen Gebühren erhoben.\n\nWhite Gloss Detailing`;
  const id = await enqueueNotification(sql, {
    key: lexwareMailKey(booking.lex_invoice_id, kind),
    eventType: `lexware.${kind}`,
    channel: "email",
    to: booking.email,
    subject,
    body,
    bookingId,
  });
  return { queued: id !== null };
}

/** Fresh state checks happen immediately before every provider attempt, not just at enqueue. */
export async function prepareLexwareMail(
  sql: Sql,
  row: {
    event_key: string;
    event_type: string | null;
    booking_id: number | null;
    to_addr: string | null;
    body: string;
  },
) {
  if (!row.booking_id) return null;
  const kind: Kind = row.event_type === "lexware.reminder" ? "reminder" : "invoice";
  const booking = await bookingForMail(sql, row.booking_id);
  if (
    row.event_key !== lexwareMailKey(booking.lex_invoice_id, kind) ||
    row.to_addr?.toLowerCase() !== booking.email.toLowerCase()
  )
    return null;
  const credentials = await readLexwareCredentials(sql);
  if (!credentials) throw new EmailDeliveryError("email_not_configured", false);
  const current = await inspect(createLexwareClient(credentials), booking, kind);
  if (
    !current ||
    (kind === "reminder" && !row.body.includes(`Offener Betrag: ${euros(current.amount)}\n`))
  )
    return null;
  const response = await fetch(
    `${normalizeLexwareApiBase(credentials.apiBase)}/invoices/${encodeURIComponent(booking.lex_invoice_id)}/file`,
    {
      headers: { Authorization: `Bearer ${credentials.apiKey}`, Accept: "application/pdf" },
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    },
  );
  if (!response.ok)
    throw new EmailDeliveryError(
      "lexware_pdf_unavailable",
      response.status === 429 || response.status >= 500,
    );
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 10 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== "%PDF-")
    throw new EmailDeliveryError("lexware_pdf_invalid", false);
  return [
    {
      filename: `Rechnung-WG-${booking.booking_id}.pdf`,
      content: bytes.toString("base64"),
      content_type: "application/pdf",
    },
  ];
}

/** Opt-in, bounded rotating scan; no historic unapproved invoices or infinite reminder sequence. */
export async function scheduleLexwareMail(sql: Sql) {
  const [setting] = await sql<{
    lexware_mail_enabled: boolean;
  }>`select lexware_mail_enabled from shop_settings where shop_id=${SHOP}`;
  const result = { queued: 0, checked: 0, attention: 0 };
  if (!setting?.lexware_mail_enabled) return result;
  const rows = await sql<{
    booking_id: number;
    lex_invoice_id: string;
  }>`select booking_id,lex_invoice_id from lexware_sync_queue where shop_id=${SHOP} and lex_invoice_id is not null and billing_data is not null and write_pending is null order by mail_checked_at nulls first,booking_id limit 3`;
  for (const row of rows) {
    try {
      const [invoice] = await sql<{
        status: string;
      }>`select status from outbound_queue where shop_id=${SHOP} and event_key=${lexwareMailKey(row.lex_invoice_id, "invoice")}`;
      const [reminder] =
        await sql`select id from outbound_queue where shop_id=${SHOP} and event_key=${lexwareMailKey(row.lex_invoice_id, "reminder")}`;
      if (!invoice || (invoice.status === "sent" && !reminder)) {
        const sent = await queueLexwareMail(sql, row.booking_id, invoice ? "reminder" : "invoice");
        if (sent.queued) result.queued++;
      }
    } catch {
      result.attention++;
    }
    await sql`update lexware_sync_queue set mail_checked_at=now() where shop_id=${SHOP} and booking_id=${row.booking_id}`;
    result.checked++;
  }
  return result;
}
