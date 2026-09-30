process.env.ROAPP_ACCOUNT_SCOPE = "new-test-account";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { journalRoappWrites } from "./roapp-write-journal.ts";
import { RoappError, type RoappRequest } from "./roapp.ts";

test("journal replays completed items, stops ambiguous writes and permits rejected writes", async () => {
  const db = new PGlite();
  const sql = (async (parts: TemplateStringsArray, ...values: unknown[]) =>
    (
      await db.query(
        parts.reduce((s, p, i) => s + (i ? `$${i}` : "") + p, ""),
        values,
      )
    ).rows) as Sql;
  await db.exec(
    "create table roapp_write_journal (booking_id int, operation text, state text, response jsonb, primary key(booking_id,operation))",
  );
  let count = 0;
  const transport: RoappRequest = async <T>() => {
    count++;
    return { id: count } as T;
  };
  try {
    const request = journalRoappWrites(sql, 1, transport);
    assert.deepEqual(await request("POST", "/orders/1/items", { entity_id: 1 }), { id: 1 });
    assert.deepEqual(await request("POST", "/orders/1/items", { entity_id: 1 }), { id: 1 });
    await request("POST", "/orders/1/items", { entity_id: 2 });
    assert.equal(count, 2);
    const lost = journalRoappWrites(sql, 2, async () => {
      count++;
      throw new Error("response lost");
    });
    await assert.rejects(lost("POST", "/orders", {}), RoappError);
    await assert.rejects(lost("POST", "/orders", {}), RoappError);
    assert.equal(count, 3);
    const limited = journalRoappWrites(sql, 3, async () => {
      throw new RoappError("roapp_rate_limited", { status: 429 });
    });
    await assert.rejects(limited("POST", "/orders", {}), RoappError);
    await journalRoappWrites(sql, 3, transport)("POST", "/orders", {});
    assert.equal(count, 4);
    process.env.ROAPP_ACCOUNT_SCOPE = "another-test-account";
    await journalRoappWrites(sql, 1, transport)("POST", "/orders/1/items", { entity_id: 1 });
    assert.equal(count, 5, "responses from the former account are not replayed");
  } finally {
    await db.close();
  }
});

test("rejected or unsent writes are released with their reason; unclear writes stay blocked", async () => {
  process.env.ROAPP_ACCOUNT_SCOPE = "new-test-account";
  const { releaseRoappWrites, roappWriteStep, journalStep } =
    await import("./roapp-write-journal.ts");
  const { roappErrorDetail } = await import("./roapp.ts");
  const db = new PGlite();
  const sql = (async (parts: TemplateStringsArray, ...values: unknown[]) =>
    (
      await db.query(
        parts.reduce((s, p, i) => s + (i ? `$${i}` : "") + p, ""),
        values,
      )
    ).rows) as Sql;
  await db.exec(
    "create table roapp_write_journal (booking_id int, operation text, state text, response jsonb, primary key(booking_id,operation))",
  );
  try {
    let calls = 0;
    let next: () => unknown = () => ({ id: 1 });
    const request = journalRoappWrites(sql, 7, async <T>() => {
      calls++;
      return next() as T;
    });

    // Client error: RO did not write anything. Reason kept, intent released.
    next = () => {
      throw new RoappError("roapp_request_failed", {
        status: 422,
        review: true,
        detail: "Felder: branch_id",
      });
    };
    await assert.rejects(request("POST", "/orders", {}), (error: RoappError) => {
      assert.equal(error.code, "roapp_request_failed");
      assert.equal(error.status, 422);
      assert.equal(error.operation, "POST /orders");
      assert.equal(error.detail, "Felder: branch_id");
      return true;
    });
    // Never sent (account check before the write).
    next = () => {
      throw new RoappError("roapp_unreachable", { retryable: true });
    };
    await assert.rejects(request("POST", "/orders", {}), { code: "roapp_unreachable" });
    next = () => ({ id: 42 });
    assert.deepEqual(await request("POST", "/orders", {}), { id: 42 });
    assert.equal(calls, 3);

    // Server error or timeout: outcome unknown, blocked with step and cause.
    next = () => {
      throw new RoappError("roapp_request_failed", { status: 502, review: true });
    };
    await assert.rejects(
      request("POST", "/orders/42/items", { entity_id: 5 }),
      (error: RoappError) => {
        assert.equal(error.code, "roapp_write_needs_reconciliation");
        assert.equal(error.status, 502);
        assert.equal(error.operation, "POST /orders/:id/items");
        assert.equal(error.detail, "roapp_request_failed");
        return true;
      },
    );
    next = () => ({ id: 9 });
    await assert.rejects(request("POST", "/orders/42/items", { entity_id: 5 }), {
      code: "roapp_write_needs_reconciliation",
    });
    assert.equal(calls, 4, "an unclear write is never repeated automatically");
    // Owner checked RO and released it: the item is written once; done steps stay replayed.
    assert.equal(await releaseRoappWrites(sql, 7), 1);
    await request("POST", "/orders/42/items", { entity_id: 5 });
    assert.deepEqual(await request("POST", "/orders", {}), { id: 42 });
    assert.equal(calls, 5);

    assert.equal(roappWriteStep("POST", "/orders/123/comments"), "POST /orders/:id/comments");
    assert.equal(journalStep("scope-a:POST /orders/123/items:66904352"), "POST /orders/:id/items");
    assert.equal(journalStep("scope-a:POST /contacts/people"), "POST /contacts/people");
    assert.equal(
      roappErrorDetail({
        errors: { phones: ["+49 170 1234567 ungültig"] },
        message: "Person max@example.com mit +49 170 1234567 existiert",
      }),
      "Felder: phones · Person … mit … existiert",
    );
  } finally {
    await db.close();
  }
});
