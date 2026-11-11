// Browser execution is restricted to the existing isolated Linux GitHub CI job.
import { assertIsolatedGithubCi } from "../hosting-policy.mjs";
assertIsolatedGithubCi();
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { qaBase } from "./ports.mjs";
import { qaClientHeaders } from "./client-identity.mjs";
import { cities, services } from "../../src/data/site.ts";

const browser = await chromium.launch({ headless: true });
const results = [];
const failures = [];
let progress = { stage: "starting", completed: 0, updatedAt: new Date().toISOString() };
let contextSequence = 0;
async function scrollAndRender(page, top) {
  await page.evaluate((position) => window.scrollTo(0, position), top);
  // The runner clock also works when headless Chromium suspends frame/timer
  // promises. The subsequent geometry reads still force the actual layout.
  await new Promise((done) => setTimeout(done, 32));
}
async function openPage(viewport, reducedMotion = "reduce") {
  const context = await browser.newContext({ reducedMotion, viewport, extraHTTPHeaders: qaClientHeaders("responsive", `context-${contextSequence++}`) });
  try {
    // No third-party analytics and no genuine submissions/uploads during QA.
    await context.route("**/*", async (route) => {
      const request = route.request();
      if (new URL(request.url()).origin !== qaBase || !["GET", "HEAD"].includes(request.method()))
        return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(15_000);
    page.on("pageerror", (error) => failures.push(`${page.url()}: ${error.message}`));
    await page.bringToFront();
    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}
const bookingCtaName = "Jetzt Termin anfragen";
async function assertBookingArrival(page, label) {
  try {
    await page.waitForFunction(() => {
      const heading = document.getElementById("buchung-heading");
      const box = heading?.getBoundingClientRect();
      const header = document.querySelector(".site-header")?.getBoundingClientRect();
      const hit = box && document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return location.pathname === "/" && location.hash === "#buchung" &&
        heading?.tabIndex === -1 && document.activeElement === heading &&
        box && header && box.width > 0 && box.height > 0 &&
        box.top >= header.bottom - 1 && box.bottom <= innerHeight &&
        box.left >= 0 && box.right <= innerWidth && heading.contains(hit);
    }, undefined, { timeout: 10_000 });
  } catch (error) {
    const state = await page.evaluate(() => {
      const heading = document.getElementById("buchung-heading");
      return {
        url: location.pathname + location.hash,
        activeElement: document.activeElement?.id || document.activeElement?.tagName,
        tabIndex: heading?.tabIndex,
        heading: heading?.getBoundingClientRect().toJSON(),
        header: document.querySelector(".site-header")?.getBoundingClientRect().toJSON(),
        viewport: { width: innerWidth, height: innerHeight },
      };
    });
    throw new Error(`${label}: booking heading must receive focus and remain fully visible below the header: ${JSON.stringify(state)}`, { cause: error });
  }
}
async function verifyBookingActivation(page, width, reducedMotion) {
  const headerCta = page.locator(".site-header .header-film-booking");
  const heroCta = page.locator(".scroll-film-cta");
  await headerCta.click();
  await assertBookingArrival(page, `${width}px ${reducedMotion}, first header click`);
  const form = page.locator("#buchung .booking-flow");
  await form.waitFor({ state: "visible" });
  // Exercise existing client-side inputs only. The context still blocks every
  // write request, and no submit button, consent or file picker is activated.
  await form.locator('input[name="paket"][value="keramik"]').check();
  await form.locator('input[name="klasse"][value="suv"]').check();
  await form.locator(".booking-steps button").nth(1).click();
  await form.locator("#city").selectOption("nagold");
  await form.locator(".booking-steps button").nth(2).click();
  await form.locator("#note").fill("Synthetische CI-Notiz: nur Navigation prüfen, keine Anfrage senden.");
  const readDraft = () => form.evaluate((element) => ({
    package: element.querySelector('input[name="paket"]:checked')?.value,
    vehicleClass: element.querySelector('input[name="klasse"]:checked')?.value,
    city: element.querySelector("#city")?.value,
    note: element.querySelector("#note")?.value,
    step: element.querySelector('.booking-steps [aria-current="step"]')?.textContent,
  }));
  const draft = await readDraft();
  for (const [source, link] of [["header", headerCta], ["hero", heroCta]]) {
    for (const activation of ["mouse", "Enter"]) {
      progress = { stage: "booking-cta", path: "/", width, reducedMotion, source, activation, completed: results.length, updatedAt: new Date().toISOString() };
      // Keep #buchung in the URL while leaving the destination. This catches
      // handlers that only react to a changed hash or retain the old focus.
      await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
      try {
        await page.waitForFunction(() => window.scrollY <= 1);
      } catch (error) {
        const geometry = await page.evaluate(() => ({
          scrollY, hash: location.hash,
          activeElement: document.activeElement?.id || document.activeElement?.tagName,
          htmlClasses: document.documentElement.className,
          hero: document.querySelector(".scroll-film")?.getBoundingClientRect().toJSON(),
          heading: document.getElementById("buchung-heading")?.getBoundingClientRect().toJSON(),
        }));
        console.error("BOOKING_RESET_FAILURE:" + JSON.stringify({ ...progress, geometry }));
        throw error;
      }
      if (source === "hero") {
        // With motion enabled, the real film eases its copy back in after
        // scrollY reaches zero. Wait for that visible, interactive state before
        // moving keyboard focus; do not disable the production inert behavior.
        await page.waitForFunction(() => {
          const link = document.querySelector(".scroll-film-cta");
          const copy = link?.closest(".scroll-film-copy");
          return link && !link.closest("[inert]") && copy &&
            Number(getComputedStyle(copy).opacity) >= 0.99;
        }, undefined, { timeout: 5_000 });
      }
      await link.focus();
      assert.equal(await link.evaluate((element) => element === document.activeElement), true,
        `${width}px ${source}: move focus away from the booking heading before reactivation.`);
      assert.equal(new URL(page.url()).hash, "#buchung", "Exercise repeated activation of the same hash.");
      if (activation === "mouse") await link.click();
      else await link.press("Enter");
      await assertBookingArrival(page, `${width}px ${reducedMotion}, ${source} ${activation}`);
      assert.deepEqual(await readDraft(), draft,
        `${width}px ${reducedMotion}, ${source} ${activation}: preserve entered fields, selection and current form step.`);
      assert.equal(await page.evaluate(() => document.querySelectorAll("#buchung").length), 1,
        "CTA navigation must retain the single existing request flow.");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 2, `${width}px ${source}: booking destination overflows by ${overflow}px.`);
    }
  }
  if (reducedMotion === "reduce" && [390, 1440].includes(width)) {
    await page.screenshot({ path: `.qa-output/review-booking-target-${width}.png`, fullPage: false });
  }
  return { sameHashActivations: 4, bookingHeadingFocusedAndVisible: true, draftPreserved: true };
}
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
  for (const width of [320, 375, 390]) {
    const { context, page } = await openPage({ width, height: 844 });
    try {
      for (const path of paths) {
        // Each page/width is an independent crawl case, not one customer making
        // hundreds of booking-calendar requests in a minute.
        await context.setExtraHTTPHeaders(qaClientHeaders("responsive", `${width}:${path}`));
        progress = { stage: "navigation", path, width, completed: results.length, updatedAt: new Date().toISOString() };
        await page.goto(qaBase + path, { waitUntil: "networkidle" });
        // content-visibility:auto defers layout below the fold. Exercise the real
        // scroll path before judging overflow; do not disable production styles.
        for (
          let y = 0;
          y < (await page.evaluate(() => document.documentElement.scrollHeight));
          y += 650
        ) {
          progress = { stage: "scroll", path, width, top: y, completed: results.length, updatedAt: new Date().toISOString() };
          await scrollAndRender(page, y);
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
          duplicateMinutePeriod: /\bMin\.\./.test(document.querySelector("main")?.textContent ?? ""),
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
        if (path.startsWith("/abholservice/") && state.duplicateMinutePeriod)
          failures.push(`${path} @${width}: journey text has a duplicate sentence-ending period`);
        if (state.scroll > state.viewport + 2)
          failures.push(`${path} @${width}: horizontal overflow ${JSON.stringify(state)}`);
      }
    } finally {
      await context.close();
    }
  }
  // This independent first visit keeps the crawl cases and their consent state
  // unchanged, while exercising the real dismiss/reopen controls on a city hub.
  {
    const { context, page } = await openPage({ width: 390, height: 844 });
    try {
      progress = { stage: "city-consent-overlay", path: "/abholservice/nagold", width: 390, completed: results.length, updatedAt: new Date().toISOString() };
      await page.goto(qaBase + "/abholservice/nagold", { waitUntil: "networkidle" });
      const consent = page.getByRole("dialog", { name: "Cookie-Einstellungen", exact: true });
      const cityCta = page.locator(".city-wa-bar");
      await consent.waitFor({ state: "visible" });
      await page.locator('body[data-consent-banner="open"]').waitFor({ state: "attached" });
      assert.equal(await cityCta.count(), 1, "The city CTA exists before testing its consent-dependent visibility.");
      assert.equal(await page.evaluate(() => localStorage.getItem("wg-consent")), null, "Use a genuine first visit.");
      await cityCta.waitFor({ state: "hidden" });
      await scrollAndRender(page, 0);
      const heading = await page.locator("main h1").boundingBox();
      const banner = await consent.boundingBox();
      assert.ok(heading && banner && heading.y + heading.height <= banner.y,
        `Nagold's full heading remains above consent: ${JSON.stringify({ heading, banner })}`);
      await page.screenshot({ path: ".qa-output/mobile-390--abholservice-nagold.png", fullPage: false });

      await consent.getByRole("button", { name: "Ablehnen", exact: true }).click();
      await consent.waitFor({ state: "hidden" });
      await cityCta.waitFor({ state: "visible" });
      assert.equal(await page.evaluate(() => localStorage.getItem("wg-consent")), "rejected");

      // The footer button is rendered by CookieSettingsButton with this name.
      await page.getByRole("button", { name: "Cookie-Einstellungen", exact: true }).click();
      await consent.waitFor({ state: "visible" });
      await cityCta.waitFor({ state: "hidden" });
      assert.equal(await page.evaluate(() => localStorage.getItem("wg-consent")), "rejected",
        "Reopening settings must not change the stored decision.");
      results.push({ path: "/abholservice/nagold", width: 390, firstVisit: true, cityCtaHiddenDuringConsent: true, cityCtaVisibleAfterRejection: true, cityCtaHiddenAfterReopen: true });
    } finally {
      await context.close();
    }
  }
  // Keep the explicit primary CTA at every width, alongside the existing
  // desktop Termin link. Exercise the exact 959/960px navigation boundary.
  const headerCases = [320, 390, 768, 900, 959, 960, 1024, 1440]
    .map((width) => ({ width, reducedMotion: "reduce" }));
  headerCases.push(...[390, 1440].map((width) => ({ width, reducedMotion: "no-preference" })));
  for (const { width, reducedMotion } of headerCases) {
    const { context, page } = await openPage({ width, height: width <= 390 ? 844 : 1000 }, reducedMotion);
    try {
      progress = { stage: "header-navigation", path: "/", width, completed: results.length, updatedAt: new Date().toISOString() };
      await page.goto(qaBase + "/", { waitUntil: "networkidle" });
      const consent = page.getByRole("dialog", { name: "Cookie-Einstellungen", exact: true });
      if (await consent.isVisible()) {
        await consent.getByRole("button", { name: "Ablehnen", exact: true }).click();
        await consent.waitFor({ state: "hidden" });
      }
      const header = page.locator(".site-header");
      const booking = header.locator(".header-film-booking");
      assert.equal(await booking.count(), 1, `${width}px: retain the primary header CTA.`);
      assert.equal(await header.getByRole("link", { name: bookingCtaName, exact: true }).count(), 1,
        `${width}px: the primary header CTA has the exact accessible name.`);
      assert.equal(await booking.isVisible(), true, `${width}px: keep the primary header CTA visible.`);
      assert.equal(await booking.getAttribute("href"), "/#buchung");
      const navBooking = header.locator(".header-booking-link");
      assert.equal(await navBooking.count(), 1, "Keep the existing desktop Termin navigation link.");
      assert.equal((await navBooking.textContent()).trim(), "Termin");
      assert.equal(await navBooking.getAttribute("href"), "/#buchung");
      assert.equal(await navBooking.isVisible(), width >= 960,
        `${width}px: the existing Termin navigation follows the desktop breakpoint.`);
      if (width >= 960) {
        const navBounds = await navBooking.boundingBox();
        assert.ok(navBounds && navBounds.height >= 44,
          `${width}px: retain the existing Termin navigation touch-target height.`);
      }
      const heroBooking = page.locator(".scroll-film-cta");
      assert.equal(await page.locator(".scroll-film").getByRole("link", { name: bookingCtaName, exact: true }).count(), 1,
        `${width}px: the hero CTA uses the same exact accessible name.`);
      assert.equal(await heroBooking.getAttribute("href"), "/#buchung");
      assert.equal(await heroBooking.isVisible(), true, `${width}px: the hero CTA remains visible.`);
      const bounds = await booking.boundingBox();
      assert.ok(bounds && bounds.height >= 44 && bounds.width >= 44 && bounds.x >= 0 && bounds.x + bounds.width <= width,
        `${width}px: the booking link must retain its visible touch target.`);
      const heroBounds = await heroBooking.boundingBox();
      assert.ok(heroBounds && heroBounds.height >= 44 && heroBounds.width >= 44 && heroBounds.x >= 0 && heroBounds.x + heroBounds.width <= width,
        `${width}px: the hero CTA must retain its visible touch target.`);
      const toggle = header.getByRole("button", { name: "Menü öffnen", exact: true });
      const logoBounds = await header.locator(".ga-logo").boundingBox();
      assert.ok(logoBounds && Math.abs(logoBounds.x + logoBounds.width / 2 - width / 2) <= 2,
        `${width}px: the White-Gloss logo stays centered.`);
      const controls = await header.locator(".ga-logo, .menu-toggle, .header-film-booking, .header-quick-nav a").evaluateAll((elements) => elements
        .map((element) => ({ name: element.getAttribute("aria-label") || element.textContent.trim(), ...element.getBoundingClientRect().toJSON() }))
        .filter((box) => box.width > 0 && box.height > 0));
      const headerBounds = await header.boundingBox();
      const disjoint = (a, b) => a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1;
      for (const [index, control] of controls.entries()) {
        assert.ok(headerBounds && control.left >= 0 && control.right <= width && control.top >= headerBounds.y - 1 && control.bottom <= headerBounds.y + headerBounds.height + 1,
          `${width}px: header control stays inside the viewport/header: ${JSON.stringify(control)}`);
        for (const other of controls.slice(index + 1)) {
          assert.ok(disjoint(control, other), `${width}px: header controls overlap: ${JSON.stringify({ control, other })}`);
        }
      }
      assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), reducedMotion === "reduce");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 2),
        `${width}px: the header and hero must not introduce horizontal overflow.`);
      await toggle.focus();
      await toggle.press("Enter");
      const menu = page.getByRole("dialog", { name: "Hauptnavigation", exact: true });
      await menu.waitFor({ state: "visible" });
      assert.equal(await menu.evaluate((element) => element.contains(document.activeElement)), true,
        `${width}px: keyboard focus enters the open menu.`);
      await page.keyboard.press("Escape");
      await menu.waitFor({ state: "hidden" });
      assert.equal(await toggle.evaluate((element) => element === document.activeElement), true,
        `${width}px: closing the menu restores focus to its trigger.`);
      if (reducedMotion === "reduce") await header.screenshot({ path: `.qa-output/review-header-${width}.png` });
      const activation = await verifyBookingActivation(page, width, reducedMotion);
      results.push({ path: "/", width, reducedMotion, primaryHeaderBookingLinks: 1, desktopTerminVisible: width >= 960, menuKeyboardFocusReturned: true, ...activation });
    } finally {
      await context.close();
    }
  }
  // Review the changed request path at phone and desktop sizes. These images
  // are produced by the existing isolated Linux CI job, never a local server.
  for (const width of [390, 1440]) {
    const { context, page } = await openPage({ width, height: width === 390 ? 844 : 1000 });
    try {
      progress = { stage: "review-navigation", path: "/", width, completed: results.length, updatedAt: new Date().toISOString() };
      await page.goto(qaBase + "/", { waitUntil: "networkidle" });
      const consent = page.getByRole("dialog", { name: "Cookie-Einstellungen", exact: true });
      if (await consent.isVisible()) {
        await consent.getByRole("button", { name: "Ablehnen", exact: true }).click();
        await consent.waitFor({ state: "hidden" });
      }
      const order = await page.evaluate(() => {
        const selectors = [".workshop-personal", "#pakete", "#kundenergebnisse", ".home-craft", ".concierge-service", "#buchung"];
        const sections = selectors.map((selector) => document.querySelector(selector));
        return {
          sectionsPresent: sections.every(Boolean),
          editorialOrder: sections.every((section, index) => Boolean(section) && (index === 0 || Boolean(
            sections[index - 1]?.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING,
          ))),
          bookingCount: document.querySelectorAll("#buchung").length,
        };
      });
      assert.equal(order.sectionsPresent, true, "Retain workshop, packages, results, process, pickup and booking content.");
      assert.equal(order.editorialOrder, true, "Keep the approved editorial sequence before the request.");
      assert.equal(order.bookingCount, 1, "Keep one request flow and stable incoming anchor links.");
      await page.locator(".home-jump-links").getByRole("link", { name: "Termin anfragen", exact: true }).click();
      await page.getByRole("form", { name: "Ihre Aufbereitung." }).waitFor({ state: "visible", timeout: 15_000 });
      assert.equal(new URL(page.url()).hash, "#buchung", "The existing jump link still targets the booking anchor.");
      await page.waitForFunction(() => {
        const heading = document.getElementById("buchung-heading")?.getBoundingClientRect();
        const header = document.querySelector(".site-header")?.getBoundingClientRect();
        return heading && header && heading.top >= header.bottom - 1 && heading.top < innerHeight;
      }, undefined, { timeout: 5000 });
      await page.locator("#buchung").screenshot({ path: `.qa-output/review-request-${width}.png` });
      await page.locator("#kundenergebnisse").scrollIntoViewIfNeeded();
      const video = page.getByRole("button", { name: "Video abspielen: Hydrophober Lackschutz White-Gloss Ceramic 0:11 Min.", exact: true });
      await video.focus();
      await video.press("Enter");
      await page.getByRole("dialog", { name: "Hydrophober Lackschutz", exact: true }).waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      await page.locator(".wg-video-dialog").waitFor({ state: "hidden" });
      assert.equal(await video.evaluate((element) => element === document.activeElement), true, "Return keyboard focus to the video trigger.");
      await page.locator("#kundenergebnisse").screenshot({ path: `.qa-output/review-results-${width}.png` });
      for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += 650) {
        progress = { stage: "review-scroll", path: "/", width, top: y, completed: results.length, updatedAt: new Date().toISOString() };
        await scrollAndRender(page, y);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `.qa-output/review-home-${width}.png`, fullPage: true });
      results.push({ path: "/", width, review: true, ...order, videoKeyboardFocusReturned: true });
    } finally {
      await context.close();
    }
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
} catch (error) {
  failures.push(error.message);
  console.error("RESPONSIVE_FAILURE:" + JSON.stringify({ progress, failures }));
  throw error;
} finally {
  await writeFile(".qa-output/responsive-progress.json", JSON.stringify(progress, null, 2));
  await writeFile(".qa-output/responsive-results.json", JSON.stringify(results, null, 2));
  await writeFile(".qa-output/responsive-failures.json", JSON.stringify(failures, null, 2));
  await browser.close();
}
assert.equal(failures.length, 0, failures.join("\n"));
console.log(`${results.length} responsive checks passed; no form or upload submitted.`);

