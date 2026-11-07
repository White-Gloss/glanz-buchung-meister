import assert from "node:assert/strict";
import test from "node:test";
import { prepareBrowserFixture } from "./qa/browser-fixture.mjs";

function fixture({ identity = "owned-run", configuredStatus = 200, availabilityStatus = 200 } = {}) {
  const requests = [];
  return { requests, fetchImpl: async (url, options = {}) => {
    requests.push({ url, ...options });
    if (url.endsWith("/identity")) return Response.json({ isolated: true, database: "in-memory-pglite", externalFetch: "blocked" }, { headers: { "x-qa-run-id": identity } });
    if (url.endsWith("/control")) return Response.json({ ok: true, bookingBackend: "panel", externalFetch: "blocked" }, { status: configuredStatus });
    return Response.json({ ok: true, windows: [], requestOnly: true }, { status: availabilityStatus, headers: { "cache-control": "no-store" } });
  } };
}
test("independent browser preparation verifies ownership, sets only the test fixture and proves real availability", async () => {
  const boundary = fixture();
  assert.deepEqual(await prepareBrowserFixture({ runId: "owned-run", scenario: "cross-browser", fetchImpl: boundary.fetchImpl }), { bookingBackend: "panel", availabilityStatus: 200, requestOnly: true });
  assert.deepEqual(JSON.parse(boundary.requests[1].body), { prepareBrowserFixture: true });
  assert.equal(boundary.requests[1].headers["x-qa-run-id"], "owned-run");
  assert.equal(boundary.requests[2].method, undefined);
  assert.ok(boundary.requests.every(({ url }) => new URL(url).hostname === "127.0.0.1"));
});
test("another run is never mutated and rejected fixture configuration prevents browsing", async () => {
  const foreign = fixture({ identity: "other-run" });
  await assert.rejects(prepareBrowserFixture({ runId: "owned-run", scenario: "cross-browser", fetchImpl: foreign.fetchImpl }));
  assert.equal(foreign.requests.length, 1);
  const rejected = fixture({ configuredStatus: 403 });
  await assert.rejects(prepareBrowserFixture({ runId: "owned-run", scenario: "cross-browser", fetchImpl: rejected.fetchImpl }));
  assert.equal(rejected.requests.length, 2);
});
test("availability errors and limits remain fatal after fixture configuration", async () => {
  for (const availabilityStatus of [429, 503]) {
    await assert.rejects(prepareBrowserFixture({ runId: "owned-run", scenario: "cross-browser", fetchImpl: fixture({ availabilityStatus }).fetchImpl }), /real availability route must be ready/);
  }
});
