// Browser engines run only against this run's isolated production build in Linux CI.
import { assertIsolatedGithubCi } from "../hosting-policy.mjs";
assertIsolatedGithubCi();
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { qaBase, controlBase } from "./ports.mjs";
import { qaClientHeaders } from "./client-identity.mjs";
import { prepareBrowserFixture } from "./browser-fixture.mjs";
import { displayedPriceEquals } from "./displayed-price.mjs";
import { completeSuccessfulRead, observePageReads, observeReadDuringAction } from "./read-completion.mjs";
import { revealTargetWithWheel } from "./scroll-target.mjs";
import { decodedGalleryImage } from "./gallery-image.mjs";
import { verifyTypography } from "./typography.mjs";
import { assertBrowserDiagnostics, createBrowserDiagnostics } from "../browser-diagnostics.mjs";

const output = resolve(".qa-output/cross-browser");
// Keep the gallery last: its keyboard interaction continues after this crawl.
const layoutPaths = ["/", "/abholservice/nagold", "/leistungen/keramikversiegelung", "/ratgeber", "/ratgeber/keramikversiegelung-langzeitschutz", "/galerie"];
await mkdir(output, { recursive: true });
const report = {
  status: "running",
  scope: "Playwright Firefox and WebKit on Linux, 390px and 1440px viewports, plus 960/1024/1100px header checks. WebKit is not a real Safari/iOS test; no physical device or native Windows/macOS browser claim.",
  checks: [], diagnostics: [], failures: [], screenshots: [], reviews: [], reviewRequests: [], reviewActions: [], galleryImages: [], directoryFocus: [], pageReads: [], guideAnchors: [], typography: [], headers: [],
};
const diagnostics = [];

