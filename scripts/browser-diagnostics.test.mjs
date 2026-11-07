import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { assertBrowserDiagnostics, createBrowserDiagnostics } from "./browser-diagnostics.mjs";

const origin = "https://white-gloss.de";
function page() {
  return Object.assign(new EventEmitter(), { url: () => `${origin}/galerie` });
}
function request(url, method = "GET", errorText = "net::ERR_FAILED") {
  return { url: () => url, method: () => method, resourceType: () => "image", failure: () => ({ errorText }) };
}
function consoleError(text, url = "") {
  return { type: () => "error", text: () => text, location: () => ({ url, lineNumber: 0, columnNumber: 0 }) };
}

// A collected JavaScript exception must fail the audit, not merely appear in JSON.
test("a page exception fails the browser gate with its page and message", () => {
  const diagnostics = createBrowserDiagnostics({ origin, label: "mobile" });
  const browserPage = page();
  diagnostics.attach(browserPage);
  browserPage.emit("pageerror", new Error("Hydration failed"));
  assert.throws(() => assertBrowserDiagnostics([diagnostics]), /Hydration failed/);
  assert.equal(diagnostics.snapshot().errors[0].page, `${origin}/galerie`);
});

// HTTP errors do not emit requestfailed in Playwright; response status is essential.
test("missing assets and network failures fail even when their console text is generic", () => {
  const diagnostics = createBrowserDiagnostics({ origin });
  const browserPage = page();
  diagnostics.attach(browserPage);
  const missing = request(`${origin}/assets/gallery.webp`);
  browserPage.emit("response", { request: () => missing, status: () => 404, url: missing.url });
  browserPage.emit("requestfailed", request(`${origin}/assets/main.js`));
  browserPage.emit("console", consoleError("Failed to load resource: missing", `${origin}/assets/other.css`));
  assert.deepEqual(diagnostics.snapshot().errors.map((error) => error.type), ["http", "requestfailed", "console"]);
  assert.throws(() => assertBrowserDiagnostics([diagnostics]), /gallery\.webp/);
});

// Only failures caused by this exact deliberate read-only block are expected.
test("only explicitly blocked third-party reads and their resource messages are excluded", () => {
  const diagnostics = createBrowserDiagnostics({ origin });
  const browserPage = page();
  diagnostics.attach(browserPage);
  const blocked = request("https://third-party.example/image.webp");
  assert.equal(diagnostics.allowRequest(blocked), false);
  browserPage.emit("requestfailed", blocked);
  browserPage.emit("console", consoleError("Failed to load resource: net::ERR_FAILED", blocked.url()));
  assert.doesNotThrow(() => assertBrowserDiagnostics([diagnostics]));
  assert.equal(diagnostics.snapshot().blocked[0].reason, "external-read");
  assert.equal(diagnostics.snapshot().ignored.length, 2);
  browserPage.emit("console", consoleError("Unexpected application error", blocked.url()));
  browserPage.emit("console", consoleError("Failed to load resource: unattributed"));
  assert.equal(diagnostics.snapshot().errors.length, 2);
});

// A blocked write is still a safety regression, even though nothing was sent.
test("all write attempts are blocked and fail, for both local and external URLs", () => {
  for (const url of [`${origin}/api/booking`, "https://third-party.example/events"]) {
    const diagnostics = createBrowserDiagnostics({ origin });
    assert.equal(diagnostics.allowRequest(request(url, "POST")), false);
    assert.throws(() => assertBrowserDiagnostics([diagnostics]), /POST/);
    assert.equal(diagnostics.snapshot().blocked[0].reason, "write");
  }
});

test("healthy same-origin reads pass and a crashed page fails", () => {
  const diagnostics = createBrowserDiagnostics({ origin });
  const browserPage = page();
  diagnostics.attach(browserPage);
  const healthy = request(`${origin}/assets/main.js`);
  assert.equal(diagnostics.allowRequest(healthy), true);
  assert.equal(diagnostics.allowRequest(request(`${origin}/`, "HEAD")), true);
  browserPage.emit("response", { request: () => healthy, status: () => 200, url: healthy.url });
  assert.doesNotThrow(() => assertBrowserDiagnostics([diagnostics]));
  browserPage.emit("crash");
  assert.throws(() => assertBrowserDiagnostics([diagnostics]), /crash/);
});

// Routine failures must not leak query tokens into uploaded diagnostics.
test("request evidence removes URL credentials, query and fragment", () => {
  const diagnostics = createBrowserDiagnostics({ origin });
  diagnostics.allowRequest(request(`${origin}/api/booking?token=private#secret`, "POST"));
  const report = JSON.stringify(diagnostics.snapshot());
  assert.doesNotMatch(report, /private|secret|token=/);
  assert.match(report, /\/api\/booking/);
});
