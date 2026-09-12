import { randomUUID } from "node:crypto";
import type { Sql } from "./db.ts";
import {
  booksCreateContact,
  booksCreateInvoice,
  booksCreatePayment,
  booksEmailInvoice,
  booksListContacts,
  booksListTaxes,
  crmInsert,
  crmSearch,
  crmUpdate,
  crmUploadAttachment,
  ZohoError,
  type ZohoCredentials,
} from "./zoho.ts";
import { readZohoCredentials, zohoOpsEnabled } from "./zoho-credentials.server.ts";
import { type ZohoBooking, ensureZohoSchema } from "./zoho-ops.ts";
import { createBookingConfirmationPdf, confirmationEmailCopy } from "./zoho-documents.ts";
import { enqueueNotification, recipientHash } from "./booking-notifications.ts";
import { formatBerlinRange, isoOffset } from "./zoho-time.ts";
import { packages, extras, vehicleClasses, site } from "../data/site.ts";
import { isEmailAddress } from "./utils.ts";
import { createSignedPhotoUrl } from "./booking-photos.ts";

const SHOP = "white-gloss";

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: "Kunde", last: parts[0] || "Website" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function extraNames(raw: string | null | undefined) {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed
          .filter((id): id is string => typeof id === "string")
          .map((id) => extras.find((item) => item.id === id)?.name || id)
      : [];
  } catch {
    return [];
  }
}

