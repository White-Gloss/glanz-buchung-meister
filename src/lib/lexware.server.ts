import { calcLineItems } from "./bookings";
import type { Booking } from "./bookings";
import { taxConfig } from "./servicesConfig";
import { query, queryOne } from "./db.server";

const BASE_URL = "https://api.lexware.io/v1";
const CLAIM_TTL_MINUTES = 10;

type AutomationState = {
  booking_id: string;
  lexware_contact_id: string | null;
  lexware_invoice_id: string | null;
  lexware_invoice_number: string | null;
  lexware_processing_at: string | null;
  lexware_synced_at: string | null;
  lexware_last_error: string | null;
  invoice_mail_sent_at: string | null;
};

type LexwareContactList = {
  content?: Array<{
    id: string;
    emailAddresses?: Record<string, string[] | undefined>;
  }>;
};

type LexwareCreateResult = { id: string };
type LexwareInvoice = { id: string; voucherNumber?: string | null };

function apiKey(): string {
  const value = process.env.LEXWARE_API_KEY?.trim();
  if (!value) throw new Error("LEXWARE_API_KEY fehlt.");
  return value;
}

async function lexwareFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Lexware ${response.status}: ${body.slice(0, 1200) || response.statusText}`);
  }
  return response;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: "", lastName: parts[0] || "Kunde" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) || "Kunde" };
}

async function findContactByExactEmail(email: string): Promise<string | null> {
  const response = await lexwareFetch(`/contacts?email=${encodeURIComponent(email)}&customer=true&page=0&size=25`);
  const result = (await response.json()) as LexwareContactList;
  const target = email.trim().toLowerCase();
  for (const contact of result.content ?? []) {
    const addresses = Object.values(contact.emailAddresses ?? {}).flatMap((values) => values ?? []);
    if (addresses.some((value) => value.trim().toLowerCase() === target)) return contact.id;
  }
  return null;
}

async function createContact(booking: Booking): Promise<string> {
  const { firstName, lastName } = splitName(booking.customer.name);
  const response = await lexwareFetch("/contacts", {
    method: "POST",
    body: JSON.stringify({
      version: 0,
      roles: { customer: {} },
      person: { firstName, lastName },
      emailAddresses: { business: [booking.customer.email] },
      phoneNumbers: { mobile: [booking.customer.phone] },
      note: `White Gloss Buchung ${booking.invoiceNumber} · Kennzeichen ${booking.customer.plate}`,
    }),
  });
  return ((await response.json()) as LexwareCreateResult).id;
}

async function ensureContact(booking: Booking, savedId: string | null): Promise<string> {
  if (savedId) return savedId;
  return (await findContactByExactEmail(booking.customer.email)) ?? (await createContact(booking));
}

function isoDate(date: string) {
  return `${date}T00:00:00.000Z`;
}

async function createInvoice(booking: Booking, contactId: string): Promise<LexwareInvoice> {
  const lineItems = calcLineItems({
    vehicleId: booking.vehicleId,
    packageId: booking.packageId,
    addOnIds: booking.addOnIds,
    pickupCity: booking.pickupCity,
  });
  if (!lineItems.length) throw new Error("Keine Rechnungspositionen vorhanden.");

  const taxRate = taxConfig.smallBusiness ? 0 : Math.round(taxConfig.vatRate * 100);
  const payload = {
    voucherDate: isoDate(new Date().toISOString().slice(0, 10)),
    address: { contactId },
    lineItems: lineItems.map((item) => ({
      type: "custom",
      name: item.label,
      quantity: item.qty,
      unitName: "Stück",
      unitPrice: {
        currency: "EUR",
        grossAmount: item.unit,
        taxRatePercentage: taxRate,
      },
      discountPercentage: 0,
    })),
    totalPrice: { currency: "EUR" },
    taxConditions: { taxType: taxConfig.smallBusiness ? "vatfree" : "gross" },
    paymentConditions: {
      paymentTermLabel: taxConfig.paymentTerms,
      paymentTermDuration: 14,
    },
    shippingConditions: {
      shippingDate: isoDate(booking.date),
      shippingType: "service",
    },
    title: "Rechnung",
    introduction: `Fahrzeugaufbereitung für ${booking.customer.name} · ${booking.customer.plate}`,
    remark: `White-Gloss-Buchungsreferenz: ${booking.invoiceNumber}`,
  };

  const createdResponse = await lexwareFetch("/invoices?finalize=true", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const created = (await createdResponse.json()) as LexwareCreateResult;
  const invoiceResponse = await lexwareFetch(`/invoices/${created.id}`);
  return (await invoiceResponse.json()) as LexwareInvoice;
}

async function ensureState(bookingId: string): Promise<AutomationState> {
  await query(
    `INSERT INTO public.booking_automation_state (booking_id)
     VALUES ($1)
     ON CONFLICT (booking_id) DO NOTHING`,
    [bookingId],
  );
  const state = await queryOne<AutomationState>(
    `SELECT booking_id, lexware_contact_id, lexware_invoice_id, lexware_invoice_number,
            lexware_processing_at, lexware_synced_at, lexware_last_error, invoice_mail_sent_at
       FROM public.booking_automation_state
      WHERE booking_id = $1`,
    [bookingId],
  );
  if (!state) throw new Error("Automationsstatus konnte nicht geladen werden.");
  return state;
}

async function claimBooking(bookingId: string): Promise<boolean> {
  const row = await queryOne<{ booking_id: string }>(
    `UPDATE public.booking_automation_state
        SET lexware_processing_at = now(), lexware_last_error = null, updated_at = now()
      WHERE booking_id = $1
        AND lexware_invoice_id IS NULL
        AND (lexware_processing_at IS NULL OR lexware_processing_at < now() - ($2 || ' minutes')::interval)
      RETURNING booking_id`,
    [bookingId, CLAIM_TTL_MINUTES],
  );
  return Boolean(row);
}

export type LexwareSyncResult = {
  status: "disabled" | "exists" | "busy" | "created";
  invoiceId?: string;
  invoiceNumber?: string | null;
};

export async function syncBookingToLexware(booking: Booking): Promise<LexwareSyncResult> {
  if (!process.env.LEXWARE_API_KEY?.trim()) return { status: "disabled" };

  let state = await ensureState(booking.id);
  if (state.lexware_invoice_id) {
    return {
      status: "exists",
      invoiceId: state.lexware_invoice_id,
      invoiceNumber: state.lexware_invoice_number,
    };
  }
  if (!(await claimBooking(booking.id))) return { status: "busy" };

  try {
    state = await ensureState(booking.id);
    const contactId = await ensureContact(booking, state.lexware_contact_id);
    await query(
      `UPDATE public.booking_automation_state
          SET lexware_contact_id = $2, updated_at = now()
        WHERE booking_id = $1`,
      [booking.id, contactId],
    );

    const invoice = await createInvoice(booking, contactId);
    await query(
      `UPDATE public.booking_automation_state
          SET lexware_invoice_id = $2,
              lexware_invoice_number = $3,
              lexware_synced_at = now(),
              lexware_processing_at = null,
              lexware_last_error = null,
              updated_at = now()
        WHERE booking_id = $1`,
      [booking.id, invoice.id, invoice.voucherNumber ?? null],
    );
    return { status: "created", invoiceId: invoice.id, invoiceNumber: invoice.voucherNumber ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await query(
      `UPDATE public.booking_automation_state
          SET lexware_processing_at = null, lexware_last_error = $2, updated_at = now()
        WHERE booking_id = $1`,
      [booking.id, message.slice(0, 4000)],
    ).catch(() => undefined);
    throw error;
  }
}

export async function downloadLexwareInvoicePdf(invoiceId: string): Promise<Buffer> {
  const response = await lexwareFetch(`/invoices/${invoiceId}/file`, {
    headers: { Accept: "application/pdf" },
  });
  const bytes = await response.arrayBuffer();
  return Buffer.from(bytes);
}
