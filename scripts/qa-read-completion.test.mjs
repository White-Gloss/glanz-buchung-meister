import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { completeSuccessfulRead, observeReadDuringAction } from "./qa/read-completion.mjs";

test("read observation starts before navigation but its deadline starts after UI preconditions", async () => {
  const page = new EventEmitter();
  const response = { status: () => 200 };
  const received = await observeReadDuringAction(page, (value) => value === response, async () => {
    page.emit("response", response);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }, { timeoutMs: 5 });
  assert.equal(received, response, "The real response received during navigation must be reused");
  assert.equal(page.listenerCount("response"), 0);
});

test("missing reads and UI failures remain fatal and always remove observation listeners", async () => {
  const page = new EventEmitter();
  await assert.rejects(observeReadDuringAction(page, () => true, async () => {}, { timeoutMs: 5 }), /not observed/);
  assert.equal(page.listenerCount("response"), 0);
  await assert.rejects(observeReadDuringAction(page, () => true, async () => { throw new Error("Visible reviews failed"); }), /Visible reviews failed/);
  assert.equal(page.listenerCount("response"), 0);
});

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
