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
    const title = document.querySelector(".scroll-film-copy h1");
    const titleText = title && [...title.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    let titleStart = null;
    if (titleText) {
      const range = document.createRange();
      range.selectNodeContents(titleText);
      titleStart = range.getClientRects()[0]?.toJSON() ?? null;
    }
    const titleHit = titleStart && document.elementFromPoint(titleStart.left + Math.min(4, titleStart.width / 2), titleStart.top + Math.min(4, titleStart.height / 2));
    const inspect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const css = getComputedStyle(element);
      const opacity = (node) => {
        let value = 1;
        for (let ancestor = node; ancestor; ancestor = ancestor.parentElement)
          value *= Number(getComputedStyle(ancestor).opacity);
        return value;
      };
      const targets = element.matches("a[href], button") ? [element]
        : [...element.querySelectorAll("a[href], button:not(:disabled)")].filter((target) =>
          !target.closest('[aria-hidden="true"]') && getComputedStyle(target).visibility === "visible" && opacity(target) > 0);
      return {
        opacity: opacity(element),
        visibility: css.visibility,
        display: css.display,
        inert: Boolean(element.closest("[inert]")),
        hitTest: targets.length > 0 && targets.every((target) => {
          const bounds = target.getBoundingClientRect();
          const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
          return bounds.width > 0 && bounds.height > 0 && Boolean(hit && target.contains(hit));
        }),
      };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      scrollY,
      shortLandscape: matchMedia("(max-height: 600px) and (orientation: landscape)").matches,
      copy: rect(".scroll-film-copy-inner"),
      reservedCopy: rect(".scroll-film-copy"),
      stage: rect(".scroll-film-stage"),
      header: rect(".site-header"),
      titleStart,
      titleStartHit: Boolean(titleHit && title?.contains(titleHit)),
      controls: rect(".scroll-film-bottom"),
      cta: rect(".scroll-film-cta"),
      prices: rect(".scroll-film-prices"),
      banner: rect(".consent-banner"),
      copyCss: style && {
        bottom: style.bottom,
        width: style.width,
        height: style.height,
        paddingBottom: style.paddingBottom,
        contain: style.contain,
        opacity: style.opacity,
        inert: copy.inert,
        translate: style.translate,
        transform: style.transform,
      },
      targetVisibility: {
        cta: inspect(".scroll-film-cta"),
        prices: inspect(".scroll-film-prices"),
        controls: inspect(".scroll-film-bottom"),
      },
      consentHeight: getComputedStyle(document.documentElement).getPropertyValue("--consent-banner-height"),
      storedConsent: localStorage.getItem("wg-consent"),
      motion: document.querySelector(".scroll-film")?.dataset.motion,
      scrollDistance: document.querySelector(".scroll-film")?.offsetHeight - document.querySelector(".scroll-film-stage")?.offsetHeight,
      pause: pause && {
        rect: pause.getBoundingClientRect().toJSON(),
        visibility: getComputedStyle(pause).visibility,
        opacity: getComputedStyle(pause).opacity,
        disabled: pause.disabled,
        ariaHidden: pause.getAttribute("aria-hidden"),
        tabIndex: pause.tabIndex,
        text: pause.textContent.trim(),
      },
      video: video && { source: video.currentSrc, readyState: video.readyState, time: video.currentTime },
    };
  });
}

function visibilityFailure(snapshot, name) {
  const target = snapshot[name];
  const visible = snapshot.targetVisibility[name];
  if (!target || target.width <= 0 || target.height <= 0) return "has no measurable bounds";
  if (!snapshot.header || !snapshot.banner) return "has no measured header or consent boundary";
  if (target.top < snapshot.header.bottom - 1 || target.bottom > snapshot.banner.top + 1
    || target.left < -1 || target.right > snapshot.viewport.width + 1)
    return "is not fully between the header and consent banner";
  if (!visible || visible.opacity < 0.99 || visible.visibility !== "visible" || visible.display === "none" || visible.inert)
    return "is transparent, hidden or inert";
  if (!visible.hitTest) return "is obstructed at its interactive targets";
  return null;
}

