import assert from "node:assert/strict";
import test from "node:test";
import { robotsEvidence } from "./qa/robots-evidence.mjs";

test("SSR robots evidence reports actual metadata and headers without the page body", () => {
  const html = '<html><head><meta content="NOINDEX,nofollow" name="robots"><meta name=robots content=none></head><body>Private draft marker</body></html>';
  assert.deepEqual(robotsEvidence(html, new Headers({ "x-robots-tag": "noindex" })), { meta: ["noindex,nofollow", "none"], header: "noindex" });
});
test("body text, serialized scripts and comments cannot satisfy a missing robots tag", () => {
  const html = `<html><head><script>const spoof='<meta name="robots" content="noindex">';</script><!-- <meta name="robots" content="noindex"> --><meta name="description" content="noindex"></head><body><meta name="robots" content="noindex">noindex</body></html>`;
  assert.deepEqual(robotsEvidence(html, new Headers()), { meta: [], header: null });
});
