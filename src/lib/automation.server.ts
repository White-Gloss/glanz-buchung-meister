import type { Booking, BookingStatus } from "./bookings";
import { query, queryOne } from "./db.server";
import { downloadLexwareInvoicePdf, syncBookingToLexware } from "./lexware.server";
import { sendAppointmentReminder, sendLexwareInvoiceEmail } from "./automationEmail.server";

type BookingRow = {
  id: string;
  invoice_number: string;
  created_at: string;
  vehicle_id: string;
  package_id: string;
  add_on_ids: string[] | null;
  booking_date: string;
  booking_time: string;
  pickup_city: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_plate: string;
  preferred_contact: string | null;
  total: number | string;
  agreed_price: number | string | null;
  offer_note: string | null;
  offer_alt_dates: string[] | null;
  status: string;
  is_new_customer: boolean;
  deposit_amount: number | string;
  deposit_status: Booking["depositStatus"];
  access_token: string;
};

const SELECT_BOOKING = `
  id, invoice_number, created_at, vehicle_id, package_id, add_on_ids,
  booking_date::text, booking_time, pickup_city, preferred_contact,
  customer_name, customer_email, customer_phone, customer_plate,
  total, agreed_price, offer_note, offer_alt_dates, status, is_new_customer,
  deposit_amount, deposit_status, access_token::text
`;

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    createdAt: row.created_at,
    vehicleId: row.vehicle_id,
    packageId: row.package_id,
    addOnIds: row.add_on_ids ?? [],
    date: row.booking_date.slice(0, 10),
    time: row.booking_time,
    pickupCity: row.pickup_city,
    preferredContact: (row.preferred_contact ?? "E-Mail") as Booking["preferredContact"],
    agreedPrice: row.agreed_price == null ? null : Number(row.agreed_price),
    offerNote: row.offer_note ?? null,
    offerAltDates: (row.offer_alt_dates ?? []).map((d) => String(d).slice(0, 10)),
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone,
      plate: row.customer_plate,
    },
    total: Number(row.total),
    status: row.status as BookingStatus,
    isNewCustomer: row.is_new_customer,
    depositAmount: Number(row.deposit_amount),
    depositStatus: row.deposit_status,
    accessToken: row.access_token,
  };
}

async function markInvoiceMail(bookingId: string, error?: string) {
  await query(
    `UPDATE public.booking_automation_state
        SET invoice_mail_sent_at = CASE WHEN $2::text IS NULL THEN now() ELSE invoice_mail_sent_at END,
            lexware_last_error = $2,
            updated_at = now()
      WHERE booking_id = $1`,
    [bookingId, error ?? null],
  );
}

export type ConfirmedBookingAutomationResult = {
  lexware: "disabled" | "exists" | "busy" | "created" | "error";
  invoiceMail: "skipped" | "sent" | "error";
  error?: string;
};

/**
 * Läuft nach dem ersten Statuswechsel auf "Bestätigt".
 * Jeder externe Schritt ist fehlertolerant: Die bereits bestätigte Buchung
 * darf durch Lexware oder Mail niemals zurückgerollt werden.
 */
