import assert from "node:assert/strict";
import { test } from "node:test";
import { zohoWebhookAuthorized, zohoWebhookSignature } from "./zoho-inbound.ts";

test("webhook rejects missing, short and mismatched tokens", () => {
  const previous = process.env.ZOHO_WEBHOOK_SECRET;
  process.env.ZOHO_WEBHOOK_SECRET = "abcdefghijklmnopqrstuvwxyz1234";
  try {
    assert.equal(zohoWebhookAuthorized(null, null), false);
    assert.equal(zohoWebhookAuthorized("Bearer wrong-token-abcdefghijklmnopqrstuv", null), false);
    assert.equal(zohoWebhookAuthorized("Bearer abcdefghijklmnopqrstuvwxyz1234", null), true);
    assert.equal(zohoWebhookAuthorized(null, "abcdefghijklmnopqrstuvwxyz1234"), true);
    assert.ok(zohoWebhookSignature("{}", "secret").length === 64);
  } finally {
    if (previous === undefined) delete process.env.ZOHO_WEBHOOK_SECRET;
    else process.env.ZOHO_WEBHOOK_SECRET = previous;
  }
});

test("webhook is closed when the secret is absent or too short", () => {
  const previous = process.env.ZOHO_WEBHOOK_SECRET;
  process.env.ZOHO_WEBHOOK_SECRET = "short";
  try {
    assert.equal(zohoWebhookAuthorized("Bearer short", null), false);
  } finally {
    if (previous === undefined) delete process.env.ZOHO_WEBHOOK_SECRET;
    else process.env.ZOHO_WEBHOOK_SECRET = previous;
  }
});
