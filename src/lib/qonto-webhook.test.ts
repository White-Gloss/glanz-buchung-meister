import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import {
  applyQontoNotice,
  createQontoWebhookHandler,
  ensureQontoWebhookSchema,
  matchClientInvoice,
  matchTransaction,
  qontoSignatureHeader,
  readQontoNotice,
} from "./qonto-webhook.ts";

const secret = "test-webhook-secret";
const now = new Date("2026-10-01T10:00:00.000Z");
const timestamp = Math.floor(now.getTime() / 1000);

const invoice = (status = "paid", id = "4d5418bb-bd0d-4df4-865c-c07afab8bb48") => ({
  id: "123e4567-e89b-12d3-a456-426614174000",
  type: "v1/client-invoices",
  data: {
    id,
    number: "WG-RE-1042",
    status,
    currency: "EUR",
    total_amount: { value: "436.00", currency: "EUR" },
    paid_at: "2026-10-01T09:15:00+02:00",
    contact_email: "kunde@example.invalid",
    client: { email: "kunde@example.invalid", name: "Kunde" },
    payment_methods: [{ iban: "DE89370400440532013000", type: "transfer" }],
  },
});

const post = (body: unknown, header?: string | null) => {
  const raw = JSON.stringify(body);
  return new Request("https://white-gloss.de/api/qonto-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(header === null
        ? {}
        : { "x-qonto-signature": header ?? qontoSignatureHeader(raw, secret, timestamp) }),
    },
    body: raw,
  });
};

function candidate(
  patch: Partial<{
    id: number;
    qonto_invoice_id: string | null;
    qonto_invoice_number: string | null;
    agreed_price_cents: number | null;
    total_cents: number | null;
  }> = {},
) {
  return {
    id: 1,
    qonto_invoice_id: null,
    qonto_invoice_number: "WG-RE-1042",
    agreed_price_cents: 43600,
    estimated_price_cents: null,
    total_cents: 43600,
    payment_status: "offen",
    qonto_invoice_status: "unpaid",
    version: 1,
    ...patch,
  };
}

describe("Qonto webhook matching", () => {
  it("reads an invoice notice without keeping customer fields", () => {
    const notice = readQontoNotice(invoice());
    assert.equal(notice?.notice?.kind, "invoice");
    assert.equal(JSON.stringify(notice).includes("kunde@"), false);
    assert.equal(JSON.stringify(notice).includes("DE89"), false);
    if (notice?.notice?.kind === "invoice") {
      assert.equal(notice.notice.amountCents, 43600);
      assert.equal(notice.notice.paidOn, "2026-10-01");
    }
  });

  it("marks a unique invoice id even when the local amount differs", () => {
    assert.equal(
      matchClientInvoice(
        [
          candidate({
            qonto_invoice_id: "4d5418bb-bd0d-4df4-865c-c07afab8bb48",
            agreed_price_cents: 100,
          }),
        ],
        {
          id: "4d5418bb-bd0d-4df4-865c-c07afab8bb48",
          number: "WG-RE-1042",
          amountCents: 43600,
          currency: "EUR",
        },
      ),
      1,
    );
  });

  it("requires amount when only the invoice number matches", () => {
    assert.equal(
      matchClientInvoice([candidate({ agreed_price_cents: 100, total_cents: 100 })], {
        id: "4d5418bb-bd0d-4df4-865c-c07afab8bb48",
        number: "WG-RE-1042",
        amountCents: 43600,
        currency: "EUR",
      }),
      "ambiguous",
    );
  });

  it("does not treat a prefix of an invoice number as a payment", () => {
    assert.equal(
      matchTransaction(
        [
          candidate({ qonto_invoice_number: "WG-RE-10" }),
          candidate({ id: 2, qonto_invoice_number: "WG-RE-1042" }),
        ],
        {
          side: "credit",
          status: "completed",
          currency: "EUR",
          amountCents: 43600,
          reference: "WG-RE-1042",
          label: "",
        },
      ),
      2,
    );
  });
});

