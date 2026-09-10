import { randomUUID } from "node:crypto";
import type { Sql } from "./db.ts";
import type { WorkflowBooking } from "./booking-workflow.ts";
import { packages, extras } from "../data/site.ts";
import {
  createContact,
  createInvoiceDraft,
  createLexwareClient,
  findContactByEmail,
  LexwareError,
  type LexwareCredentials,
  type LexwareInvoiceLine,
  type LexwareRequest,
} from "./lexware.ts";
import { readLexwareCredentials } from "./lexware-credentials.server.ts";

const SHOP = "white-gloss";
const VAT_FACTOR = 1.19;
const VAT_PERCENT = 19;

export type LexwareCall = LexwareRequest;

export async function queueLexwareBooking(
  sql: Sql,
  booking: Pick<WorkflowBooking, "id" | "version">,
) {
  await sql`insert into lexware_sync_queue(booking_id,shop_id,requested_version)
    values(${booking.id},${SHOP},${booking.version}) on conflict(booking_id) do update
    set requested_version=greatest(lexware_sync_queue.requested_version,excluded.requested_version),
    status='pending',next_attempt_at=now(),updated_at=now()`;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "").replace(/^00/, "+");
}

export function splitCustomerName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "Kunde", lastName: "Website" };
  if (parts.length === 1) return { firstName: "Kunde", lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function berlinDay(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function berlinDateTime(date?: string | null): string {
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) ? date.trim() : berlinDay();
  return `${day}T00:00:00.000+02:00`;
}

function parseExtraIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map((id) => String(id)) : [];
  } catch {
    return [];
  }
}

function netFromGrossCents(cents: number): number {
  return Number((Math.max(0, cents) / 100 / VAT_FACTOR).toFixed(2));
}

export function buildLexwareInvoiceLines(booking: WorkflowBooking): LexwareInvoiceLine[] {
  const pickup = Math.max(0, booking.pickup_cents | 0);
  const total = Math.max(0, booking.total_cents | 0);
  const serviceCents = Math.max(0, total - pickup);
  const pack = packages.find((p) => p.id === booking.package_id)?.name || booking.package_id;
  const extraNames = parseExtraIds(booking.extra_ids).map(
    (id) => extras.find((e) => e.id === id)?.name || id,
  );
  const lines: LexwareInvoiceLine[] = [];
  if (serviceCents > 0 || pickup === 0) {
    lines.push({
      type: "custom",
      name: [pack, ...extraNames].join(" · ") || "Fahrzeugaufbereitung",
      description: extraNames.length
        ? `Extras: ${extraNames.join(", ")} · WG-${booking.id}`
        : `Website-Buchung WG-${booking.id}`,
      quantity: 1,
      unitName: "Leistung",
      unitPrice: {
        currency: "EUR",
        netAmount: netFromGrossCents(serviceCents || total),
        taxRatePercentage: VAT_PERCENT,
      },
    });
  }
  if (pickup > 0) {
    lines.push({
      type: "custom",
      name: "Abholung / Bring-Service",
      description: booking.city_slug ? `Abholort: ${booking.city_slug}` : undefined,
      quantity: 1,
      unitName: "Leistung",
      unitPrice: {
        currency: "EUR",
        netAmount: netFromGrossCents(pickup),
        taxRatePercentage: VAT_PERCENT,
      },
    });
  }
  return lines;
}

type QueueProgress = {
  lex_contact_id: string | null;
  lex_invoice_id: string | null;
};

async function saveProgress(sql: Sql, bookingId: number, patch: Partial<QueueProgress>) {
  await sql`update lexware_sync_queue set
    lex_contact_id=coalesce(${patch.lex_contact_id ?? null},lex_contact_id),
    lex_invoice_id=coalesce(${patch.lex_invoice_id ?? null},lex_invoice_id),
    updated_at=now()
    where booking_id=${bookingId}`;
}

