// Runs only against the owned synthetic server in the existing Linux CI job.
import { assertIsolatedGithubCi } from "../hosting-policy.mjs";
assertIsolatedGithubCi();
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { qaBase, controlBase } from "./ports.mjs";

const runId = process.env.QA_RUN_ID;
assert.ok(runId, "The parent QA runner must supply its run identity.");
const identityResponse = await fetch(`${controlBase}/identity`, {
  redirect: "error",
  signal: AbortSignal.timeout(5000),
});
assert.equal(identityResponse.status, 200);
assert.equal(identityResponse.headers.get("x-qa-run-id"), runId, "Refuse another QA server.");
assert.deepEqual(await identityResponse.json(), {
  isolated: true,
  database: "in-memory-pglite",
  externalFetch: "blocked",
});

const { chromium } = await import("playwright");
const output = ".qa-output/hero-stability";
await mkdir(output, { recursive: true });
const report = { runId, base: qaBase, results: [], failures: [], blockedRequests: [], pageErrors: [] };
const browser = await chromium.launch({ headless: true });
const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "landscape", width: 844, height: 390 },
  { name: "desktop", width: 1440, height: 900 },
];

function cls(shifts) {
  let maximum = 0;
  let sum = 0;
  let first = 0;
  let previous = 0;
  for (const shift of shifts.filter((entry) => !entry.hadRecentInput)) {
    if (!sum || shift.startTime - previous > 1000 || shift.startTime - first > 5000) {
      sum = 0;
      first = shift.startTime;
    }
    sum += shift.value;
    previous = shift.startTime;
    maximum = Math.max(maximum, sum);
  }
  return maximum;
}

function overlap(a, b) {
  if (!a || !b) return null;
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return { width, height, area: width * height };
}

async function geometry(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      return element ? element.getBoundingClientRect().toJSON() : null;
    };
    const copy = document.querySelector(".scroll-film-copy");
    const pause = document.querySelector(".scroll-film-pause");
    const style = copy && getComputedStyle(copy);
    const video = document.querySelector(".scroll-film video");
    return {
      viewport: { width: innerWidth, height: innerHeight },
      copy: rect(".scroll-film-copy"),
      stage: rect(".scroll-film-stage"),
      controls: rect(".scroll-film-bottom"),
      cta: rect(".scroll-film-cta"),
      prices: rect(".scroll-film-prices"),
      banner: rect(".consent-banner"),
      copyCss: style && { bottom: style.bottom, translate: style.translate, transform: style.transform },
      consentHeight: getComputedStyle(document.documentElement).getPropertyValue("--consent-banner-height"),
      storedConsent: localStorage.getItem("wg-consent-v2"),
      motion: document.querySelector(".scroll-film")?.dataset.motion,
      scrollDistance: document.querySelector(".scroll-film")?.offsetHeight - document.querySelector(".scroll-film-stage")?.offsetHeight,
      pause: pause && {
        rect: pause.getBoundingClientRect().toJSON(),
        visibility: getComputedStyle(pause).visibility,
        disabled: pause.disabled,
        ariaHidden: pause.getAttribute("aria-hidden"),
        tabIndex: pause.tabIndex,
        text: pause.textContent.trim(),
      },
      video: video && { source: video.currentSrc, readyState: video.readyState, time: video.currentTime },
    };
  });
}