function dealDescription(booking: ZohoBooking) {
  return [
    `Website-Vorgang WG-${booking.id}`,
    `Status: ${booking.ops_stage}`,
    `Buchung: ${booking.status}`,
    `Paket: ${packages.find((item) => item.id === booking.package_id)?.name || booking.package_id}`,
    `Fahrzeugklasse: ${vehicleClasses.find((item) => item.id === booking.class_id)?.label || booking.class_id}`,
    booking.vehicle_make || booking.vehicle_model || booking.vehicle_plate
      ? `Fahrzeug: ${[booking.vehicle_make, booking.vehicle_model, booking.vehicle_plate].filter(Boolean).join(" ")}`
      : "",
    `Zusatzleistungen: ${extraNames(booking.extra_ids).join(", ") || "keine"}`,
    `Wunschtermin: ${booking.preferred_date || "offen"} ${booking.preferred_slot || ""}`,
    `Preisschätzung: ${((booking.estimated_price_cents ?? booking.total_cents) / 100).toFixed(2)} EUR`,
    booking.agreed_price_cents != null
      ? `Vereinbarter Preis: ${(booking.agreed_price_cents / 100).toFixed(2)} EUR`
      : "",
    booking.note ? `Kundenhinweis: ${booking.note}` : "",
    booking.internal_notes ? `Intern: ${booking.internal_notes}` : "",
    "Fotos liegen in der Website und als CRM-Anhänge. Dies ist keine Rechnung.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function syncCrmRecord(sql: Sql, booking: ZohoBooking, creds: ZohoCredentials) {
  const names = splitName(booking.customer_name);
  let contactId = booking.zoho_contact_id;
  if (!contactId && booking.email) {
    const found = await crmSearch(
      creds,
      "Contacts",
      `(Email:equals:${booking.email.replace(/[()]/g, "")})`,
    );
    contactId = found.data.data?.[0]?.id || null;
  }
  if (!contactId) {
    const created = await crmInsert(creds, "Contacts", {
      First_Name: names.first,
      Last_Name: names.last,
      Email: booking.email || undefined,
      Phone: booking.phone,
      Description: `White Gloss Website-Kunde · ${booking.phone}`,
    });
    contactId = created.data.data?.[0]?.details?.id || null;
    if (!contactId) throw new ZohoError("zoho_contact_create", { review: true });
  }
  const dealName = `WG-${booking.id} · ${packages.find((item) => item.id === booking.package_id)?.name || booking.package_id}`;
  let dealId = booking.zoho_deal_id;
  if (!dealId) {
    const found = await crmSearch(creds, "Deals", `(Deal_Name:equals:${dealName})`);
    dealId = found.data.data?.[0]?.id || null;
  }
  const dealPayload = {
    Deal_Name: dealName,
    Stage:
      booking.ops_stage === "abgeschlossen"
        ? "Closed Won"
        : booking.ops_stage === "abgelehnt" || booking.ops_stage === "storniert"
          ? "Closed Lost"
          : "Qualification",
    Contact_Name: contactId ? { id: contactId } : undefined,
    Amount: (booking.agreed_price_cents ?? booking.estimated_price_cents ?? booking.total_cents) / 100,
    Description: dealDescription(booking),
    Closing_Date: booking.preferred_date || undefined,
  };
  if (!dealId) {
    const created = await crmInsert(creds, "Deals", dealPayload);
    dealId = created.data.data?.[0]?.details?.id || null;
    if (!dealId) throw new ZohoError("zoho_deal_create", { review: true });
  } else {
    await crmUpdate(creds, "Deals", dealId, dealPayload);
  }
  await sql`
    update bookings
    set zoho_contact_id = ${contactId}, zoho_deal_id = ${dealId}, zoho_last_error = null
    where id = ${booking.id} and shop_id = ${SHOP}
  `;
  return { contactId, dealId };
}

export async function syncCalendarEvent(sql: Sql, booking: ZohoBooking, creds: ZohoCredentials) {
  if (booking.status !== "bestaetigt" && booking.status !== "erledigt") {
    return { eventId: booking.zoho_event_id };
  }
  if (!booking.work_start_at || !booking.work_end_at) {
    return { eventId: booking.zoho_event_id };
  }
  const start = new Date(booking.work_start_at);
  const end = new Date(booking.work_end_at);
  const payload = {
    Event_Title: "White Gloss · Werkstatt belegt",
    Start_DateTime: isoOffset(start),
    End_DateTime: isoOffset(end),
    Description: `Kapazität für Vorgang WG-${booking.id} blockiert. Keine Kundendaten.`,
    Venue: `${site.street}, ${site.postalCode} ${site.city}`,
    What_Id: booking.zoho_deal_id || undefined,
    $se_module: booking.zoho_deal_id ? "Deals" : undefined,
  };
  let eventId = booking.zoho_event_id;
  if (!eventId) {
    const created = await crmInsert(creds, "Events", payload);
    eventId = created.data.data?.[0]?.details?.id || null;
    if (!eventId) throw new ZohoError("zoho_event_create", { review: true });
  } else {
    await crmUpdate(creds, "Events", eventId, payload);
  }
  await sql`
    update bookings set zoho_event_id = ${eventId}, zoho_last_error = null
    where id = ${booking.id} and shop_id = ${SHOP}
  `;
  return { eventId };
}

export async function sendConfirmationDocument(sql: Sql, booking: ZohoBooking) {
  if (!isEmailAddress(booking.email)) {
    throw new ZohoError("zoho_customer_email_missing", { review: true });
  }
  const version = Math.max(1, (booking.confirmation_pdf_version || 0) + 1);
  const pdf = await createBookingConfirmationPdf({ ...booking, confirmation_pdf_version: version });
  const start = booking.work_start_at ? new Date(booking.work_start_at) : null;
  const end = booking.work_end_at ? new Date(booking.work_end_at) : null;
  const when =
    start && end ? formatBerlinRange(start, end) : `${booking.preferred_date || ""} ${booking.preferred_slot || ""}`;
  const price = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    (booking.agreed_price_cents ?? booking.total_cents) / 100,
  );
  await enqueueNotification(sql, {
    key: `zoho:confirmation:${booking.id}:${booking.version}:email:${recipientHash(booking.email)}`,
    eventType: "booking.confirmed",
    channel: "email",
    to: booking.email,
    subject: `Terminbestätigung · White Gloss WG-${booking.id}`,
    body: confirmationEmailCopy(booking.customer_name, `WG-${booking.id}`, when, price),
    bookingId: booking.id,
    bookingVersion: booking.version,
    attachments: [
      {
        filename: `Buchungsbestaetigung-WG-${booking.id}-v${version}.pdf`,
        content: pdf,
        content_type: "application/pdf",
      },
    ],
  });
  await sql`
    update bookings
    set confirmation_pdf_version = ${version}
    where id = ${booking.id} and shop_id = ${SHOP}
  `;
  if (booking.zoho_deal_id) {
    const creds = await readZohoCredentials(sql);
    if (creds) {
      await crmUploadAttachment(creds, "Deals", booking.zoho_deal_id, {
        filename: `Buchungsbestaetigung-WG-${booking.id}-v${version}.pdf`,
        bytes: Buffer.from(pdf, "base64"),
        mime: "application/pdf",
      }).catch(() => {
        /* Confirmation email is already queued; CRM attachment can retry via record. */
      });
    }
  }
}

