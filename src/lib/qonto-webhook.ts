import type { Sql } from "./db.ts";
import {
  QontoSignatureError,
  signQontoPayload,
  verifyQontoSignature,
} from "./qonto-webhook-signature.ts";

const SHOP = "white-gloss";
const MAX_WEBHOOK_BYTES = 256 * 1024;
const EVENT_ID = /^[A-Za-z0-9_-]{8,80}$/;

export type QontoWebhookOutcome =
  "paid" | "already_paid" | "mirrored" | "unmatched" | "ambiguous" | "ignored" | "duplicate";

const schemaReady = new WeakMap<Sql, Promise<void>>();

export function ensureQontoWebhookSchema(sql: Sql): Promise<void> {
  const known = schemaReady.get(sql);
  if (known) return known;
  const ready = (async () => {
    await sql`create table if not exists qonto_webhook_receipts (
      event_id text primary key check (event_id ~ '^[A-Za-z0-9_-]{8,80}$'),
      event_type text not null check (event_type ~ '^[a-z0-9/_-]{1,48}$'),
      outcome text not null check (outcome ~ '^[a-z_]{1,32}$'),
      booking_id integer,
      received_at timestamptz not null default now()
    )`;
    const [registry] = await sql<{ present: boolean }>`
      select to_regclass('_migrations') is not null as present`;
    if (registry?.present)
      await sql`insert into _migrations(name) values('0024_qonto_webhook.sql') on conflict do nothing`;
  })().catch((error) => {
    schemaReady.delete(sql);
    throw error;
  });
  schemaReady.set(sql, ready);
  return ready;
}

type InvoiceCandidate = {
  id: number;
  qonto_invoice_id: string | null;
  qonto_invoice_number: string | null;
  agreed_price_cents: number | null;
  estimated_price_cents: number | null;
  total_cents: number | null;
  payment_status: string;
  qonto_invoice_status: string | null;
  version: number;
};

type InvoiceNotice = {
  kind: "invoice";
  id: string;
  number: string | null;
  status: string;
  currency: string | null;
  amountCents: number | null;
  paidOn: string | null;
};

type TransactionNotice = {
  kind: "transaction";
  side: string;
  status: string;
  currency: string | null;
  amountCents: number | null;
  reference: string;
  label: string;
  paidOn: string | null;
};

