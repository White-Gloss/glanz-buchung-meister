import assert from "node:assert/strict";
import test from "node:test";
import { qaCheckMode } from "./qa/check-mode.mjs";

test("default, Studio and cross-browser are explicit separate QA modes", () => {
  assert.equal(qaCheckMode([]), "release");
  assert.equal(qaCheckMode(["--cross-browser-only"]), "cross-browser");
  assert.equal(qaCheckMode(["--studio-only"]), "studio");
});

test("conflicting, duplicate and unknown modes fail before a server can start", () => {
  for (const args of [["--studio-only", "--cross-browser-only"], ["--cross-browser-only", "--studio-only"], ["--studio-only", "--studio-only"], ["--cross-browser-only", "--cross-browser-only"], ["--skip-studio"], ["--studio-only", "--skip-checks"]]) {
    assert.throws(() => qaCheckMode(args), /exactly one|Unknown QA mode/, JSON.stringify(args));
  }
});
