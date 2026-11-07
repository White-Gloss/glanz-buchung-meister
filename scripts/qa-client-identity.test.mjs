import assert from "node:assert/strict";
import test from "node:test";
import { qaClientHeaders } from "./qa/client-identity.mjs";
import { createHeadInjector, injectGrokPwaHead } from "./grok-pwa-shared.mjs";

// Independent tests must not share the application's "unknown" rate-limit bucket.
test("a scenario retains one client identity while independent scenarios receive separate quotas", () => {
  const first = qaClientHeaders("booking-ui", "desktop");
  assert.deepEqual(qaClientHeaders("booking-ui", "desktop"), first);
  assert.notDeepEqual(qaClientHeaders("booking-ui", "mobile"), first);
  assert.notDeepEqual(qaClientHeaders("responsive", "desktop"), first);
  assert.match(first["x-forwarded-for"], /^2001:db8:(?:[a-f0-9]{4}:){5}[a-f0-9]{4}$/);
});

test("missing scenario labels and non-QA suites fail instead of sharing an accidental identity", () => {
  assert.throws(() => qaClientHeaders("booking-ui", ""));
  assert.throws(() => qaClientHeaders("live", "desktop"));
});

test("public browser suites render the customer deployment without changing their loopback transport", () => {
  for (const suite of ["booking-ui", "responsive", "cross-browser", "hero-stability", "lighthouse"]) {
    const headers = qaClientHeaders(suite, "customer-document");
    assert.equal(headers["x-forwarded-host"], "white-gloss.de", suite);
    assert.equal(headers.host, undefined, "the actual Host and loopback URL are not replaced");
    assert.equal(headers.origin, undefined, "browser Origin is not forged");
    const injector = createHeadInjector({ host: headers["x-forwarded-host"] ?? "127.0.0.1" });
    const html = Buffer.concat([
      ...injector.push('<html><head><title>Über uns</title><meta name="robots" content="noindex,nofollow"></he'),
      ...injector.push('ad><body><h1>Über uns</h1></body></html>'),
      ...injector.flush(),
    ]).toString("utf8");
    assert.doesNotMatch(html, /grok-app-builder\/extensions\.js/, suite);
    assert.match(html, /name="robots" content="noindex,nofollow"/, "private or unpublished route metadata survives");
    assert.match(html, /rel="manifest"/, "the existing PWA integration remains");
  }
});

test("operator-auth and rate-limit suites retain their unmodified request host", () => {
  for (const suite of ["website-studio", "rate-limit-proof"]) {
    const headers = qaClientHeaders(suite, "security-boundary");
    assert.deepEqual(Object.keys(headers), ["x-forwarded-for"], suite);
  }
});

test("customer browser simulation does not remove the development preview integration", () => {
  const source = "<html><head></head><body></body></html>";
  const preview = injectGrokPwaHead(source, { host: "demo.grok.me" });
  assert.match(preview, /grok-app-builder\/extensions\.js/);
  const local = injectGrokPwaHead(source, { host: "127.0.0.1:8082" });
  assert.match(local, /grok-app-builder\/extensions\.js/);
  const customer = injectGrokPwaHead(preview, { host: qaClientHeaders("cross-browser", "deployment")["x-forwarded-host"] ?? "127.0.0.1" });
  assert.doesNotMatch(customer, /grok-app-builder\/extensions\.js/);
});
