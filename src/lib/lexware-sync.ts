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
import { zohoOpsEnabled } from "./zoho-credentials.server.ts";

const SHOP = "white-gloss";
const VAT_PERCENT = 19;

export type LexwareCall = LexwareRequest;

/** Live schema without a blocking release-manifest migration (avoids GET / 503). */
export async function ensureLexwareSchema(sql: Sql) {
  await sql`alter table shop_settings add column if not exists lexware_sync_enabled boolean not null default false`;
  await sql`alter table shop_settings add column if not exists lexware_api_key text`;
  await sql`alter table shop_settings add column if not exists lexware_auto_finalize boolean not null default false`;
  await sql`alter table shop_settings add column if not exists lexware_mail_enabled boolean not null default false`;
  await sql`create table if not exists lexware_sync_queue (
    booking_id integer primary key references bookings(id),
    shop_id text not null default 'white-gloss',
    requested_version integer not null,
    synced_version integer not null default 0,
    status text not null default 'pending' check(status in ('pending','synced','failed','review')),
    attempts integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    last_error text,
    lex_contact_id text,
    lex_invoice_id text,
    updated_at timestamptz not null default now()
  )`;
  await sql`create index if not exists lexware_sync_due_idx on lexware_sync_queue(status,next_attempt_at)`;
  await sql`alter table lexware_sync_queue add column if not exists write_pending text`;
  await sql`alter table lexware_sync_queue add column if not exists invoice_status text`;
  await sql`alter table lexware_sync_queue add column if not exists invoice_number text`;
  await sql`alter table lexware_sync_queue add column if not exists invoice_checked_at timestamptz`;
  await sql`alter table lexware_sync_queue add column if not exists billing_data jsonb`;
  await sql`alter table lexware_sync_queue add column if not exists mail_checked_at timestamptz`;
  await sql`alter table lexware_sync_queue enable row level security`;
  await sql`create table if not exists lexware_sync_runner (
    shop_id text primary key,
    lease_token text,
    locked_until timestamptz
  )`;
  await sql`insert into lexware_sync_runner(shop_id) values('white-gloss') on conflict do nothing`;
  await sql`alter table lexware_sync_runner enable row level security`;
}

export async function queueLexwareBooking(
  sql: Sql,
  booking: Pick<WorkflowBooking, "id" | "version">,
) {
  if (await zohoOpsEnabled(sql).catch(() => false)) return;
  await ensureLexwareSchema(sql);
  await sql`insert into lexware_sync_queue(booking_id,shop_id,requested_version)
    values(${booking.id},${SHOP},${booking.version}) on conflict(booking_id) do update
    set requested_version=greatest(lexware_sync_queue.requested_version,excluded.requested_version),
    status=case when lexware_sync_queue.status='review' or lexware_sync_queue.write_pending is not null then 'review' else 'pending' end,
    next_attempt_at=now(),updated_at=now()`;
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
  const offset =
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" })
      .formatToParts(new Date(`${day}T00:00:00Z`))
      .find((p) => p.type === "timeZoneName")
      ?.value.replace("GMT", "") || "+01:00";
  return `${day}T00:00:00.000${offset}`;
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
        grossAmount: (serviceCents || total) / 100,
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
        grossAmount: pickup / 100,
        taxRatePercentage: VAT_PERCENT,
      },
    });
  }
  return lines;
}

type QueueProgress = {
  lex_contact_id: string | null;
  lex_invoice_id: string | null;
  write_pending?: string | null;
  billing_data?: {
    street: string;
    zip: string;
    city: string;
    countryCode: string;
    serviceDate: string;
    totalCents: number;
    bookingVersion: number;
    bookingStatus?: string;
  } | null;
};

async function saveProgress(sql: Sql, bookingId: number, patch: Partial<QueueProgress>) {
  await sql`update lexware_sync_queue set
    lex_contact_id=coalesce(${patch.lex_contact_id ?? null},lex_contact_id),
    lex_invoice_id=coalesce(${patch.lex_invoice_id ?? null},lex_invoice_id),
    write_pending=null,
    updated_at=now()
    where booking_id=${bookingId}`;
}

