import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { completeSuccessfulRead, observePageReads, observeReadDuringAction } from "./qa/read-completion.mjs";
import { assertBrowserDiagnostics, createBrowserDiagnostics } from "./browser-diagnostics.mjs";

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

const origin = "http://127.0.0.1:8082";
function pendingRead(page, path, resourceType = "image", status = 200) {
  const body = Promise.withResolvers();
  const response = { status: () => status, finished: () => body.promise, request: () => request };
  const request = { method: () => "GET", url: () => `${origin}${path}`, resourceType: () => resourceType, response: async () => response, failure: () => ({ errorText: "NS_BINDING_ABORTED" }) };
  page.emit("request", request);
  page.emit("response", response);
  return {
    request,
    finish: () => { body.resolve(null); page.emit("requestfinished", request); },
    fail: () => { body.resolve(new Error("NS_BINDING_ABORTED")); page.emit("requestfailed", request); },
  };
}

test("navigation waits for already started page images, including offscreen images", async () => {
  const page = new EventEmitter();
  const reads = observePageReads(page, origin);
  const logo = pendingRead(page, "/media/logo-176.webp");
  const atelier = pendingRead(page, "/media/atelier-480.webp");
  let navigated = false;
  const navigation = reads.complete("gallery before navigation").then((result) => { navigated = true; return result; });
  try {
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(navigated, false, "Navigating now would abort the two in-flight images");
    logo.finish();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(navigated, false, "Every started image must finish before navigation");
    atelier.finish();
    const evidence = await navigation;
    assert.equal(evidence.pending, 0);
    assert.deepEqual(evidence.completed.map((item) => item.path).sort(), ["/media/atelier-480.webp", "/media/logo-176.webp"]);
  } finally { logo.finish(); atelier.finish(); await navigation; }
});

test("an image started while earlier page reads finish must also delay navigation", async () => {
  const page = new EventEmitter();
  const reads = observePageReads(page, origin);
  const script = pendingRead(page, "/assets/page.js", "script");
  let navigated = false;
  const navigation = reads.complete("gallery interaction").then(() => { navigated = true; });
  await new Promise((resolve) => setImmediate(resolve));
  const image = pendingRead(page, "/media/atelier-480.webp");
  try {
    script.finish();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(navigated, false);
    image.finish();
    await navigation;
  } finally { script.finish(); image.finish(); await navigation; }
});

test("real failed image requests still fail completion and the independent diagnostics", async () => {
  const page = Object.assign(new EventEmitter(), { url: () => `${origin}/galerie` });
  const reads = observePageReads(page, origin);
  const diagnostics = createBrowserDiagnostics({ origin });
  diagnostics.attach(page);
  const image = pendingRead(page, "/media/atelier-480.webp");
  const completion = reads.complete("gallery");
  setImmediate(() => image.fail());
  await assert.rejects(completion, /NS_BINDING_ABORTED/);
  assert.throws(() => assertBrowserDiagnostics([diagnostics]), /NS_BINDING_ABORTED/);
});

test("a stalled page image times out with its path without exposing query credentials", async () => {
  const page = new EventEmitter();
  const reads = observePageReads(page, origin);
  const image = pendingRead(page, "/media/atelier-480.webp?token=private");
  try {
    await assert.rejects(reads.complete("gallery", { timeoutMs: 5 }), (error) => {
      assert.match(error.message, /did not finish before navigation.*\/media\/atelier-480\.webp/);
      assert.doesNotMatch(error.message, /token|private/);
      return true;
    });
  } finally { image.finish(); }
});

test("missing page images remain HTTP failures and open media streams are not tracked", async () => {
  const page = new EventEmitter();
  const reads = observePageReads(page, origin);
  const missing = pendingRead(page, "/media/missing.webp", "image", 404);
  try {
    await assert.rejects(reads.complete("gallery"), /must succeed/);
  } finally { missing.finish(); }
  const media = pendingRead(page, "/media/film.mp4", "media");
  try { assert.equal((await reads.complete("gallery", { timeoutMs: 5 })).pending, 0); }
  finally { media.finish(); }
});
