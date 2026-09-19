import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const entryCss = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const resultsCss = await readFile(new URL("../src/styles/results.css", import.meta.url), "utf8");

test("public stylesheet imports the focused customer-results contract", () => {
  assert.match(entryCss, /@import\s+["']\.\/styles\/results\.css["'];/);
});

test("customer-results CSS retains every component selector", () => {
  for (const selector of [
    ".consent-banner",
    ".wg-results-teaser",
    ".wg-video-grid",
    ".wg-video-trigger",
    ".wg-video-dialog",
    ".wg-video-close",
    ".wg-trust-strip",
  ]) {
    assert.ok(resultsCss.includes(selector), `missing ${selector}`);
  }
});

test("video aspect ratios and compact grid remain intentional", () => {
  assert.match(resultsCss, /\.wg-video-poster\s*\{[^}]*aspect-ratio:\s*9\s*\/\s*16/s);
  assert.match(
    resultsCss,
    /\.wg-video-card--featured \.wg-video-poster\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/s,
  );
  assert.match(
    resultsCss,
    /\.wg-video-grid--compact\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
  );
});

test("menu accent hover keeps readable accent foreground", () => {
  const hover = entryCss.match(/\.menu-toggle:hover\s*\{([^}]*)\}/s)?.[1] ?? "";
  assert.match(hover, /color:\s*var\(--color-accent-fg\)/);
  assert.doesNotMatch(hover, /color:\s*#fff/);
});