import assert from "node:assert/strict";
import { test } from "node:test";
import { reminderEligible, lexwareMailKey } from "./lexware-mail.ts";
import { isApprovedCustomerNotification } from "./billing-policy.ts";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { ensureLexwareSchema } from "./lexware-sync.ts";
import { queueLexwareMail } from "./lexware-mail.ts";
import { runNotificationWorker } from "./notification-worker.ts";
const voucher = {
  id: "11111111-2222-3333-4444-555555555555",
  voucherStatus: "overdue",
  dueDate: "2026-09-01T00:00:00+02:00",
};
const payment = {
  openAmount: "119.00",
  currency: "EUR",
  voucherStatus: "open",
  paymentStatus: "openRevenue",
};
test("reminders require authoritative open balance, overdue status and seven-day grace", () => {
  const now = new Date("2026-09-08T12:00:00Z");
  assert.equal(reminderEligible(payment, voucher, now), true);
  assert.equal(reminderEligible(payment, voucher, new Date("2026-09-07T12:00:00Z")), false);
  for (const patch of [
    { openAmount: 0 },
    { openAmount: -1 },
    { openAmount: "invalid" },
    { currency: "USD" },
    { voucherStatus: "paid" },
    { voucherStatus: "voided" },
    { paymentStatus: "unknown" },
  ])
    assert.equal(reminderEligible({ ...payment, ...patch }, voucher, now), false);
  for (const patch of [
    { dueDate: undefined },
    { dueDate: "2026-02-31" },
    { archived: true },
    { voucherStatus: "open" },
  ])
    assert.equal(reminderEligible(payment, { ...voucher, ...patch }, now), false);
});

test("isolated invoice delivery deduplicates and payment before reminder cancels delivery", async (t) => {
  const pg = new PGlite({ parsers: { 1082: (value) => value, 20: Number } });
  const previous = {
    LEXWARE_API_KEY: process.env.LEXWARE_API_KEY,
    LEXWARE_API_BASE: process.env.LEXWARE_API_BASE,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    MAIL_FROM: process.env.MAIL_FROM,
  };
  Object.assign(process.env, {
    LEXWARE_API_KEY: "isolated-test-only",
    LEXWARE_API_BASE: "https://api.lexware.io/v1",
    RESEND_API_KEY: "isolated-test-only",
    MAIL_FROM: "test@example.invalid",
  });
  function wrap(db: Pick<PGlite, "query">): Sql {
    const sql = (async (parts: TemplateStringsArray, ...values: unknown[]) =>
      (
        await db.query(
          parts.reduce((s, p, i) => s + (i ? `$${i}` : "") + p, ""),
          values,
        )
      ).rows) as Sql;
    sql.query = async <T>(query: string, params: unknown[] = []) =>
      (await db.query<T>(query, params)).rows;
    sql.transaction = (work) => pg.transaction((tx) => work(wrap(tx)));
    return sql;
  }
  const sql = wrap(pg);
  try {
    for (const file of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
      await pg.exec(await readFile(`migrations/${file}`, "utf8"));
    await ensureLexwareSchema(sql);
    const [booking] = await sql<{
      id: number;
    }>`insert into bookings(shop_id,customer_name,phone,email,package_id,class_id) values('white-gloss','TEST Lars','000000000','customer@example.invalid','basis','kompakt') returning id`;
    const contact = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    await sql`insert into lexware_sync_queue(booking_id,shop_id,requested_version,lex_invoice_id,lex_contact_id,billing_data) values(${booking.id},'white-gloss',1,${voucher.id},${contact},'{}'::jsonb)`;
    let paid = false;
    let sent = 0;
    let pdfs = 0;
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
      const url = String(input);
      assert.ok(
        url.startsWith("https://api.lexware.io/v1/"),
        "All real providers are forbidden in this test",
      );
      if (url.includes("/payments/"))
        return Response.json({
          ...payment,
          openAmount: paid ? 0 : 119,
          voucherStatus: paid ? "paid" : "open",
        });
      if (url.includes("/voucherlist?"))
        return Response.json({ content: [{ ...voucher, dueDate: "2020-01-01" }] });
      if (url.endsWith("/file")) {
        pdfs++;
        return new Response("%PDF-isolated-fixture", {
          headers: { "content-type": "application/pdf" },
        });
      }
      return Response.json({
        id: voucher.id,
        voucherNumber: "TEST-ONLY-001",
        voucherStatus: paid ? "paid" : "open",
        address: { contactId: contact },
        remark: `Website-Buchung WG-${booking.id}`,
      });
    });
    const sendEmail = async (input: { to: string; attachments?: unknown[] }) => {
      assert.equal(input.to, "customer@example.invalid");
      assert.equal(input.attachments?.length, 1);
      sent++;
      return { id: `mock-${sent}` };
    };
    assert.equal((await queueLexwareMail(sql, booking.id, "invoice")).queued, true);
    assert.equal((await queueLexwareMail(sql, booking.id, "invoice")).queued, false);
    await runNotificationWorker(sql, { sendEmail });
    assert.equal(sent, 1);
    assert.equal(pdfs, 1);
    assert.equal((await queueLexwareMail(sql, booking.id, "reminder")).queued, true);
    paid = true;
    await runNotificationWorker(sql, { sendEmail });
    assert.equal(sent, 1, "A newly paid invoice must never be reminded");
    const [reminder] = await sql<{
      status: string;
    }>`select status from outbound_queue where event_key=${lexwareMailKey(voucher.id, "reminder")}`;
    assert.equal(reminder.status, "cancelled");
  } finally {
    await pg.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
test("new customer flow never unlocks historical messages", () => {
  assert.equal(
    isApprovedCustomerNotification("booking:1:event:1:customer:email:abc", "booking.created"),
    false,
  );
  assert.equal(
    isApprovedCustomerNotification("booking:1:event:1:customer-v2:email:abc", "booking.created"),
    true,
  );
  assert.equal(
    isApprovedCustomerNotification("booking:1:event:1:customer-v2:email:abc", "invoice.arbitrary"),
    false,
  );
  assert.equal(
    isApprovedCustomerNotification(lexwareMailKey(voucher.id, "invoice"), "lexware.invoice"),
    true,
  );
  assert.equal(
    isApprovedCustomerNotification("zoho:confirmation:12:3:email:abc", "booking.confirmed"),
    true,
  );
  assert.equal(lexwareMailKey(voucher.id, "invoice"), lexwareMailKey(voucher.id, "invoice"));
});
