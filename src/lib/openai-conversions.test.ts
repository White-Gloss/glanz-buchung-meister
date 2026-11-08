import assert from "node:assert/strict";
import { it } from "node:test";
import { bookingMeasurement, OPENAI_CONSENT_VERSION } from "./openai-measurement.ts";
import { reportOpenAiLead } from "./openai-conversions.server.ts";

it("does not read click identifiers without independent, current consent", () => {
  let reads = 0;
  const read = () => { reads++; return "?oppref=opaque%2Bclick&email=private"; };
  assert.equal(bookingMeasurement(false, read), undefined);
  assert.equal(reads, 0);
  assert.deepEqual(bookingMeasurement(true, read), { consent: OPENAI_CONSENT_VERSION, oppref: "opaque+click" });
  assert.equal(bookingMeasurement(false, read), undefined);
  assert.equal(reads, 1);
  assert.deepEqual(bookingMeasurement(true, () => "?oppref="), { consent: OPENAI_CONSENT_VERSION });
});

it("fails closed without consent or server configuration", async () => {
  const transport: typeof fetch = async () => { throw new Error("must not send"); };
  assert.equal(await reportOpenAiLead("request", undefined, { apiKey: "test", pixelId: "test", fetch: transport }), "disabled");
  assert.equal(await reportOpenAiLead("request", { consent: OPENAI_CONSENT_VERSION }, { apiKey: "", pixelId: "test", fetch: transport }), "disabled");
});

it("sends an allowlisted payload without customer data, raw capability or URL query", async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const transport: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), init: init! });
    return new Response("{}", { status: 200 });
  };
  const consent = { consent: OPENAI_CONSENT_VERSION, oppref: "opaque+click", email: "private@example.com", name: "Private Name" } as const;
  const options = { apiKey: "test-key", pixelId: "pixel", fetch: transport, now: 123456, validateOnly: true };
  assert.equal(await reportOpenAiLead("secret-upload-capability", consent, options), "sent");
  await reportOpenAiLead("secret-upload-capability", consent, options);
  const payload = JSON.parse(String(requests[0].init.body));
  assert.equal(payload.validate_only, true);
  assert.equal(requests[0].url, "https://bzr.openai.com/v1/events?pid=pixel");
  assert.equal(requests[0].init.redirect, "error");
  assert.ok(requests[0].init.signal instanceof AbortSignal);
  assert.deepEqual(payload.events[0], {
    id: payload.events[0].id, type: "lead_created", timestamp_ms: 123456,
    source_url: "https://white-gloss.de/", action_source: "web", opt_out: true,
    oppref: "opaque+click", data: { type: "customer_action" },
  });
  assert.match(payload.events[0].id, /^[a-f0-9]{64}$/);
  assert.equal(requests[0].init.body, requests[1].init.body);
  assert.doesNotMatch(String(requests[0].init.body), /private|secret-upload|test-key/i);
});

it("contains network and provider failures without throwing into the booking flow", async () => {
  const consent = { consent: OPENAI_CONSENT_VERSION } as const;
  for (const transport of [
    async () => new Response("error", { status: 503 }),
    async () => { throw new Error("timeout with secret details"); },
  ]) {
    assert.equal(await reportOpenAiLead("request", consent, { apiKey: "test", pixelId: "pixel", fetch: transport }), "failed");
  }
});