export async function syncOneLexwareBooking(
  sql: Sql,
  booking: WorkflowBooking,
  request: LexwareCall,
  progress: QueueProgress,
) {
  const names = splitCustomerName(booking.customer_name);
  const phone = normalizePhone(booking.phone);

  let contactId = progress.lex_contact_id;
  if (!contactId) {
    contactId = await findContactByEmail(request, booking.email);
    if (!contactId) {
      contactId = await createContact(request, {
        firstName: names.firstName,
        lastName: names.lastName,
        email: booking.email,
        phone: phone || null,
        note: `Website-Kunde WG-${booking.id}`,
      });
    }
    await saveProgress(sql, booking.id, { lex_contact_id: contactId });
  }

  let invoiceId = progress.lex_invoice_id;
  if (!invoiceId && booking.status === "erledigt") {
    invoiceId = await createInvoiceDraft(request, {
      voucherDate: berlinDateTime(),
      contactId,
      addressName: booking.customer_name,
      lineItems: buildLexwareInvoiceLines(booking),
      shippingDate: berlinDateTime(booking.preferred_date),
      introduction: `Fahrzeugaufbereitung White Gloss · WG-${booking.id}`,
      remark: `Website-Buchung WG-${booking.id}`,
    });
    await saveProgress(sql, booking.id, { lex_invoice_id: invoiceId });
  }

  return { contactId, invoiceId };
}

export async function runLexwareSync(
  sql: Sql,
  options: {
    request?: LexwareCall;
    creds?: LexwareCredentials;
    bookingId?: number;
    limit?: number;
  } = {},
) {
  const result = { synced: 0, failed: 0, review: 0 };
  const [settings] = await sql<{
    lexware_sync_enabled: boolean;
  }>`select lexware_sync_enabled from shop_settings where shop_id=${SHOP}`;
  if (!settings?.lexware_sync_enabled) return result;
  const creds = options.creds || (options.request ? null : await readLexwareCredentials(sql));
  if (!options.request && !creds) return result;
  const token = randomUUID();
  const deadline = Date.now() + 35_000;
  const lease =
    await sql`update lexware_sync_runner set lease_token=${token},locked_until=now()+interval '90 seconds'
    where shop_id=${SHOP} and (locked_until is null or locked_until < now()) returning shop_id`;
  if (!lease.length) return result;
  const transport =
    options.request ||
    createLexwareClient(creds!, {
      minIntervalMs: 520,
    });
  const request: LexwareCall = async (method, path, body, query) => {
    const active = await sql`select shop_id from lexware_sync_runner where shop_id=${SHOP}
      and lease_token=${token} and locked_until>now()`;
    if (!active.length) throw new LexwareError("lexware_runner_expired", { review: true });
    if (Date.now() >= deadline) throw new LexwareError("lexware_time_budget", { retryable: true });
    return transport(method, path, body, query);
  };
  try {
    for (let i = 0; i < (options.limit ?? 3) && Date.now() < deadline; i++) {
      const [row] =
        await sql<WorkflowBooking>`select b.* from lexware_sync_queue q join bookings b on b.id=q.booking_id and b.shop_id=q.shop_id
        where q.shop_id=${SHOP} and q.status='pending' and q.next_attempt_at<=now() and (${options.bookingId ?? null}::integer is null or b.id=${options.bookingId ?? null})
        order by q.next_attempt_at,q.booking_id limit 1`;
      if (!row) break;
      const [progress] = await sql<QueueProgress>`select lex_contact_id,lex_invoice_id
        from lexware_sync_queue where booking_id=${row.id}`;
      try {
        if (!options.request && !creds)
          throw new LexwareError("lexware_not_configured", { review: true });
        const ids = await syncOneLexwareBooking(
          sql,
          row,
          request,
          progress || { lex_contact_id: null, lex_invoice_id: null },
        );
        await sql`update lexware_sync_queue set synced_version=${row.version},
          lex_contact_id=${ids.contactId},lex_invoice_id=${ids.invoiceId ?? null},
          status=case when requested_version>${row.version} then 'pending' else 'synced' end,attempts=0,last_error=null,updated_at=now()
          where booking_id=${row.id}`;
        result.synced++;
      } catch (error) {
        const code = error instanceof LexwareError ? error.code : "lexware_processing_failed";
        const review = error instanceof LexwareError && error.review;
        await sql`update lexware_sync_queue set attempts=attempts+1,
          status=case when ${review} then 'review' when attempts>=5 then 'failed' else 'pending' end,
          last_error=${code},next_attempt_at=now()+interval '5 minutes',updated_at=now() where booking_id=${row.id}`;
        if (review) result.review++;
        else result.failed++;
        break;
      }
    }
  } finally {
    await sql`update lexware_sync_runner set lease_token=null,locked_until=null where shop_id=${SHOP} and lease_token=${token}`;
  }
  return result;
}
