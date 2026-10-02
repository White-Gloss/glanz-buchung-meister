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
  // Review the changed request path at phone and desktop sizes. These images
  // are produced by the existing isolated Linux CI job, never a local server.
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(qaBase + "/", { waitUntil: "networkidle" });
    const consent = page.getByRole("dialog", { name: "Cookie-Einstellungen", exact: true });
    if (await consent.isVisible()) {
      await consent.getByRole("button", { name: "Ablehnen", exact: true }).click();
      await consent.waitFor({ state: "hidden" });
    }
    const order = await page.evaluate(() => {
      const packages = document.getElementById("pakete");
      const booking = document.getElementById("buchung");
      return {
        immediatelyAfterPackages: packages?.nextElementSibling === booking,
        bookingCount: document.querySelectorAll("#buchung").length,
      };
    });
    assert.equal(order.immediatelyAfterPackages, true, "The request should follow the packages.");
    assert.equal(order.bookingCount, 1, "Keep one request flow and stable incoming anchor links.");
    await page.locator(".home-jump-links").getByRole("link", { name: "Termin anfragen", exact: true }).click();
    await page.getByRole("form", { name: "Ihre Aufbereitung." }).waitFor({ state: "visible" });
    await page.locator("#buchung").screenshot({ path: `.qa-output/review-request-${width}.png` });
    await page.locator("#kundenergebnisse").scrollIntoViewIfNeeded();
    const video = page.getByRole("button", { name: "Video abspielen: Hydrophober Lackschutz Keramikschutz 0:11 Min.", exact: true });
    await video.focus();
    await video.press("Enter");
    await page.getByRole("dialog", { name: "Hydrophober Lackschutz", exact: true }).waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await page.locator(".wg-video-dialog").waitFor({ state: "hidden" });
    assert.equal(await video.evaluate((element) => element === document.activeElement), true, "Return keyboard focus to the video trigger.");
    await page.locator("#kundenergebnisse").screenshot({ path: `.qa-output/review-results-${width}.png` });
    for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += 650) {
      await page.evaluate(async (top) => {
        window.scrollTo(0, top);
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      }, y);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `.qa-output/review-home-${width}.png`, fullPage: true });
    results.push({ path: "/", width, review: true, ...order, videoKeyboardFocusReturned: true });
  }
  const noJavaScriptContext = await browser.newContext({
    javaScriptEnabled: false,
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  try {
    await noJavaScriptContext.route("**/*", async (route) => {
      const request = route.request();
      if (new URL(request.url()).origin !== qaBase || !["GET", "HEAD"].includes(request.method()))
        return route.abort();
      return route.continue();
    });
    const noJavaScriptPage = await noJavaScriptContext.newPage();
    await noJavaScriptPage.goto(qaBase + "/", { waitUntil: "networkidle" });
    const booking = noJavaScriptPage.locator("#buchung");
    await booking.scrollIntoViewIfNeeded();
    const phoneFallback = booking.locator('a[href="tel:+4915233540284"]');
    assert.equal(await phoneFallback.isVisible(), true, "Show the telephone request fallback without JavaScript.");
    const loading = booking.getByRole("status", { name: "Buchungsformular wird geladen", exact: true });
    assert.equal(await loading.isVisible(), false, "Do not leave a permanent loading placeholder without JavaScript.");
    await booking.screenshot({ path: ".qa-output/review-request-no-javascript.png" });
    results.push({
      path: "/",
      width: 390,
      javaScriptEnabled: false,
      phoneFallbackVisible: true,
      loadingPlaceholderVisible: false,
    });
  } finally {
    await noJavaScriptContext.close();
  }
} finally {
  await writeFile(".qa-output/responsive-results.json", JSON.stringify(results, null, 2));
  await writeFile(".qa-output/responsive-failures.json", JSON.stringify(failures, null, 2));
  await browser.close();
}
assert.equal(failures.length, 0, failures.join("\n"));
console.log(`${results.length} responsive checks passed; no form or upload submitted.`);