try {
  for (const viewport of viewports) {
    const result = { viewport, blockedRequests: [], pageErrors: [] };
    report.results.push(result);
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "no-preference",
      locale: "de-DE",
    });
    try {
      await context.route("**/*", (route) => {
        const request = route.request();
        if (new URL(request.url()).origin !== qaBase || !["GET", "HEAD"].includes(request.method())) {
          result.blockedRequests.push(`${request.method()} ${request.url()}`);
          return route.abort();
        }
        return route.continue();
      });
      await context.addInitScript(() => {
        const shifts = [];
        const supported = PerformanceObserver.supportedEntryTypes.includes("layout-shift");
        const record = (entries) => {
          for (const entry of entries) {
            shifts.push({
              startTime: entry.startTime,
              value: entry.value,
              hadRecentInput: entry.hadRecentInput,
              sources: (entry.sources || []).map((source) => ({
                node: source.node ? `${source.node.tagName?.toLowerCase() || source.node.nodeName}${source.node.id ? `#${source.node.id}` : ""}${source.node.getAttribute?.("class") ? `.${source.node.getAttribute("class").trim().replace(/\s+/g, ".")}` : ""}` : null,
                previousRect: source.previousRect.toJSON(),
                currentRect: source.currentRect.toJSON(),
              })),
            });
          }
        };
        const observer = supported ? new PerformanceObserver((list) => record(list.getEntries())) : null;
        observer?.observe({ type: "layout-shift", buffered: true });
        window.__heroStability = {
          supported,
          finish() {
            if (observer) {
              record(observer.takeRecords());
              observer.disconnect();
            }
            return shifts;
          },
        };
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on("pageerror", (error) => result.pageErrors.push(error.message));
      await page.goto(`${qaBase}/`, { waitUntil: "networkidle", timeout: 30000 });
      const consent = page.getByRole("dialog", { name: "Cookie-Einstellungen", exact: true });
      await consent.waitFor({ state: "visible" });
      // Allow hydration, font decoding and the ResizeObserver to settle naturally.
      await page.waitForTimeout(1200);
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      result.initial = await geometry(page);
      result.observerSupported = await page.evaluate(() => window.__heroStability.supported);
      result.layoutShifts = await page.evaluate(() => window.__heroStability.finish());
      result.cls = cls(result.layoutShifts);
      await page.screenshot({ path: `${output}/${viewport.name}-first-visit.png` });
      assert.equal(result.initial.storedConsent, null, "First-visit measurement must have no saved decision.");
      assert.equal(result.observerSupported, true, "Layout-shift observation must be supported.");
      assert.ok(result.initial.banner && result.initial.banner.width > 0 && result.initial.banner.height > 0, "The visible consent banner must have measurable bounds.");
      if (result.cls > 0.1) report.failures.push(`${viewport.name}: initial CLS ${result.cls} exceeds 0.1`);
      result.overlap = {};
      for (const name of ["cta", "prices"]) {
        const target = result.initial[name];
        result.overlap[name] = overlap(target, result.initial.banner);
        if (!target || target.width <= 0 || target.height <= 0 || target.top < -1 || target.bottom > viewport.height + 1)
          report.failures.push(`${viewport.name}: ${name} is not fully inside the first viewport`);
        if (result.overlap[name]?.area > 1)
          report.failures.push(`${viewport.name}: ${name} overlaps the consent banner ${JSON.stringify(result.overlap[name])}`);
      }
      if (result.initial.motion === "scroll") {
        const pause = result.initial.pause;
        if (!pause || pause.visibility !== "visible" || pause.disabled || pause.ariaHidden === "true" || pause.tabIndex < 0)
          report.failures.push(`${viewport.name}: enabled motion has no accessible pause control`);
      }

      // Interactions follow the completed first-visit measurement, never alter it.
      await consent.getByRole("button", { name: "Ablehnen", exact: true }).click();
      await consent.waitFor({ state: "hidden" });
      result.afterRejection = await geometry(page);
      await page.screenshot({ path: `${output}/${viewport.name}-consent-rejected.png` });
      if (result.initial.motion !== "scroll") {
        result.filmInteraction = {
          status: "not-tested",
          reason: "Runtime device or motion policy selects the still image.",
        };
      } else {
        const distance = result.afterRejection.scrollDistance;
        assert.ok(distance > 1, "Enabled motion must have a usable native scrolling range.");
        await page.mouse.wheel(0, Math.min(80, distance * 0.2));
        await page.waitForFunction(() => document.querySelector(".scroll-film video")?.readyState >= 2);
        await page.getByRole("button", { name: "Bewegung pausieren", exact: true }).click();
        const pausedTime = await page.locator(".scroll-film video").evaluate((video) => video.currentTime);
        await page.mouse.wheel(0, Math.min(120, distance * 0.2));
        await page.waitForTimeout(350);
        const heldTime = await page.locator(".scroll-film video").evaluate((video) => video.currentTime);
        assert.ok(Math.abs(heldTime - pausedTime) < 1 / 24, "Pausing must hold the original film while scrolling.");
        await page.getByRole("button", { name: "Bewegung fortsetzen", exact: true }).click();
        await page.waitForFunction((time) => document.querySelector(".scroll-film video")?.currentTime > time + 1 / 24, pausedTime);
        result.filmInteraction = { status: "passed", pausedTime, heldTime, resumed: await geometry(page) };
        await page.screenshot({ path: `${output}/${viewport.name}-film-resumed.png` });
      }
      if (result.pageErrors.length) report.failures.push(`${viewport.name}: ${result.pageErrors.join("; ")}`);
    } catch (error) {
      result.error = error.message;
      report.failures.push(`${viewport.name}: ${error.message}`);
      const page = context.pages()[0];
      if (page) await page.screenshot({ path: `${output}/${viewport.name}-failure.png` }).catch(() => {});
    } finally {
      report.blockedRequests.push(...result.blockedRequests);
      report.pageErrors.push(...result.pageErrors);
      await context.close();
    }
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
assert.equal(report.failures.length, 0, report.failures.join("\n"));
console.log("Three first-visit hero checks passed; no request, message, or upload submitted.");
