import assert from "node:assert/strict";
import { qaBase, controlBase } from "./ports.mjs";
import { qaClientHeaders } from "./client-identity.mjs";

// Imported only by CI-guarded runners. This module itself starts no server.
export async function prepareBrowserFixture({ runId = process.env.QA_RUN_ID, scenario, fetchImpl = fetch } = {}) {
  assert.ok(runId, "A browser fixture requires this isolated run's identity");
  assert.ok(scenario, "A browser fixture requires a scenario name");
  const identity = await fetchImpl(controlBase + "/identity", { signal: AbortSignal.timeout(5000) });
  assert.equal(identity.status, 200);
  assert.equal(identity.headers.get("x-qa-run-id"), runId);
  assert.deepEqual(await identity.json(), { isolated: true, database: "in-memory-pglite", externalFetch: "blocked" });
  const configured = await fetchImpl(controlBase + "/control", {
    method: "POST", headers: { "content-type": "application/json", "x-qa-run-id": runId },
    body: JSON.stringify({ prepareBrowserFixture: true }), signal: AbortSignal.timeout(5000),
  });
  assert.equal(configured.status, 200);
  assert.deepEqual(await configured.json(), { ok: true, bookingBackend: "panel", externalFetch: "blocked" });
  const availability = await fetchImpl(qaBase + "/api/availability?from=2040-01-01&to=2040-02-01", {
    headers: qaClientHeaders("rate-limit-proof", `fixture:${scenario}`), signal: AbortSignal.timeout(5000),
  });
  assert.equal(availability.status, 200, "The real availability route must be ready before browser checks");
  assert.equal(availability.headers.get("cache-control"), "no-store");
  assert.deepEqual(await availability.json(), { ok: true, windows: [], requestOnly: true });
  return { bookingBackend: "panel", availabilityStatus: 200, requestOnly: true };
}