async function database(options: { ensureQontoSchema?: boolean } = {}) {
  const pg = new PGlite();
  await pg.exec(`
    create table bookings (
      id serial primary key,
      shop_id text not null,
      version integer not null default 1,
      payment_status text not null default 'offen',
      payment_method text,
      payment_recorded_cents integer,
      payment_recorded_on date,
      qonto_invoice_id text,
      qonto_invoice_number text,
      qonto_invoice_status text,
      agreed_price_cents integer,
      estimated_price_cents integer,
      total_cents integer
    );
    create table booking_events (
      id serial primary key,
      shop_id text not null,
      booking_id integer not null,
      event text not null,
      actor text not null,
      version integer not null,
      before_data jsonb,
      after_data jsonb not null,
      created_at timestamptz not null default now()
    );
    create table _migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  const adapter = (
    query: (statement: string, values?: unknown[]) => Promise<{ rows: unknown[] }>,
  ) => {
    const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      let statement = strings[0];
      values.forEach((_, index) => {
        statement += `$${index + 1}${strings[index + 1]}`;
      });
      return (await query(statement, values)).rows;
    }) as Sql;
    sql.query = async (statement, values) => (await query(statement, values)).rows as never[];
    sql.transaction = (work) => work(sql);
    return sql;
  };
  const sql = adapter((statement, values) => pg.query(statement, values));
  sql.transaction = (work) =>
    pg.transaction((tx) => work(adapter((statement, values) => tx.query(statement, values))));
  if (options.ensureQontoSchema !== false) await ensureQontoWebhookSchema(sql);
  await pg.query(
    `insert into bookings (shop_id, qonto_invoice_id, qonto_invoice_number, qonto_invoice_status, agreed_price_cents, total_cents)
     values ('white-gloss', $1, 'WG-RE-1042', 'unpaid', 43600, 43600)`,
    ["4d5418bb-bd0d-4df4-865c-c07afab8bb48"],
  );
  return { pg, sql };
}

describe("Qonto webhook route", () => {
  it("rejects an unsigned body and does not open the database", async () => {
    let opened = false;
    const handle = createQontoWebhookHandler({
      env: { QONTO_WEBHOOK_SECRET: secret },
      now: () => now,
      getSql: async () => {
        opened = true;
        throw new Error("must not open");
      },
    });
    const response = await handle(post(invoice(), null));
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.code, "missing_header");
    assert.equal(opened, false);
  });

  it("rejects a mutated signed body", async () => {
    const raw = JSON.stringify(invoice());
    const handle = createQontoWebhookHandler({
      env: { QONTO_WEBHOOK_SECRET: secret },
      now: () => now,
      getSql: async () => {
        throw new Error("must not open");
      },
    });
    const response = await handle(
      new Request("https://white-gloss.de/api/qonto-webhook", {
        method: "POST",
        headers: { "x-qonto-signature": qontoSignatureHeader(raw, secret, timestamp) },
        body: raw.replace("paid", "PAID"),
      }),
    );
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "invalid_signature");
  });

  it("stays dark until the webhook secret is configured", async () => {
    const handle = createQontoWebhookHandler({
      env: {},
      getSql: async () => {
        throw new Error("must not open");
      },
    });
    const response = await handle(post(invoice()));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "not_configured");
  });

  it("marks the mapped booking paid once and ignores the same event id", async () => {
    const { pg, sql } = await database({ ensureQontoSchema: false });
    assert.equal(
      (
        await pg.query<{ present: boolean }>(
          "select to_regclass('qonto_webhook_receipts') is not null as present",
        )
      ).rows[0].present,
      false,
    );
    const handle = createQontoWebhookHandler({
      env: { QONTO_WEBHOOK_SECRET: secret },
      now: () => now,
      getSql: async () => sql,
    });
    const first = await handle(post(invoice()));
    const second = await handle(post(invoice()));
    assert.equal(first.status, 200);
    assert.equal((await first.json()).outcome, "paid");
    assert.equal(second.status, 200);
    assert.equal((await second.json()).outcome, "duplicate");
    assert.deepEqual(
      (await pg.query("select name from _migrations")).rows,
      [{ name: "0024_qonto_webhook.sql" }],
    );
    const [booking] = (
      await pg.query<{
        payment_status: string;
        version: number;
        payment_recorded_cents: number;
        qonto_invoice_status: string;
      }>(
        "select payment_status, version, payment_recorded_cents, qonto_invoice_status from bookings",
      )
    ).rows;
    assert.equal(booking.payment_status, "bezahlt");
    assert.equal(booking.qonto_invoice_status, "paid");
    assert.equal(booking.payment_recorded_cents, 43600);
    assert.equal(booking.version, 2);
    const events = (await pg.query("select event, actor from booking_events")).rows;
    assert.deepEqual(events, [{ event: "qonto.invoice_paid", actor: "qonto-webhook" }]);
    const stored = JSON.stringify((await pg.query("select * from qonto_webhook_receipts")).rows);
    assert.equal(stored.includes("kunde@"), false);
    assert.equal(stored.includes("DE89"), false);
  });

  it("leaves two matching invoice numbers unpaid", async () => {
    const { pg, sql } = await database();
    await pg.query(
      `insert into bookings (shop_id, qonto_invoice_number, agreed_price_cents, total_cents)
       values ('white-gloss', 'WG-RE-1042', 43600, 43600)`,
    );
    await pg.query("update bookings set qonto_invoice_id = null");
    const outcome = await applyQontoNotice(
      sql,
      readQontoNotice(invoice("paid", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"))!,
      now,
    );
    assert.equal(outcome, "ambiguous");
    const statuses = (
      await pg.query<{ payment_status: string }>("select payment_status from bookings")
    ).rows;
    assert.deepEqual(
      statuses.map((row) => row.payment_status),
      ["offen", "offen"],
    );
  });

  it("books a unique credit when reference and amount match", async () => {
    const { pg, sql } = await database();
    await pg.query("update bookings set qonto_invoice_id = null");
    const payload = {
      id: "223e4567-e89b-12d3-a456-426614174111",
      type: "v1/transactions",
      data: {
        side: "credit",
        status: "completed",
        currency: "EUR",
        amount: 436,
        reference: "Zahlung WG-RE-1042",
        label: "Kunde",
        settled_at: "2026-10-01T11:00:00Z",
      },
    };
    const handle = createQontoWebhookHandler({
      env: { QONTO_WEBHOOK_SECRET: secret },
      now: () => now,
      getSql: async () => sql,
    });
    const response = await handle(post(payload));
    assert.equal((await response.json()).outcome, "paid");
    assert.equal(
      (await pg.query<{ payment_status: string }>("select payment_status from bookings")).rows[0]
        .payment_status,
      "bezahlt",
    );
  });

  it("acks a signed test payload that is not an event", async () => {
    const handle = createQontoWebhookHandler({
      env: { QONTO_WEBHOOK_SECRET: secret },
      now: () => now,
      getSql: async () => {
        throw new Error("must not open");
      },
    });
    const response = await handle(post({ test: "data" }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).outcome, "ignored");
  });

  it("antwortet bei Speicherfehler ohne den Datenbanktext", async () => {
    const errors: string[] = [];
    const handle = createQontoWebhookHandler({
      env: { QONTO_WEBHOOK_SECRET: secret },
      now: () => now,
      getSql: async () => {
        throw new Error("secret connection string");
      },
      onError: (code) => errors.push(code),
    });
    const response = await handle(post(invoice()));
    assert.equal(response.status, 503);
    const text = JSON.stringify(await response.json());
    assert.equal(text.includes("secret"), false);
    assert.deepEqual(errors, ["qonto_receipt_storage_failed"]);
  });
});