async function scrollToVisibleTarget(page, name) {
  const attempts = [];
  let snapshot = await geometry(page);
  for (let attempt = 0; attempt < 3 && visibilityFailure(snapshot, name); attempt++) {
    const target = snapshot[name];
    if (!target || !snapshot.header || !snapshot.banner) break;
    const delta = (target.top + target.bottom - snapshot.header.bottom - snapshot.banner.top) / 2;
    await page.evaluate((amount) => window.scrollBy({ top: amount, behavior: "instant" }), delta);
    // Native scroll updates the fixed header and film policy before measurement.
    await page.waitForTimeout(200);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    snapshot = await geometry(page);
    attempts.push(snapshot);
  }
  return { attempts, geometry: snapshot, failure: visibilityFailure(snapshot, name) };
}

try {
  for (const viewport of viewports) {
    const result = { viewport, blockedRequests: [], pageErrors: [] };
    report.results.push(result);
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "no-preference",
      locale: "de-DE",
      extraHTTPHeaders: { "x-forwarded-host": "white-gloss.de" },
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
      const { copy, reservedCopy, stage, banner, controls, header, titleStart } = result.initial;
      const scrollLayout = result.initial.shortLandscape && stage && header && stage.height > viewport.height - header.bottom + 1;
      result.intentionalScrollLayout = Boolean(scrollLayout);
      if (!copy || !stage || copy.top < stage.top - 1 || copy.bottom > (scrollLayout ? stage.bottom : banner.top) + 1
        || (scrollLayout && (copy.left < stage.left - 1 || copy.right > stage.right + 1)))
        report.failures.push(`${viewport.name}: hero copy is obscured by the header or consent banner`);
      if (scrollLayout && (!titleStart || titleStart.top < header.bottom - 1 || titleStart.top >= banner.top - 1
        || !result.initial.titleStartHit || Number(result.initial.copyCss?.opacity) < 0.99 || result.initial.copyCss?.inert))
        report.failures.push(`${viewport.name}: the start of the hero title is not initially visible`);
      if (!reservedCopy || !stage || reservedCopy.width <= 0 || Math.abs(reservedCopy.height - stage.height) > 1)
        report.failures.push(`${viewport.name}: copy space is not reserved for the full stage height`);
      if (!controls || controls.top < stage.top - 1 || controls.bottom > (scrollLayout ? stage.bottom : banner.top) + 1)
        report.failures.push(`${viewport.name}: film controls are outside the visible area above consent`);
      if (result.cls > 0.1) report.failures.push(`${viewport.name}: initial CLS ${result.cls} exceeds 0.1`);
      result.overlap = {};
      for (const name of scrollLayout ? [] : ["cta", "prices"]) {
        const target = result.initial[name];
        result.overlap[name] = overlap(target, result.initial.banner);
        if (!target || target.width <= 0 || target.height <= 0 || target.top < -1 || target.bottom > viewport.height + 1)
          report.failures.push(`${viewport.name}: ${name} is not fully inside the first viewport`);
        if (result.overlap[name]?.area > 1)
          report.failures.push(`${viewport.name}: ${name} overlaps the consent banner ${JSON.stringify(result.overlap[name])}`);
      }
      if (result.initial.motion === "scroll") {
        const pause = result.initial.pause;
        if (!pause || pause.visibility !== "visible" || Number(pause.opacity) <= 0 || pause.disabled || pause.ariaHidden === "true" || pause.tabIndex < 0)
          report.failures.push(`${viewport.name}: enabled motion has no accessible pause control`);
      }

      if (scrollLayout) {
        result.reachability = {};
        try {
          for (const name of ["cta", "prices", "controls"]) {
            result.reachability[name] = await scrollToVisibleTarget(page, name);
            if (result.reachability[name].failure)
              report.failures.push(`${viewport.name}: ${name} ${result.reachability[name].failure} after native page scrolling`);
            await page.screenshot({ path: `${output}/${viewport.name}-${name}-reachable.png` });
          }
        } finally {
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
          await page.waitForTimeout(200);
          result.afterReachabilityReset = await geometry(page);
          assert.ok(result.afterReachabilityReset.scrollY <= 1, "Reset native scrolling before consent and film interactions.");
        }
      }

      // Interactions follow the completed first-visit measurement, never alter it.
      await consent.getByRole("button", { name: "Ablehnen", exact: true }).click();
      await consent.waitFor({ state: "hidden" });
      result.afterRejection = await geometry(page);
      assert.equal(result.afterRejection.storedConsent, "rejected", "Rejecting must preserve the real consent decision.");
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