function berlinDate(offset = 0) {
  const date = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function booksCustomerId(creds: ZohoCredentials, booking: ZohoBooking) {
  if (!isEmailAddress(booking.email)) throw new ZohoError("zoho_customer_email_missing", { review: true });
  const existing = await booksListContacts(creds, booking.email);
  let customerId = existing.data.contacts?.[0]?.contact_id;
  if (!customerId) {
    const names = splitName(booking.customer_name);
    const created = await booksCreateContact(creds, {
      contact_name: booking.customer_name,
      contact_type: "customer",
      first_name: names.first,
      last_name: names.last,
      email: booking.email,
      phone: booking.phone,
    });
    customerId = created.data.contact?.contact_id;
  }
  if (!customerId) throw new ZohoError("zoho_books_customer", { review: true });
  return customerId;
}

export async function createZohoInvoice(sql: Sql, booking: ZohoBooking, creds: ZohoCredentials) {
  if (booking.zoho_invoice_id) {
    return { invoiceId: booking.zoho_invoice_id, created: false, number: booking.zoho_invoice_number };
  }
  if (!creds.booksOrgId && !process.env.ZOHO_BOOKS_ORG_ID) {
    throw new ZohoError("zoho_books_org_missing", { review: true });
  }
  const taxes = await booksListTaxes(creds);
  const vat = taxes.data.taxes?.find((tax) => Number(tax.tax_percentage) === 19);
  if (!vat?.tax_id) throw new ZohoError("zoho_tax_19_missing", { review: true });
  const customerId = await booksCustomerId(creds, booking);
  const gross = (booking.agreed_price_cents ?? booking.total_cents) / 100;
  const net = Math.round((gross / 1.19) * 100) / 100;
  const serviceDate = booking.work_end_at
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(booking.work_end_at))
    : berlinDate(0);
  const due = booking.payment_method === "ueberweisung" ? berlinDate(7) : serviceDate;
  const invoice = await booksCreateInvoice(creds, {
    customer_id: customerId,
    date: serviceDate,
    due_date: due,
    payment_terms: booking.payment_method === "ueberweisung" ? 7 : 0,
    payment_terms_label:
      booking.payment_method === "ueberweisung" ? "7 Tage netto" : "Bereits bar erhalten",
    is_inclusive_tax: false,
    reference_number: `WG-${booking.id}`,
    notes:
      booking.payment_method === "bar"
        ? "Barzahlung bei Leistung. Keine Zahlungserinnerung."
        : `Bitte überweisen Sie innerhalb von 7 Tagen. Verwendungszweck: WG-${booking.id}`,
    line_items: [
      {
        name: packages.find((item) => item.id === booking.package_id)?.name || "Fahrzeugaufbereitung",
        description: extraNames(booking.extra_ids).join(", "),
        rate: net,
        quantity: 1,
        tax_id: vat.tax_id,
      },
    ],
  });
  const invoiceId = invoice.data.invoice?.invoice_id;
  const number = invoice.data.invoice?.invoice_number || null;
  if (!invoiceId) throw new ZohoError("zoho_invoice_create", { review: true });
  await sql`
    update bookings
    set zoho_invoice_id = ${invoiceId},
        zoho_invoice_number = ${number},
        invoice_status = 'erstellt',
        zoho_last_error = null
    where id = ${booking.id} and shop_id = ${SHOP} and zoho_invoice_id is null
  `;
  return { invoiceId, created: true, number, customerId };
}

export async function recordCashPayment(
  sql: Sql,
  booking: ZohoBooking,
  creds: ZohoCredentials,
  invoiceId: string,
  customerId?: string,
) {
  if (booking.payment_method !== "bar") return;
  if (booking.zoho_payment_id) return;
  const amount = (booking.payment_recorded_cents || 0) / 100;
  const invoiceAmount = (booking.agreed_price_cents ?? booking.total_cents) / 100;
  if (amount <= 0) throw new ZohoError("zoho_cash_amount_missing", { review: true });
  const booksCustomer = customerId || (await booksCustomerId(creds, booking));
  const payment = await booksCreatePayment(creds, {
    customer_id: booksCustomer,
    payment_mode: "cash",
    amount,
    date: booking.payment_recorded_on || berlinDate(0),
    reference_number: `BAR-WG-${booking.id}`,
    invoices: [{ invoice_id: invoiceId, amount_applied: Math.min(amount, invoiceAmount) }],
  });
  const paymentId = payment.data.payment?.payment_id;
  if (!paymentId) throw new ZohoError("zoho_payment_create", { review: true });
  const paid = amount >= invoiceAmount - 0.009;
  await sql`
    update bookings
    set zoho_payment_id = ${paymentId},
        payment_status = ${paid ? "bezahlt" : "teilbezahlt"}
    where id = ${booking.id} and shop_id = ${SHOP}
  `;
}

