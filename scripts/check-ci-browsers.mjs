import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium, firefox, webkit } from "playwright";

// This validates the preinstalled image; it never starts an application or a
// browser. The normal isolated CI tests still launch and exercise each engine.
if (process.env.GITHUB_ACTIONS !== "true" || process.env.RUNNER_OS !== "Linux") {
  throw new Error("Preinstalled browsers are checked only in Linux GitHub CI.");
}
const [expected, ...engines] = process.argv.slice(2);
const actual = createRequire(import.meta.url)("playwright/package.json").version;
if (!/^\d+\.\d+\.\d+$/.test(expected ?? "") || actual !== expected) {
  throw new Error(`Playwright image/package mismatch: expected ${expected}, installed ${actual}. Update the pinned image with the lockfile.`);
}
const browsers = { chromium, firefox, webkit };
if (!engines.length) throw new Error("No browser engine selected.");
for (const engine of engines) {
  const executable = browsers[engine]?.executablePath();
  if (!executable || !existsSync(executable)) {
    throw new Error(`Preinstalled ${engine} browser is missing from the pinned image.`);
  }
  console.log(`Verified preinstalled ${engine} for Playwright ${actual}.`);
}