type QontoNotice = InvoiceNotice | TransactionNotice;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function intOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "bigint" && value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function moneyCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const cents = Math.round(value * 100);
    return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
  }
  const wrapped = object(value);
  const raw = wrapped ? wrapped.value : value;
  if (typeof raw !== "string" || !/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, frac = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

function currencyOf(data: Record<string, unknown>): string | null {
  const direct = text(data.currency, 8);
  if (direct) return direct.toUpperCase();
  const total = object(data.total_amount);
  const nested = total ? text(total.currency, 8) : null;
  return nested ? nested.toUpperCase() : null;
}

function day(value: unknown): string | null {
  const raw = text(value, 40);
  const match = raw?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function berlinDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function localPrices(row: InvoiceCandidate): number[] {
  return [row.agreed_price_cents, row.estimated_price_cents, row.total_cents].filter(
    (value): value is number => Number.isInteger(value),
  );
}

export function matchClientInvoice(
  rows: InvoiceCandidate[],
  invoice: Pick<InvoiceNotice, "id" | "number" | "amountCents" | "currency">,
): number | "ambiguous" | "none" {
  if (invoice.currency && invoice.currency !== "EUR") return "ambiguous";
  const byId = rows.filter((row) => row.qonto_invoice_id === invoice.id);
  if (byId.length === 1) return byId[0].id;
  if (byId.length > 1) return "ambiguous";
  if (!invoice.number) return "none";
  const byNumber = rows.filter((row) => row.qonto_invoice_number === invoice.number);
  if (byNumber.length !== 1) return byNumber.length === 0 ? "none" : "ambiguous";
  if (invoice.amountCents == null) return "ambiguous";
  return localPrices(byNumber[0]).includes(invoice.amountCents) ? byNumber[0].id : "ambiguous";
}

function containsToken(haystack: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?=$|[^A-Za-z0-9])`).test(haystack);
}

export function matchTransaction(
  rows: InvoiceCandidate[],
  transaction: Pick<
    TransactionNotice,
    "side" | "status" | "currency" | "amountCents" | "reference" | "label"
  >,
): number | "ambiguous" | "ignored" | "none" {
  if (transaction.side !== "credit" || transaction.status !== "completed") return "ignored";
  if (transaction.currency && transaction.currency !== "EUR") return "ambiguous";
  if (transaction.amountCents == null) return "ambiguous";
  const haystack = `${transaction.reference}\n${transaction.label}`;
  const hits = rows.filter(
    (row) =>
      row.qonto_invoice_number &&
      containsToken(haystack, row.qonto_invoice_number) &&
      localPrices(row).includes(transaction.amountCents as number),
  );
  if (hits.length === 1) return hits[0].id;
  if (hits.length > 1) return "ambiguous";
  return rows.some(
    (row) => row.qonto_invoice_number && containsToken(haystack, row.qonto_invoice_number),
  )
    ? "ambiguous"
    : "none";
}

export function readQontoNotice(
  payload: unknown,
): { eventId: string; eventType: string; notice: QontoNotice | null } | null {
  const root = object(payload);
  const eventId = root ? text(root.id, 80) : null;
  const eventType = root ? text(root.type, 48) : null;
  if (
    !eventId ||
    !EVENT_ID.test(eventId) ||
    !eventType ||
    !/^v1\/[a-z0-9-]{1,40}$/.test(eventType)
  ) {
    return null;
  }
  const data = object(root?.data);
  if (!data) return { eventId, eventType, notice: null };
  if (eventType === "v1/client-invoices") {
    const id = text(data.id, 80);
    const status = text(data.status, 32);
    if (!id || !/^[A-Za-z0-9_-]{8,80}$/.test(id) || !status || !/^[a-z_]{1,32}$/.test(status)) {
      return { eventId, eventType, notice: null };
    }
    return {
      eventId,
      eventType,
      notice: {
        kind: "invoice",
        id,
        number: text(data.number, 40),
        status,
        currency: currencyOf(data),
        amountCents: moneyCents(data.total_amount),
        paidOn: day(data.paid_at),
      },
    };
  }
  if (eventType === "v1/transactions") {
    const side = text(data.side, 16) ?? "";
    const status = text(data.status, 32) ?? "";
    return {
      eventId,
      eventType,
      notice: {
        kind: "transaction",
        side,
        status,
        currency: currencyOf(data),
        amountCents: moneyCents(data.amount),
        reference: text(data.reference, 140) ?? "",
        label: text(data.label, 140) ?? "",
        paidOn: day(data.settled_at) ?? day(data.emitted_at),
      },
    };
  }
  return { eventId, eventType, notice: null };
}

async function loadInvoiceCandidates(
  sql: Sql,
  invoice: InvoiceNotice,
): Promise<InvoiceCandidate[]> {
  return sql<InvoiceCandidate>`
    select id, qonto_invoice_id, qonto_invoice_number, agreed_price_cents, estimated_price_cents,
           total_cents, payment_status, qonto_invoice_status, version
    from bookings
    where shop_id = ${SHOP}
      and (
        qonto_invoice_id = ${invoice.id}
        or (${invoice.number}::text is not null and qonto_invoice_number = ${invoice.number})
      )
  `;
}

async function loadTransactionCandidates(
  sql: Sql,
  transaction: TransactionNotice,
): Promise<InvoiceCandidate[]> {
  const blob = `${transaction.reference}\n${transaction.label}`;
  if (!blob.trim()) return [];
  return sql<InvoiceCandidate>`
    select id, qonto_invoice_id, qonto_invoice_number, agreed_price_cents, estimated_price_cents,
           total_cents, payment_status, qonto_invoice_status, version
    from bookings
    where shop_id = ${SHOP}
      and qonto_invoice_number is not null
      and (
        position(qonto_invoice_number in ${transaction.reference}) > 0
        or position(qonto_invoice_number in ${transaction.label}) > 0
      )
  `;
}

function normalize(row: InvoiceCandidate): InvoiceCandidate {
  return {
    ...row,
    id: intOrNull(row.id) ?? 0,
    agreed_price_cents: intOrNull(row.agreed_price_cents),
    estimated_price_cents: intOrNull(row.estimated_price_cents),
    total_cents: intOrNull(row.total_cents),
    version: intOrNull(row.version) ?? 0,
  };
}

async function recordPayment(
  sql: Sql,
  bookingId: number,
  input: {
    invoiceId?: string | null;
    number?: string | null;
    amountCents: number | null;
    paidOn: string;
  },
): Promise<"paid" | "already_paid"> {
  const [before] = await sql<InvoiceCandidate>`
    select id, qonto_invoice_id, qonto_invoice_number, agreed_price_cents, estimated_price_cents,
           total_cents, payment_status, qonto_invoice_status, version
    from bookings
    where shop_id = ${SHOP} and id = ${bookingId}
    for update
  `;
  if (!before) return "already_paid";
  const current = normalize(before);
  if (current.payment_status === "bezahlt") return "already_paid";
  const [saved] = await sql<InvoiceCandidate>`
    update bookings
    set payment_status = 'bezahlt',
        payment_method = case
          when payment_method is null or payment_method = '' then 'ueberweisung'
          else payment_method
        end,
        payment_recorded_cents = coalesce(
          ${input.amountCents},
          payment_recorded_cents,
          agreed_price_cents,
          estimated_price_cents,
          total_cents
        ),
        payment_recorded_on = coalesce(payment_recorded_on, ${input.paidOn}::date),
        qonto_invoice_status = 'paid',
        qonto_invoice_id = coalesce(qonto_invoice_id, ${input.invoiceId ?? null}),
        qonto_invoice_number = coalesce(qonto_invoice_number, ${input.number ?? null}),
        version = version + 1
    where shop_id = ${SHOP} and id = ${bookingId} and payment_status is distinct from 'bezahlt'
    returning id, qonto_invoice_id, qonto_invoice_number, agreed_price_cents, estimated_price_cents,
              total_cents, payment_status, qonto_invoice_status, version
  `;
  if (!saved) return "already_paid";
  const after = normalize(saved);
  await sql`
    insert into booking_events(shop_id, booking_id, event, actor, version, before_data, after_data)
    values (
      ${SHOP},
      ${bookingId},
      ${"qonto.invoice_paid"},
      ${"qonto-webhook"},
      ${after.version},
      ${JSON.stringify({
        payment: current.payment_status,
        invoice: current.qonto_invoice_status,
      })}::jsonb,
      ${JSON.stringify({
        payment: after.payment_status,
        invoice: after.qonto_invoice_status,
      })}::jsonb
    )
  `;
  return "paid";
}

async function mirrorStatus(sql: Sql, bookingId: number, status: string): Promise<"mirrored"> {
  await sql`
    update bookings
    set qonto_invoice_status = ${status}
    where shop_id = ${SHOP} and id = ${bookingId}
      and payment_status is distinct from 'bezahlt'
      and qonto_invoice_status is distinct from ${status}
  `;
  return "mirrored";
}

export async function applyQontoNotice(
  sql: Sql,
  event: { eventId: string; eventType: string; notice: QontoNotice | null },
  now = new Date(),
): Promise<QontoWebhookOutcome> {
  await ensureQontoWebhookSchema(sql);
  return sql.transaction(async (tx) => {
    const claimed = await tx<{ event_id: string }>`
      insert into qonto_webhook_receipts (event_id, event_type, outcome)
      values (${event.eventId}, ${event.eventType}, ${"accepted"})
      on conflict (event_id) do nothing
      returning event_id
    `;
    if (!claimed.length) return "duplicate";

    let outcome: QontoWebhookOutcome = "ignored";
    let bookingId: number | null = null;
    const paidOn = event.notice?.paidOn ?? berlinDay(now);

    if (event.notice?.kind === "invoice") {
      const rows = (await loadInvoiceCandidates(tx, event.notice)).map(normalize);
      const match = matchClientInvoice(rows, event.notice);
      if (match === "ambiguous") outcome = "ambiguous";
      else if (match === "none") outcome = "unmatched";
      else if (event.notice.status === "paid") {
        bookingId = match;
        outcome = await recordPayment(tx, match, {
          invoiceId: event.notice.id,
          number: event.notice.number,
          amountCents: event.notice.amountCents,
          paidOn,
        });
      } else if (event.notice.status === "unpaid" || event.notice.status === "canceled") {
        bookingId = match;
        outcome = await mirrorStatus(tx, match, event.notice.status);
      } else outcome = "ignored";
    } else if (event.notice?.kind === "transaction") {
      const rows = (await loadTransactionCandidates(tx, event.notice)).map(normalize);
      const match = matchTransaction(rows, event.notice);
      if (match === "ignored") outcome = "ignored";
      else if (match === "ambiguous") outcome = "ambiguous";
      else if (match === "none") outcome = "unmatched";
      else {
        bookingId = match;
        outcome = await recordPayment(tx, match, {
          amountCents: event.notice.amountCents,
          paidOn,
        });
      }
    }

    await tx`
      update qonto_webhook_receipts
      set outcome = ${outcome}, booking_id = ${bookingId}
      where event_id = ${event.eventId}
    `;
    return outcome;
  });
}

async function rawRequestBody(request: Request): Promise<Uint8Array | null> {
  if (Number(request.headers.get("content-length")) > MAX_WEBHOOK_BYTES) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export function createQontoWebhookHandler(options: {
  getSql: () => Promise<Sql>;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  onError?: (code: string) => void;
}): (request: Request) => Promise<Response> {
  const json = (body: Record<string, string | boolean>, status = 200) =>
    Response.json(body, { status, headers: { "cache-control": "no-store" } });
  return async (request) => {
    if (request.method !== "POST") return json({ ok: false, code: "method_not_allowed" }, 405);
    const secret = (options.env ?? process.env).QONTO_WEBHOOK_SECRET?.trim() ?? "";
    if (!secret) return json({ ok: false, code: "not_configured" }, 503);
    let raw: Uint8Array | null;
    try {
      raw = await rawRequestBody(request);
    } catch {
      return json({ ok: false, code: "invalid_body" }, 400);
    }
    if (raw === null) return json({ ok: false, code: "payload_too_large" }, 413);
    try {
      verifyQontoSignature({
        rawBody: raw,
        signatureHeader: request.headers.get("x-qonto-signature"),
        secret,
        nowSeconds: options.now ? Math.floor(options.now().getTime() / 1000) : undefined,
      });
    } catch (error) {
      const code = error instanceof QontoSignatureError ? error.code : "invalid_signature";
      return json({ ok: false, code }, 401);
    }
    let parsed: ReturnType<typeof readQontoNotice>;
    try {
      parsed = readQontoNotice(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)));
    } catch {
      return json({ ok: true, outcome: "ignored" });
    }
    if (!parsed) return json({ ok: true, outcome: "ignored" });
    try {
      const sql = await options.getSql();
      await ensureQontoWebhookSchema(sql);
      const outcome = await applyQontoNotice(
        sql,
        parsed,
        options.now?.() ?? new Date(),
      );
      return json({ ok: true, outcome });
    } catch {
      options.onError?.("qonto_receipt_storage_failed");
      return json({ ok: false, code: "storage_failed" }, 503);
    }
  };
}

export function qontoSignatureHeader(rawBody: string, secret: string, timestamp: number): string {
  return signQontoPayload({ rawBody, secret, timestamp }).header;
}