export async function syncConfirmedBookingAutomation(
  booking: Booking,
): Promise<ConfirmedBookingAutomationResult> {
  if (booking.status !== "Bestätigt") return { lexware: "disabled", invoiceMail: "skipped" };

  try {
    const sync = await syncBookingToLexware(booking);
    if (sync.status === "disabled" || sync.status === "busy") {
      return { lexware: sync.status, invoiceMail: "skipped" };
    }
    if (!sync.invoiceId) return { lexware: sync.status, invoiceMail: "skipped" };

    const state = await queryOne<{ invoice_mail_sent_at: string | null }>(
      `SELECT invoice_mail_sent_at
         FROM public.booking_automation_state
        WHERE booking_id = $1`,
      [booking.id],
    );
    if (state?.invoice_mail_sent_at) {
      return { lexware: sync.status, invoiceMail: "skipped" };
    }

    const pdf = await downloadLexwareInvoicePdf(sync.invoiceId);
    const mail = await sendLexwareInvoiceEmail({
      booking,
      invoiceId: sync.invoiceId,
      invoiceNumber: sync.invoiceNumber ?? null,
      pdf,
    });
    if (!mail.sent) {
      const reason = mail.reason || "Rechnungsmail konnte nicht versendet werden.";
      await markInvoiceMail(booking.id, reason.slice(0, 4000));
      return { lexware: sync.status, invoiceMail: "error", error: reason };
    }

    await markInvoiceMail(booking.id);
    return { lexware: sync.status, invoiceMail: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { lexware: "error", invoiceMail: "error", error: message };
  }
}

async function ensureReminderState(bookingId: string) {
  await query(
    `INSERT INTO public.booking_automation_state (booking_id)
     VALUES ($1)
     ON CONFLICT (booking_id) DO NOTHING`,
    [bookingId],
  );
}

async function claimReminder(bookingId: string): Promise<boolean> {
  const claimed = await queryOne<{ booking_id: string }>(
    `UPDATE public.booking_automation_state
        SET reminder_processing_at = now(), reminder_last_error = null, updated_at = now()
      WHERE booking_id = $1
        AND reminder_sent_at IS NULL
        AND (
          reminder_processing_at IS NULL
          OR reminder_processing_at < now() - interval '15 minutes'
        )
      RETURNING booking_id`,
    [bookingId],
  );
  return Boolean(claimed);
}

async function finishReminder(bookingId: string, error?: string) {
  await query(
    `UPDATE public.booking_automation_state
        SET reminder_sent_at = CASE WHEN $2::text IS NULL THEN now() ELSE reminder_sent_at END,
            reminder_processing_at = null,
            reminder_last_error = $2,
            updated_at = now()
      WHERE booking_id = $1`,
    [bookingId, error ?? null],
  );
}

export type ReminderRunResult = {
  candidates: number;
  sent: number;
  failed: number;
  skipped: number;
};

/**
 * Sucht bestätigte Termine, die in den nächsten 25 Stunden stattfinden.
 * Dadurch funktioniert ein stündlicher Cron robust, selbst wenn ein Lauf
 * verspätet ist. Pro Buchung wird dank DB-Claim nur einmal versendet.
 */
export async function runDueAppointmentReminders(): Promise<ReminderRunResult> {
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.MAIL_FROM?.trim()) {
    return { candidates: 0, sent: 0, failed: 0, skipped: 0 };
  }

  const rows = await query<BookingRow>(
    `SELECT ${SELECT_BOOKING}
       FROM public.bookings b
       LEFT JOIN public.booking_automation_state s ON s.booking_id = b.id
      WHERE b.status = 'Bestätigt'
        -- Termine sind datumsbasiert; ohne Uhrzeit waere der Ausdruck
        -- (Datum + Uhrzeit) NULL und die Erinnerung ginge nie raus.
        -- Ersatzweise gilt der Tagesbeginn in Werkstattzeit.
        AND ((b.booking_date + COALESCE(b.booking_time, '00:00')::time) AT TIME ZONE 'Europe/Berlin') > now()
        AND ((b.booking_date + COALESCE(b.booking_time, '00:00')::time) AT TIME ZONE 'Europe/Berlin') <= now() + interval '25 hours'
        AND s.reminder_sent_at IS NULL
      ORDER BY b.booking_date
      LIMIT 50`,
  );

  const result: ReminderRunResult = { candidates: rows.length, sent: 0, failed: 0, skipped: 0 };
  for (const row of rows) {
    const booking = toBooking(row);
    await ensureReminderState(booking.id);
    if (!(await claimReminder(booking.id))) {
      result.skipped += 1;
      continue;
    }

    try {
      const mail = await sendAppointmentReminder(booking);
      if (!mail.sent) {
        await finishReminder(
          booking.id,
          (mail.reason || "Reminder-Versand fehlgeschlagen").slice(0, 4000),
        );
        result.failed += 1;
        continue;
      }
      await finishReminder(booking.id);
      result.sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await finishReminder(booking.id, message.slice(0, 4000)).catch(() => undefined);
      result.failed += 1;
    }
  }
  return result;
}

export type CatchUpResult = {
  processed: number;
  invoicesCreated: number;
  invoiceMailsSent: number;
  errors: number;
  reminders: ReminderRunResult;
};

/**
 * Holt bestätigte Buchungen nach, die vor Aktivierung der Lexware-Verbindung
 * angelegt wurden oder bei denen ein externer Dienst zeitweise ausgefallen war.
 */
export async function runAutomationCatchUp(): Promise<CatchUpResult> {
  const rows = await query<BookingRow>(
    `SELECT ${SELECT_BOOKING}
       FROM public.bookings b
       LEFT JOIN public.booking_automation_state s ON s.booking_id = b.id
      WHERE b.status = 'Bestätigt'
        AND b.booking_date >= current_date
        AND (s.lexware_invoice_id IS NULL OR s.invoice_mail_sent_at IS NULL)
      ORDER BY b.booking_date
      LIMIT 25`,
  );

  const result: CatchUpResult = {
    processed: rows.length,
    invoicesCreated: 0,
    invoiceMailsSent: 0,
    errors: 0,
    reminders: { candidates: 0, sent: 0, failed: 0, skipped: 0 },
  };

  for (const row of rows) {
    const outcome = await syncConfirmedBookingAutomation(toBooking(row));
    if (outcome.lexware === "created") result.invoicesCreated += 1;
    if (outcome.invoiceMail === "sent") result.invoiceMailsSent += 1;
    if (outcome.lexware === "error" || outcome.invoiceMail === "error") result.errors += 1;
  }
  result.reminders = await runDueAppointmentReminders();
  return result;
}