export async function syncOneLexwareBooking(
  sql: Sql,
  booking: WorkflowBooking,
  request: LexwareCall,
  progress: QueueProgress,
  finalize = false,
) {
  // A crash after a POST can leave a real Lexware object without its local ID.
  // Preserve the intent until a confirmed response has been durably recorded.
  if (progress.write_pending) throw new LexwareError("lexware_write_uncertain", { review: true });
  const names = splitCustomerName(booking.customer_name);
  const phone = normalizePhone(booking.phone);

  let contactId = progress.lex_contact_id;
  if (!contactId) {
    contactId = await findContactByEmail(request, booking.email);
    if (!contactId) {
      await sql`update lexware_sync_queue set write_pending='contact',updated_at=now() where booking_id=${booking.id} and shop_id=${SHOP}`;
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
    const billing = progress.billing_data;
    if (
      finalize &&
      (!billing ||
        !billing.street ||
        !billing.zip ||
        !billing.city ||
        !billing.serviceDate ||
        billing.totalCents !== booking.total_cents ||
        booking.version !==
          billing.bookingVersion + (billing.bookingStatus === "bestaetigt" ? 1 : 0))
    )
      throw new LexwareError("lexware_billing_approval_required", { review: true });
    if (
      !Number.isSafeInteger(booking.total_cents) ||
      booking.total_cents <= 0 ||
      booking.pickup_cents > booking.total_cents
    )
      throw new LexwareError("lexware_invalid_total", { review: true });
    const [legacy] = await sql<{
      exists: boolean;
    }>`select exists(select 1 from bookings where id=${booking.id} and qonto_invoice_id is not null) as exists`;
    if (legacy?.exists) throw new LexwareError("lexware_existing_legacy_invoice", { review: true });
    await sql`update lexware_sync_queue set write_pending='invoice',updated_at=now() where booking_id=${booking.id} and shop_id=${SHOP}`;
    invoiceId = await createInvoiceDraft(request, {
      voucherDate: berlinDateTime(),
      contactId,
      addressName: booking.customer_name,
      lineItems: buildLexwareInvoiceLines(booking),
      shippingDate: berlinDateTime(booking.preferred_date),
      introduction: `Fahrzeugaufbereitung White Gloss · WG-${booking.id}`,
      remark: `Website-Buchung WG-${booking.id}`,
      finalize,
      billingAddress: billing
        ? {
            street: billing.street,
            zip: billing.zip,
            city: billing.city,
            countryCode: billing.countryCode,
          }
        : undefined,
      ...(billing ? { shippingDate: berlinDateTime(billing.serviceDate) } : {}),
    });
    await saveProgress(sql, booking.id, { lex_invoice_id: invoiceId });
    await sql`update lexware_sync_queue set invoice_status=${finalize ? "open" : "draft"},invoice_checked_at=now() where booking_id=${booking.id} and shop_id=${SHOP}`;
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
  if (await zohoOpsEnabled(sql).catch(() => false)) return result;
  await ensureLexwareSchema(sql);
  const [settings] = await sql<{
    lexware_sync_enabled: boolean;
    lexware_auto_finalize: boolean;
  }>`select lexware_sync_enabled,lexware_auto_finalize from shop_settings where shop_id=${SHOP}`;
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
      const [progress] =
        await sql<QueueProgress>`select lex_contact_id,lex_invoice_id,write_pending,billing_data
        from lexware_sync_queue where booking_id=${row.id}`;
      try {
        if (!options.request && !creds)
          throw new LexwareError("lexware_not_configured", { review: true });
        const ids = await syncOneLexwareBooking(
          sql,
          row,
          request,
          progress || { lex_contact_id: null, lex_invoice_id: null },
          settings.lexware_auto_finalize,
        );
        await sql`update lexware_sync_queue set synced_version=${row.version},
          lex_contact_id=${ids.contactId},lex_invoice_id=${ids.invoiceId ?? null},
          status=case when requested_version>${row.version} then 'pending' else 'synced' end,attempts=0,last_error=null,updated_at=now()
          where booking_id=${row.id}`;
        result.synced++;
      } catch (error) {
        if (
          error instanceof LexwareError &&
          error.status &&
          [400, 401, 403, 404, 406, 422, 429].includes(error.status)
        ) {
          await sql`update lexware_sync_queue set write_pending=null where booking_id=${row.id} and shop_id=${SHOP}`;
        }
        const code = error instanceof LexwareError ? error.code : "lexware_processing_failed";
        const [pending] = await sql<{
          write_pending: string | null;
        }>`select write_pending from lexware_sync_queue where booking_id=${row.id}`;
        const review =
          Boolean(pending?.write_pending) || (error instanceof LexwareError && error.review);
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
