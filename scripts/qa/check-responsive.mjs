// Browser execution is restricted to the existing isolated Linux GitHub CI job.
import { assertIsolatedGithubCi } from "../hosting-policy.mjs";
assertIsolatedGithubCi();
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { qaBase } from "./ports.mjs";
import { cities, services } from "../../src/data/site.ts";

const browser = await chromium.launch({ headless: true });
const results = [];
const failures = [];
const paths = [
  ...new Set([
    "/",
    "/preise",
    "/leistungen",
    "/leistungen/keramikversiegelung",
    "/leistungen/keramikversiegelung/nagold",
    "/abholservice",
    "/abholservice/nagold",
    "/abholservice/sindelfingen",
    "/ratgeber/keramikversiegelung-langzeitschutz",
    "/kontakt",
    "/fahrzeug-zustand",
    "/dellen-hagelschaden",
    ...cities.map((city) => `/abholservice/${city.slug}`),
    ...services
      .filter((service) => !service.pendingApproval)
      .map((service) => `/leistungen/${service.slug}`),
  ]),
];
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  // No third-party analytics and no genuine submissions/uploads during QA.
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (new URL(request.url()).origin !== qaBase || !["GET", "HEAD"].includes(request.method()))
      return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of paths) {
      await page.goto(qaBase + path, { waitUntil: "networkidle" });
      // content-visibility:auto defers layout below the fold. Exercise the real
      // scroll path before judging overflow; do not disable production styles.
      for (
        let y = 0;
        y < (await page.evaluate(() => document.documentElement.scrollHeight));
        y += 650
      ) {
        await page.evaluate(async (top) => {
          window.scrollTo(0, top);
          await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        }, y);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        if (overflow > 2) {
          failures.push(`${path} @${width}, scroll ${y}: horizontal overflow ${overflow}`);
          break;
        }
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      const state = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
        h1: [...document.querySelectorAll("h1")].map((e) => e.textContent),
        horizontalOffenders: [...document.querySelectorAll("main *")]
          .filter((e) => {
            const box = e.getBoundingClientRect();
            return (
              box.width > 0 &&
              (box.right > document.documentElement.clientWidth + 2 || box.left < -2) &&
              getComputedStyle(e).position !== "absolute"
            );
          })
          .slice(0, 8)
          .map((e) => ({ tag: e.tagName, class: e.className })),
      }));
      results.push({ path, width, ...state });
      if (["/", "/abholservice/nagold", "/leistungen/keramikversiegelung/nagold"].includes(path)) {
        await page.screenshot({
          path: `.qa-output/mobile-${width}-${path.replace(/\W+/g, "-") || "home"}.png`,
          fullPage: false,
        });
      }
      if (state.h1.length !== 1) failures.push(`${path} @${width}: one H1 required`);
      if (state.scroll > state.viewport + 2)
        failures.push(`${path} @${width}: horizontal overflow ${JSON.stringify(state)}`);
    }
  }
} finally {
  await writeFile(".qa-output/responsive-results.json", JSON.stringify(results, null, 2));
  await writeFile(".qa-output/responsive-failures.json", JSON.stringify(failures, null, 2));
  await browser.close();
}
assert.equal(failures.length, 0, failures.join("\n"));
console.log(`${results.length} responsive checks passed; no form or upload submitted.`);
