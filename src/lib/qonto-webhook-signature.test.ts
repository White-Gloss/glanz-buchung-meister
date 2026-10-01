import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  computeQontoSignatureHex,
  parseQontoSignatureHeader,
  QontoSignatureError,
  signQontoPayload,
  verifyQontoSignature,
} from "./qonto-webhook-signature.ts";

const OFFICIAL = {
  payload: '{"test":"data"}',
  header: "t=1704110400,v1=56aff06dc227db80d6568a5070f912c601c31f20451745d257cbc0b5dfa93805",
  secret: "test-secret",
  timestamp: 1_704_110_400,
};

test("official Qonto test vector verifies at the signed timestamp", () => {
  const result = verifyQontoSignature({
    rawBody: OFFICIAL.payload,
    signatureHeader: OFFICIAL.header,
    secret: OFFICIAL.secret,
    nowSeconds: OFFICIAL.timestamp,
  });
  assert.equal(result.timestamp, OFFICIAL.timestamp);
});

test("computeQontoSignatureHex matches official digest", () => {
  const hex = computeQontoSignatureHex(
    OFFICIAL.secret,
    String(OFFICIAL.timestamp),
    Buffer.from(OFFICIAL.payload, "utf8"),
  );
  assert.equal(hex, "56aff06dc227db80d6568a5070f912c601c31f20451745d257cbc0b5dfa93805");
});

test("rejects missing header", () => {
  assert.throws(
    () =>
      verifyQontoSignature({
        rawBody: OFFICIAL.payload,
        signatureHeader: null,
        secret: OFFICIAL.secret,
        nowSeconds: OFFICIAL.timestamp,
      }),
    (err: unknown) => err instanceof QontoSignatureError && err.code === "missing_header",
  );
});

test("rejects malformed header", () => {
  assert.throws(
    () =>
      verifyQontoSignature({
        rawBody: OFFICIAL.payload,
        signatureHeader: "not-a-qonto-header",
        secret: OFFICIAL.secret,
        nowSeconds: OFFICIAL.timestamp,
      }),
    (err: unknown) => err instanceof QontoSignatureError && err.code === "malformed_header",
  );
});

test("rejects expired timestamp", () => {
  assert.throws(
    () =>
      verifyQontoSignature({
        rawBody: OFFICIAL.payload,
        signatureHeader: OFFICIAL.header,
        secret: OFFICIAL.secret,
        nowSeconds: OFFICIAL.timestamp + 301,
      }),
    (err: unknown) => err instanceof QontoSignatureError && err.code === "timestamp_expired",
  );
});

test("rejects future timestamp", () => {
  assert.throws(
    () =>
      verifyQontoSignature({
        rawBody: OFFICIAL.payload,
        signatureHeader: OFFICIAL.header,
        secret: OFFICIAL.secret,
        nowSeconds: OFFICIAL.timestamp - 301,
      }),
    (err: unknown) => err instanceof QontoSignatureError && err.code === "timestamp_future",
  );
});

test("rejects wrong secret", () => {
  assert.throws(
    () =>
      verifyQontoSignature({
        rawBody: OFFICIAL.payload,
        signatureHeader: OFFICIAL.header,
        secret: "other-secret",
        nowSeconds: OFFICIAL.timestamp,
      }),
    (err: unknown) => err instanceof QontoSignatureError && err.code === "invalid_signature",
  );
});

test("rejects mutated body without re-signing", () => {
  assert.throws(
    () =>
      verifyQontoSignature({
        rawBody: '{"test":"DATA"}',
        signatureHeader: OFFICIAL.header,
        secret: OFFICIAL.secret,
        nowSeconds: OFFICIAL.timestamp,
      }),
    (err: unknown) => err instanceof QontoSignatureError && err.code === "invalid_signature",
  );
});

test("accepts header with spaces and uppercase hex", () => {
  const header =
    "t = 1704110400 , v1 = 56AFF06DC227DB80D6568A5070F912C601C31F20451745D257CBC0B5DFA93805";
  const result = verifyQontoSignature({
    rawBody: Buffer.from(OFFICIAL.payload, "utf8"),
    signatureHeader: header,
    secret: OFFICIAL.secret,
    nowSeconds: OFFICIAL.timestamp,
  });
  assert.equal(result.timestamp, OFFICIAL.timestamp);
});

test("parseQontoSignatureHeader liest alle gültigen v1", () => {
  const parsed = parseQontoSignatureHeader(
    "t=1704110400,v0=deadbeef,v1=56aff06dc227db80d6568a5070f912c601c31f20451745d257cbc0b5dfa93805,v1=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );
  assert.equal(parsed.timestampRaw, "1704110400");
  assert.deepEqual(parsed.signaturesHex, [
    "56aff06dc227db80d6568a5070f912c601c31f20451745d257cbc0b5dfa93805",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  ]);
});

test("zweite v1-Signatur reicht, wenn die erste falsch ist", () => {
  const result = verifyQontoSignature({
    rawBody: OFFICIAL.payload,
    signatureHeader:
      "t=1704110400,v1=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,v1=56aff06dc227db80d6568a5070f912c601c31f20451745d257cbc0b5dfa93805",
    secret: OFFICIAL.secret,
    nowSeconds: OFFICIAL.timestamp,
  });
  assert.equal(result.timestamp, OFFICIAL.timestamp);
});

test("signQontoPayload und verify passen zusammen", () => {
  const rawBody = '{"type":"v1/transactions"}';
  const signed = signQontoPayload({
    rawBody,
    secret: "test-secret",
    timestamp: 1_800_000_000,
  });
  const result = verifyQontoSignature({
    rawBody,
    signatureHeader: signed.header,
    secret: "test-secret",
    nowSeconds: 1_800_000_000,
  });
  assert.equal(result.timestamp, 1_800_000_000);
  assert.match(signed.header, /^t=1800000000,v1=[0-9a-f]{64}$/);
});

test("live signing roundtrip", () => {
  const body = Buffer.from(
    JSON.stringify({ type: "v1/client-invoices", data: { status: "paid" } }),
  );
  const timestamp = 1_800_000_000;
  const secret = "whsec_live-example-secret-32chars-min";
  const hex = createHmac("sha256", secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`), body]))
    .digest("hex");

  const result = verifyQontoSignature({
    rawBody: body,
    signatureHeader: `t=${timestamp},v1=${hex}`,
    secret,
    nowSeconds: timestamp,
  });
  assert.equal(result.timestamp, timestamp);
});
