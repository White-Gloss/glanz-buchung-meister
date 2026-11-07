import assert from "node:assert/strict";
import test from "node:test";
import { completeSuccessfulRead } from "./qa/read-completion.mjs";

test("an observed HTTP 200 cannot permit navigation before the response body finishes", async () => {
  const body = Promise.withResolvers();
  let completed = false;
  const waiting = completeSuccessfulRead({ status: () => 200, finished: () => body.promise }).then((result) => { completed = true; return result; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(completed, false, "Response headers alone must not permit navigation/context close");
  body.resolve(null);
  assert.deepEqual(await waiting, { status: 200, finished: true });
});

test("cancelled, failed and hung browser reads remain failures", async () => {
  await assert.rejects(completeSuccessfulRead({ status: () => 200, finished: async () => new Error("Load request cancelled") }), /Load request cancelled/);
  await assert.rejects(completeSuccessfulRead({ status: () => 503, finished: async () => null }), /must succeed/);
  await assert.rejects(completeSuccessfulRead({ status: () => 200, finished: () => new Promise(() => {}) }, { timeoutMs: 5 }), /did not finish/);
});
