import assert from "node:assert/strict";
import test from "node:test";
import { BitrixError } from "./bitrix-error.ts";
import { createBitrixRestClient } from "./bitrix-rest.ts";

// Deliberately non-routable test host; every request uses injected fetch.
// These are API-contract fixtures, not evidence of a live Bitrix24 account.
const webhook = "https://bitrix.invalid/rest/1/test-only/";
const stageId = "TEST_INVOICE:SENT";
type RecordedCall = { url: string; method?: string; body: Record<string, unknown> };

function fixture(result: unknown, status = 200) {
  const calls: RecordedCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return new Response(JSON.stringify({ result }), { status });
  };
  return { calls, request: createBitrixRestClient(webhook, fetchImpl) };
}

function needsReview(error: unknown) {
  return error instanceof BitrixError && error.review && !error.retryable;
}

test("reads an existing smart invoice through crm.item.get and unwraps result.item", async () => {
  const item = { id: 42, entityTypeId: 31, stageId, title: "Test invoice" };
  const { request, calls } = fixture({ item });
  const invoice = await request("GET", "/invoices/42");
  assert.deepEqual(invoice, item);
  assert.deepEqual(calls, [{
    url: `${webhook}crm.item.get.json`, method: "POST",
    body: { entityTypeId: 31, id: 42 },
  }]);
});

test("updates only the stage of an existing smart invoice with crm.item.update", async () => {
  const item = { id: 42, entityTypeId: 31, stageId };
  const { request, calls } = fixture({ item });
  assert.deepEqual(await request("PATCH", "/invoices/42", { stageId }), item);
  assert.deepEqual(calls, [{
    url: `${webhook}crm.item.update.json`, method: "POST",
    body: { entityTypeId: 31, id: 42, fields: { stageId } },
  }]);
});

test("repeated status requests update the same invoice and never create another invoice", async () => {
  const { request, calls } = fixture({ item: { id: 42, stageId } });
  await request("PATCH", "/invoices/42", { stageId });
  await request("PATCH", "/invoices/42", { stageId });
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.url, `${webhook}crm.item.update.json`);
    assert.equal(call.body.id, 42);
  }
});

test("accepts a numeric string invoice ID returned by the API", async () => {
  const item = { id: "42", stageId };
  const { request } = fixture({ item });
  assert.deepEqual(await request("GET", "/invoices/42"), item);
});

test("rejects missing, malformed or mismatched invoice results rather than reporting success", async () => {
  const invalidResults: unknown[] = [
    null, true, {}, { item: null }, { item: [] }, { item: "invoice" },
    { item: { id: 43, stageId } }, { item: { id: true, stageId } },
    { item: { id: 42 } }, { item: { id: 42, stageId: " " } },
    { item: { id: 42, stageId: 1 } },
    { item: { id: 42, entityTypeId: 2, stageId } },
  ];
  for (const result of invalidResults) {
    const { request, calls } = fixture(result);
    await assert.rejects(request("GET", "/invoices/42"), needsReview);
    assert.equal(calls.length, 1, "the API response must actually be checked");
  }
});

test("requires the update response to confirm the requested stage and invoice ID", async () => {
  for (const item of [
    { id: 42, stageId: "TEST_INVOICE:OTHER" },
    { id: 43, stageId },
    { id: 42 },
  ]) {
    const { request, calls } = fixture({ item });
    await assert.rejects(request("PATCH", "/invoices/42", { stageId }), needsReview);
    assert.equal(calls.length, 1);
  }
});

test("rejects missing or invalid stage updates before sending any request", async () => {
  const payloads: unknown[] = [undefined, null, true, [], "stage", {},
    { stageId: 123 }, { stageId: "" }, { stageId: " " }, { stageId: ` ${stageId}` }];
  for (const body of payloads) {
    const { request, calls } = fixture({ item: { id: 42, stageId } });
    await assert.rejects(request("PATCH", "/invoices/42", body), needsReview);
    assert.equal(calls.length, 0);
  }
});

test("rejects attempts to alter issued invoice contents through the status adapter", async () => {
  for (const extra of [
    { opportunity: 1 }, { accountNumber: "replacement" }, { id: 99 },
    { entityTypeId: 2 }, { fields: { opportunity: 1 } },
  ]) {
    const { request, calls } = fixture({ item: { id: 42, stageId } });
    await assert.rejects(request("PATCH", "/invoices/42", { stageId, ...extra }), needsReview);
    assert.equal(calls.length, 0);
  }
});

test("rejects invalid invoice IDs and unsupported invoice operations without network access", async () => {
  for (const [method, path] of [
    ["GET", "/invoices/0"], ["GET", "/invoices/-1"], ["GET", "/invoices/1.5"],
    ["GET", "/invoices/9007199254740993"], ["GET", "/invoices/42/extra"],
    ["GET", "/invoices/42?other=1"], ["GET", "/invoices/042"],
    ["POST", "/invoices"], ["POST", "/invoices/42"], ["DELETE", "/invoices/42"],
  ]) {
    const { request, calls } = fixture({ item: { id: 42, stageId } });
    await assert.rejects(request(method, path, { stageId }), needsReview);
    assert.equal(calls.length, 0);
  }
});

test("propagates an API permission failure without claiming an invoice update succeeded", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ error: "ACCESS_DENIED", error_description: "Denied" }), { status: 403 });
  };
  const request = createBitrixRestClient(webhook, fetchImpl);
  await assert.rejects(request("PATCH", "/invoices/42", { stageId }),
    (error: unknown) => error instanceof BitrixError && error.code === "ACCESS_DENIED");
  assert.equal(calls, 1);
});

test("does not blindly retry a status update after a network failure", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => { calls++; throw new Error("test network failure"); };
  const request = createBitrixRestClient(webhook, fetchImpl);
  await assert.rejects(request("PATCH", "/invoices/42", { stageId }),
    (error: unknown) => error instanceof BitrixError && error.code === "bitrix_network");
  assert.equal(calls, 1);
});

test("preserves the existing deal-update mapping", async () => {
  const { request, calls } = fixture(true);
  assert.deepEqual(await request("PATCH", "/deals/7", { title: "Test", amount: 120 }), { ok: true });
  assert.deepEqual(calls, [{
    url: `${webhook}crm.deal.update.json`, method: "POST",
    body: { id: 7, fields: { TITLE: "Test", OPPORTUNITY: 120 } },
  }]);
});

test("preserves the existing contact-search mapping", async () => {
  const { request, calls } = fixture([{ ID: "7" }]);
  assert.deepEqual(await request("POST", "/contacts/search", { filter: { email: "test@example.invalid" } }), [{ id: 7 }]);
  assert.deepEqual(calls[0].body, { filter: { EMAIL: "test@example.invalid" }, select: ["ID"] });
});