export async function processZohoJob(
  sql: Sql,
  job: { id: number; job: string; booking_id: number; payload: Record<string, unknown> },
) {
  const [booking] = await sql<ZohoBooking>`
    select * from bookings where shop_id = ${SHOP} and id = ${job.booking_id}
  `;
  if (!booking) throw new ZohoError("zoho_booking_missing", { review: true });
  if (job.job === "confirmation") {
    await sendConfirmationDocument(sql, booking);
    return;
  }
  if (job.job === "photos") {
    const creds = await readZohoCredentials(sql);
    if (!creds || !booking.zoho_deal_id) return;
    const photos = await sql<{ storage_path: string; original_name: string; mime: string }>`
      select storage_path, original_name, mime from booking_photos
      where shop_id = ${SHOP} and booking_id = ${booking.id} and upload_state = 'ready'
    `;
    for (const photo of photos.slice(0, 8)) {
      const url = await createSignedPhotoUrl(photo.storage_path).catch(() => null);
      if (!url) continue;
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
      if (!response?.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      await crmUploadAttachment(creds, "Deals", booking.zoho_deal_id, {
        filename: photo.original_name.slice(0, 100),
        bytes,
        mime: photo.mime,
      });
    }
    return;
  }
  const creds = await readZohoCredentials(sql);
  if (!creds) {
    if (job.job === "invoice") {
      await sql`
        update bookings
        set invoice_status = 'fehler',
            zoho_last_error = 'Zoho Books ist nicht verbunden. Die Leistung bleibt abgeschlossen.'
        where id = ${booking.id} and shop_id = ${SHOP}
      `;
      throw new ZohoError("zoho_not_configured", { review: true });
    }
    return;
  }
  if (job.job === "record") {
    await syncCrmRecord(sql, booking, creds);
    return;
  }
  if (job.job === "calendar") {
    if (!booking.zoho_deal_id) await syncCrmRecord(sql, booking, creds);
    const [fresh] = await sql<ZohoBooking>`select * from bookings where id = ${booking.id}`;
    await syncCalendarEvent(sql, fresh, creds);
    return;
  }
  if (job.job === "invoice") {
    const created = await createZohoInvoice(sql, booking, creds);
    const [billed] = await sql<ZohoBooking>`select * from bookings where id = ${booking.id}`;
    await recordCashPayment(
      sql,
      billed,
      creds,
      created.invoiceId,
      "customerId" in created ? created.customerId : undefined,
    );
    if (billed.invoice_status !== "versendet") {
      await booksEmailInvoice(creds, created.invoiceId);
      await sql`
        update bookings set invoice_status = 'versendet'
        where id = ${booking.id} and shop_id = ${SHOP}
      `;
    }
    return;
  }
}

export async function runZohoSync(sql: Sql, options: { limit?: number } = {}) {
  const result = { processed: 0, failed: 0, review: 0 };
  await ensureZohoSchema(sql);
  if (!(await zohoOpsEnabled(sql)) && !process.env.ZOHO_CLIENT_ID) {
    const pending = await sql<{ id: number }>`
      select id from zoho_job_queue
      where shop_id = ${SHOP} and status = 'pending' and job in ('confirmation', 'record', 'photos')
      limit 1
    `;
    if (!pending.length) return result;
  }
  const token = randomUUID();
  const lease = await sql`
    update zoho_sync_runner
    set lease_token = ${token}, locked_until = now() + interval '90 seconds'
    where shop_id = ${SHOP} and (locked_until is null or locked_until < now())
    returning shop_id
  `;
  if (!lease.length) return result;
  try {
    for (let i = 0; i < (options.limit ?? 5); i += 1) {
      const claimed = await sql<{
        id: number;
        job: string;
        booking_id: number;
        payload: Record<string, unknown>;
      }>`
        update zoho_job_queue
        set status = 'processing', attempts = attempts + 1, updated_at = now()
        where id = (
          select id from zoho_job_queue
          where shop_id = ${SHOP} and status = 'pending' and next_attempt_at <= now()
          order by id
          limit 1
          for update skip locked
        )
        returning id, job, booking_id, payload
      `;
      const job = claimed[0];
      if (!job) break;
      try {
        await processZohoJob(sql, job);
        await sql`
          update zoho_job_queue set status = 'done', last_error = null, updated_at = now()
          where id = ${job.id}
        `;
        result.processed += 1;
      } catch (error) {
        const code = error instanceof ZohoError ? error.code : "zoho_processing_failed";
        const review = error instanceof ZohoError && error.review;
        await sql`
          update zoho_job_queue
          set status = ${review || job.job === "invoice" ? "review" : "pending"},
              last_error = ${code},
              next_attempt_at = now() + interval '5 minutes',
              updated_at = now()
          where id = ${job.id}
        `;
        if (job.job === "invoice") {
          await sql`
            update bookings
            set invoice_status = 'fehler', zoho_last_error = ${code}
            where id = ${job.booking_id} and shop_id = ${SHOP}
          `;
        }
        if (review) result.review += 1;
        else result.failed += 1;
        break;
      }
    }
  } finally {
    await sql`
      update zoho_sync_runner set lease_token = null, locked_until = null
      where shop_id = ${SHOP} and lease_token = ${token}
    `;
  }
  return result;
}