async function rejectConsent(page, firstVisit = false) {
  const reject = page.getByRole("button", { name: "Ablehnen", exact: true });
  if (firstVisit) {
    // The deferred client can mount the banner after goto(networkidle).
    await reject.waitFor({ state: "visible" });
    await page.waitForFunction(() => document.body.dataset.consentBanner === "open", undefined, { timeout: 15000 });
  } else if (!await reject.isVisible()) return;
  await reject.click();
  await page.getByRole("dialog", { name: "Cookie-Einstellungen", exact: true }).waitFor({ state: "hidden" });
  await page.waitForFunction(() => localStorage.getItem("wg-consent") === "rejected" &&
    !document.body.hasAttribute("data-consent-banner"), undefined, { timeout: 5000 });
}
async function screenshot(page, name) {
  await page.screenshot({ path: resolve(output, name) });
  report.screenshots.push(name);
}
async function verifyHomepageDirectoryFocus(page, label, browserName) {
  await page.getByRole("dialog", { name: "Cookie-Einstellungen", exact: true }).waitFor({ state: "hidden" });
  // WebKit includes links with Alt+Tab: https://github.com/microsoft/playwright/issues/5609
  const navigationKey = browserName === "webkit" ? "Alt+Tab" : "Tab";
  const headerToggle = page.locator(".site-header").getByRole("button", { name: "Menü öffnen", exact: true });
  const returnToHeader = async () => {
    await headerToggle.focus();
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    await page.waitForFunction(() => Math.abs(scrollY) < 1, undefined, { timeout: 5000 });
  };
  for (const [name, selector] of [["services", ".home-directory-links"], ["pickup", ".home-city-links"]]) {
    await returnToHeader();
    const links = page.locator(selector).locator("a[href]");
    assert.ok(await links.count() >= 2, `${label} ${name}: two links are required for keyboard navigation`);
    // Start above the lists without a layout-reading sweep or manual reveal.
    // Native focus must bring the first link into view; Tab reaches its sibling.
    await links.first().focus();
    for (const index of [0, 1]) {
      if (index) await page.keyboard.press(navigationKey);
      report.lastDirectoryFocus = { label, selector, index, navigationKey: index ? navigationKey : null };
      try {
        await page.waitForFunction(({ selector, index }) => {
          const link = document.querySelectorAll(`${selector} a[href]`)[index];
          if (!link || document.activeElement !== link) return false;
          const box = link.getBoundingClientRect();
          const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return box.width > 0 && box.height > 0 && box.left >= 0 && box.right <= innerWidth &&
            box.top >= headerBottom - 1 && box.bottom <= innerHeight && link.contains(hit);
        }, { selector, index }, { timeout: 5000 });
      } catch (error) {
        report.lastDirectoryFocus.dom = await page.evaluate(({ selector, index }) => {
          const link = document.querySelectorAll(`${selector} a[href]`)[index];
          const box = link?.getBoundingClientRect();
          const active = document.activeElement;
          return {
            activeElement: active ? { tag: active.tagName, id: active.id, href: active.getAttribute("href"), text: active.textContent?.trim().slice(0, 120), ariaLabel: active.getAttribute("aria-label") } : null,
            expectedHref: link?.getAttribute("href"),
            expectedRect: box ? { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height } : null,
            consentStorage: localStorage.getItem("wg-consent"), consentBanner: document.body.getAttribute("data-consent-banner"),
            scrollY, viewportHeight: innerHeight,
          };
        }, { selector, index }).catch((failure) => ({ unavailable: failure.message }));
        throw error;
      }
    }
    await screenshot(page, `${label}-${name}-keyboard.png`);
    report.directoryFocus.push({
      label, selector, navigationKey,
      firstHref: await links.first().getAttribute("href"),
      nextHref: await links.nth(1).getAttribute("href"),
      focusedLinksVisibleAndHitTestable: true,
    });
  }
  await returnToHeader();
}
const isReviewsRequest = (request) => request.method() === "GET" && request.url() === `${qaBase}/api/google-reviews`;
async function revealReviews(page, state) {
  state.scrollEnvironment = await page.evaluate(() => ({
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    htmlClasses: document.documentElement.className,
    bodyOverflow: getComputedStyle(document.body).overflow,
    readyState: document.readyState,
  }));
  assert.equal(state.scrollEnvironment.reducedMotion, true, "The cross-browser scenario must keep reduced motion enabled");
  state.scrollAttempts = [];
  state.visibleTarget = await revealTargetWithWheel({
    measure: () => page.locator("#bewertungen").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, scrollY, viewportHeight: innerHeight, headerBottom: document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0 };
    }),
    wheel: async (deltaY) => {
      const viewport = page.viewportSize();
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      await page.mouse.wheel(0, deltaY);
    },
    settle: async (timeout) => {
      await page.evaluate(() => { window.__qaReviewsWheel = { y: scrollY, since: performance.now() }; });
      await page.waitForFunction(() => {
        const probe = window.__qaReviewsWheel;
        if (Math.abs(scrollY - probe.y) > 0.5) { probe.y = scrollY; probe.since = performance.now(); }
        return performance.now() - probe.since >= 150;
      }, undefined, { timeout });
    },
  }, { onAttempt: (attempt) => state.scrollAttempts.push(attempt) });
}
async function verifyHomepageReviews(page, label, action) {
  // Scrolling can trigger the lazy reviews after goto(networkidle) completed.
  // Observe this navigation's real request before starting, deliberately bring
  // its section into view, then await the full body before navigating/closing.
  const state = { label, stage: "navigation/layout" };
  report.reviewActions.push(state);
  try {
    const response = await observeReadDuringAction(page, (response) => isReviewsRequest(response.request()), async () => {
      await action();
      state.stage = "scroll-to-reviews";
      await revealReviews(page, state);
      state.stage = "visible-reviews";
      await page.getByRole("complementary", { name: "Google-Kundenbewertungen", exact: true }).waitFor();
      state.stage = "response";
    });
    const completion = await completeSuccessfulRead(response);
    state.stage = "finished";
    report.reviews.push({ label, endpoint: "/api/google-reviews", ...completion });
  } catch (error) {
    state.error = error.message;
    state.dom = await page.evaluate(() => {
      const section = document.querySelector("#bewertungen");
      const rect = section?.getBoundingClientRect();
      return {
        path: location.pathname, scrollY, viewportHeight: innerHeight,
        reviews: section ? { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, text: section.textContent?.slice(0, 300) } : null,
        images: [...document.images].filter((image) => { const box = image.getBoundingClientRect(); return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight; }).map((image) => ({ path: new URL(image.currentSrc || image.src).pathname, complete: image.complete, width: image.naturalWidth })),
      };
    }).catch((failure) => ({ unavailable: failure.message }));
    throw error;
  }
}
async function verifyLayout(page, label) {
  report.lastLayout = { label, stage: "client-hydration" };
  // SSR already contains a visible hero. Its reveal class is set only by the
  // real client effect, after the deferred route has hydrated. networkidle
  // alone can occur before that bootstrap starts loading its CSS and modules.
  const hero = page.locator(".page-hero .film-chapter-copy");
  if (await hero.count()) await page.locator(".page-hero .film-chapter-copy.is-in").waitFor();
  report.lastLayout.stage = "loaded-fonts";
  report.typography.push(await verifyTypography(page, label));
  report.lastLayout.stage = "heading";
  assert.equal(await page.locator("h1").count(), 1, `${label}: one H1`);
  const heroTitle = page.locator(".page-hero h1");
  if (await heroTitle.count()) {
    const originalTitle = await heroTitle.getAttribute("aria-label");
    assert.ok(originalTitle, `${label}: preserve the original hero title as its accessible name`);
    assert.equal((await heroTitle.textContent()).replaceAll("\u00ad", ""), originalTitle,
      `${label}: optional hyphenation must not change the visible wording`);
    assert.equal(await page.getByRole("heading", { level: 1, name: originalTitle, exact: true }).count(), 1,
      `${label}: assistive technology receives the title without discretionary hyphens`);
  }
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  report.lastLayout.stage = "scroll-layout";
  for (const top of [0, Math.floor(height / 2), height]) {
    await page.evaluate((y) => window.scrollTo(0, y), top);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 2, `${label}: overflow ${overflow}px at ${top}`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  report.lastLayout.stage = "visible-images";
  await page.waitForFunction(() => [...document.images].filter((image) => {
    const box = image.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && getComputedStyle(image).visibility !== "hidden";
  }).every((image) => image.complete && image.naturalWidth > 0));
  report.lastLayout.stage = "finished";
}
async function completePageReads(reads, label) {
  report.pageReads.push(await reads.complete(label));
}
async function verifyHeaderWidths(page, name) {
  const original = page.viewportSize();
  try {
    for (const width of [960, 1024, 1100]) {
      await page.setViewportSize({ width, height: original.height });
      await page.evaluate(async () => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      const label = `${name}-${width}-header`;
      report.typography.push(await verifyTypography(page, label));
      const header = await page.locator(".site-header").evaluate((element) => {
        const nav = element.querySelector(".header-quick-nav");
        const controls = [...element.querySelectorAll(".ga-logo, .ga-tools a, .menu-toggle, .header-quick-nav a")]
          .filter((control) => control.getClientRects().length > 0)
          .map((control) => {
            const rect = control.getBoundingClientRect();
            const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            const range = document.createRange();
            range.selectNodeContents(control);
            return { text: control.getAttribute("aria-label") || control.textContent.trim(), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, hit: control.contains(hit), navLines: control.closest(".header-quick-nav") ? range.getClientRects().length : null };
          });
        return { width: innerWidth, navigationVisible: nav.getClientRects().length > 0, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, controls };
      });
      assert.equal(header.navigationVisible, width >= 1100, `${label}: full navigation appears when its fixed 16px labels fit`);
      assert.ok(header.overflow <= 2, `${label}: no horizontal overflow`);
      assert.ok(header.controls.some((control) => control.text === "Menü öffnen"), `${label}: complete menu remains available`);
      for (const [index, control] of header.controls.entries()) {
        assert.ok(control.left >= 0 && control.right <= width && control.width > 0 && control.height > 0 && control.hit, `${label}: visible, reachable ${JSON.stringify(control)}`);
        if (control.navLines !== null) assert.equal(control.navLines, 1, `${label}: navigation label remains on one line`);
        for (const other of header.controls.slice(index + 1)) {
          const overlapX = Math.min(control.right, other.right) - Math.max(control.left, other.left);
          const overlapY = Math.min(control.bottom, other.bottom) - Math.max(control.top, other.top);
          assert.ok(overlapX <= 2 || overlapY <= 2, `${label}: controls do not overlap: ${control.text}, ${other.text}`);
        }
      }
      report.headers.push({ label, ...header });
      await screenshot(page, `${label}.png`);
    }
  } finally {
    await page.setViewportSize(original);
  }
}
async function verifyGuideAnchor(page, label) {
  const link = page.getByRole("navigation", { name: "Inhaltsverzeichnis", exact: true }).locator("a").first();
  const hash = await link.getAttribute("href");
  assert.match(hash, /^#abschnitt-\d+$/);
  await link.click();
  await page.waitForFunction((target) => {
    const heading = document.getElementById(target.slice(1))?.querySelector("h2");
    const box = heading?.getBoundingClientRect();
    const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
    return location.hash === target && box && box.width > 0 && box.height > 0 &&
      box.top >= headerBottom - 1 && box.bottom <= innerHeight;
  }, hash);
  report.guideAnchors.push({ label, hash, headingVisibleBelowHeader: true });
  await page.evaluate(() => window.scrollTo(0, 0));
}

try {
  assert.ok(process.env.QA_RUN_ID);
  const identity = await fetch(controlBase + "/identity", { signal: AbortSignal.timeout(5000) });
  assert.equal(identity.status, 200);
  assert.equal(identity.headers.get("x-qa-run-id"), process.env.QA_RUN_ID);
  assert.deepEqual(await identity.json(), { isolated: true, database: "in-memory-pglite", externalFetch: "blocked" });
  report.fixture = await prepareBrowserFixture({ scenario: "cross-browser" });
  const engines = await import("playwright");
  for (const name of ["firefox", "webkit"]) {
    let browser;
    try {
      browser = await engines[name].launch({ headless: true });
      for (const width of [390, 1440]) {
        const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 1000 }, hasTouch: width < 700, reducedMotion: "reduce", serviceWorkers: "block", extraHTTPHeaders: qaClientHeaders("cross-browser", `${name}-${width}`) });
        const diagnostic = createBrowserDiagnostics({ origin: qaBase, label: `${name}-${width}` });
        diagnostics.push(diagnostic);
        await context.route("**/*", (route) => diagnostic.allowRequest(route.request()) ? route.continue() : route.abort());
        const page = await context.newPage();
        let phase = "open";
        const started = Date.now();
        const pendingPageReads = observePageReads(page, qaBase);
        const traceReviews = (request, event, details = {}) => {
          if (isReviewsRequest(request)) report.reviewRequests.push({ label: `${name}-${width}`, phase, event, elapsedMs: Date.now() - started, endpoint: "/api/google-reviews", ...details });
        };
        page.on("request", (request) => {
          traceReviews(request, "request");
        });
        page.on("response", (response) => traceReviews(response.request(), "response", { status: response.status() }));
        page.on("requestfinished", (request) => traceReviews(request, "finished"));
        page.on("requestfailed", (request) => {
          traceReviews(request, "failed", { error: request.failure()?.errorText });
        });
        page.setDefaultTimeout(15000);
        diagnostic.attach(page);
        try {
          for (const path of layoutPaths) {
            phase = `navigate/layout:${path}`;
            const visit = async () => {
              const response = await page.goto(qaBase + path, { waitUntil: "networkidle" });
              assert.equal(response.status(), 200, `${name} ${path}`);
              await rejectConsent(page, path === "/");
              if (path === "/" && width === 390) await verifyHomepageDirectoryFocus(page, `${name}-${width}`, name);
              await verifyLayout(page, `${name} ${width} ${path}`);
              if (path === "/" && width === 1440) await verifyHeaderWidths(page, name);
            };
            if (path === "/") {
              await verifyHomepageReviews(page, `${name}-${width}: before next navigation`, visit);
              await page.evaluate(() => window.scrollTo(0, 0));
            } else await visit();
            if (path.startsWith("/ratgeber/")) await verifyGuideAnchor(page, `${name}-${width}`);
            await screenshot(page, `${name}-${width}-${path.replace(/\W+/g, "-") || "home"}.png`);
            await completePageReads(pendingPageReads, `${name}-${width}:${path}`);
            report.checks.push(`${name} ${width}px ${path}: status, H1, visible images and horizontal layout`);
          }

          const trigger = page.locator(".customer-photo-trigger").first();
          await trigger.click();
          const viewer = page.locator("dialog.customer-photo-dialog");
          await viewer.waitFor({ state: "visible" });
          const viewerImage = viewer.locator(".customer-photo-viewer > img");
          const gallerySources = await page.locator(".customer-photo-trigger > img").evaluateAll((images) => images.map((image) => image.src));
          assert.ok(gallerySources.length >= 2, "The keyboard scenario needs two gallery images");
          // Wait for the full-size image before replacing/removing its <img>.
          // Otherwise this test can cancel its own download (Firefox NS_BINDING_ABORTED).
          report.galleryImages.push({ label: `${name}-${width}`, index: 1, ...await viewerImage.evaluate(decodedGalleryImage, gallerySources[0]) });
          await page.keyboard.press("ArrowRight");
          await page.waitForFunction(() => document.querySelector("dialog.customer-photo-dialog .kicker")?.textContent?.includes("Bild 2 von"));
          report.galleryImages.push({ label: `${name}-${width}`, index: 2, ...await viewerImage.evaluate(decodedGalleryImage, gallerySources[1]) });
          assert.equal(await viewer.locator(".customer-photo-viewer > img").evaluate((image) => getComputedStyle(image).objectFit), "contain");
          await page.keyboard.press("Escape");
          await viewer.waitFor({ state: "hidden" });
          assert.ok(await trigger.evaluate((element) => document.activeElement === element));

          const menu = page.getByRole("button", { name: "Menü öffnen", exact: true });
          await menu.focus();
          await page.keyboard.press("Enter");
          const dialog = page.getByRole("dialog", { name: "Hauptnavigation", exact: true });
          await dialog.waitFor({ state: "visible" });
          report.typography.push(await verifyTypography(page, `${name}-${width}-menu`));
          const controls = dialog.locator('a[href],button:not([disabled])');
          await controls.first().focus();
          await page.keyboard.press("Shift+Tab");
          assert.ok(await controls.last().evaluate((element) => element === document.activeElement));
          await page.keyboard.press("Tab");
          assert.ok(await controls.first().evaluate((element) => element === document.activeElement));
          // Closing the menu unmounts its logo and focused preview image. Let
          // those reads finish before Escape can remove their image elements.
          await completePageReads(pendingPageReads, `${name}-${width}:before-menu-close`);
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
          assert.ok(await menu.evaluate((element) => element === document.activeElement));
          const skip = page.getByRole("link", { name: "Zum Inhalt springen", exact: true });
          await skip.focus();
          await page.keyboard.press("Enter");
          assert.equal(await page.evaluate(() => document.activeElement?.id), "main-content");
          report.checks.push(`${name} ${width}px: gallery keys/focus return, menu focus trap/Escape and skip link`);

          phase = "booking";
          // Gallery/menu/skip-link actions can start offscreen image reads after
          // the layout checkpoint. Finish them before replacing this document.
          await completePageReads(pendingPageReads, `${name}-${width}:before-booking-navigation`);
          await verifyHomepageReviews(page, `${name}-${width}: before context close`, async () => {
          await page.goto(`${qaBase}/#buchung`, { waitUntil: "networkidle" });
          await rejectConsent(page);
          await page.locator("form.booking-flow").waitFor();
          report.typography.push(await verifyTypography(page, `${name}-${width}-booking`));
          await page.locator('input[name="klasse"][value="kompakt"]').check();
          await page.locator('input[name="paket"][value="premium"]').check();
          await page.locator(".booking-steps button").nth(1).click();
          const extras = page.locator("details.booking-extras");
          if (!(await extras.evaluate((element) => element.open))) await extras.locator("summary").click();
          await page.locator("#extra-felgen").check();
          await page.waitForFunction(displayedPriceEquals, { selector: ".booking-price strong", expected: "468 €" }).catch(async () => {
            throw new Error(`Expected exact booking total 468 EUR; actual display: ${JSON.stringify(await page.locator(".booking-price strong").textContent())}`);
          });
          assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 2);
          await screenshot(page, `${name}-${width}-booking.png`);
          report.checks.push(`${name} ${width}px: real booking selection totals 468 EUR without submission`);
          });
          await completePageReads(pendingPageReads, `${name}-${width}:before-close`);
        } finally {
          phase = "context-close";
          await context.close();
        }
      }
    } catch (error) {
      report.failures.push({ engine: name, message: error.stack ?? String(error) });
    } finally {
      await browser?.close();
    }
  }
  assertBrowserDiagnostics(diagnostics);
  assert.equal(report.failures.length, 0, JSON.stringify(report.failures, null, 2));
  assert.equal(report.checks.length, 4 * (layoutPaths.length + 2), "Every engine and viewport must complete all checks");
  assert.equal(report.directoryFocus.length, 4, "Both mobile engines must reach and tab through both homepage link lists");
  assert.equal(report.reviews.length, 8, "Both homepage visits must finish reviews before navigation/close for every engine and viewport");
  assert.equal(report.galleryImages.length, 8, "Both full-size gallery images must decode before switching/closing for every engine and viewport");
  assert.equal(report.guideAnchors.length, 4, "The guide contents link must work in both engines at both widths");
  assert.equal(report.headers.length, 6, "Both engines must check the header at 960, 1024 and 1100px");
  assert.equal(report.typography.length, 4 * (layoutPaths.length + 2) + 6, "Every layout, menu, booking and header checkpoint must use the loaded brand fonts");
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  report.diagnostics = diagnostics.map((item) => item.snapshot());
  await writeFile(resolve(output, "results.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
console.log("Cross-browser read evidence: " + JSON.stringify({ status: report.status, failures: report.failures, lastLayout: report.lastLayout, actions: report.reviewActions, reads: report.reviewRequests, pageReads: report.pageReads, guideAnchors: report.guideAnchors, gallery: report.galleryImages, errors: report.diagnostics.flatMap((item) => item.errors) }));

