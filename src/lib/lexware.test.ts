import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createLexwareClient,
  extractLexwareContacts,
  extractLexwareId,
  LexwareError,
  normalizeLexwareApiBase,
  type LexwareCredentials,
} from "./lexware.ts";

const creds: LexwareCredentials = {
  apiKey: "test-key",
  apiBase: "https://api.lexware.io/v1",
};

test("Lexware client backs off on HTTP 429", async () => {
  let attempts = 0;
  const sleeps: number[] = [];
  const fetchImpl: typeof fetch = async () => {
    attempts++;
    if (attempts === 1) return new Response("{}", { status: 429 });
    return new Response(JSON.stringify({ id: "e9066f04-8cc7-4616-93f8-ac9ecc8479c8" }), {
      status: 200,
    });
  };
  const client = createLexwareClient(creds, {
    fetchImpl,
    minIntervalMs: 0,
    sleepImpl: async (ms) => {
      sleeps.push(ms);
    },
  });
  const payload = await client<{ id: string }>("POST", "/contacts", { version: 0 });
  assert.equal(payload.id, "e9066f04-8cc7-4616-93f8-ac9ecc8479c8");
  assert.equal(attempts, 2);
  assert.ok(sleeps.some((ms) => ms >= 500));
});

test("extractLexwareId reads UUID payloads", () => {
  assert.equal(
    extractLexwareId("e9066f04-8cc7-4616-93f8-ac9ecc8479c8"),
    "e9066f04-8cc7-4616-93f8-ac9ecc8479c8",
  );
  assert.equal(
    extractLexwareId({ id: "e9066f04-8cc7-4616-93f8-ac9ecc8479c8" }),
    "e9066f04-8cc7-4616-93f8-ac9ecc8479c8",
  );
  assert.equal(extractLexwareId({ id: 3 }), null);
  assert.equal(extractLexwareId({ id: "not-a-uuid" }), null);
});

test("extractLexwareContacts reads paginated content", () => {
  const rows = extractLexwareContacts({
    content: [{ id: "e9066f04-8cc7-4616-93f8-ac9ecc8479c8" }],
  });
  assert.equal(rows.length, 1);
  assert.equal(extractLexwareContacts({}).length, 0);
});

test("normalizeLexwareApiBase rejects non-https and query", () => {
  assert.equal(normalizeLexwareApiBase(""), "https://api.lexware.io/v1");
  assert.equal(normalizeLexwareApiBase("https://api.lexware.io/v1/"), "https://api.lexware.io/v1");
  assert.throws(
    () => normalizeLexwareApiBase("http://api.lexware.io/v1"),
    (err: unknown) => err instanceof LexwareError && err.code === "lexware_invalid_api_base",
  );
  assert.throws(
    () => normalizeLexwareApiBase("https://api.lexware.io/v1?x=1"),
    (err: unknown) => err instanceof LexwareError && err.code === "lexware_invalid_api_base",
  );
});

test("401 is review, 5xx is retryable", async () => {
  const client401 = createLexwareClient(creds, {
    fetchImpl: async () => new Response("{}", { status: 401 }),
    minIntervalMs: 0,
    sleepImpl: async () => {},
  });
  await assert.rejects(
    () => client401("GET", "/contacts"),
    (err: unknown) =>
      err instanceof LexwareError && err.code === "lexware_access_denied" && err.review,
  );
  const client500 = createLexwareClient(creds, {
    fetchImpl: async () => new Response("{}", { status: 500 }),
    minIntervalMs: 0,
    sleepImpl: async () => {},
  });
  await assert.rejects(
    () => client500("GET", "/contacts"),
    (err: unknown) =>
      err instanceof LexwareError && err.code === "lexware_request_failed" && err.retryable,
  );
});
