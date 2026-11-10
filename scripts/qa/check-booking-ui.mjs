// Browser execution is restricted to the existing isolated Linux GitHub CI job.
// Exercises the booking selection, price summary, gallery viewer and responsive
// layout. Only same-origin GET requests are allowed; nothing is submitted.
import { assertIsolatedGithubCi } from "../hosting-policy.mjs";
assertIsolatedGithubCi();
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { extras } from "../../src/data/site.ts";
import { qaBase } from "./ports.mjs";
import { qaClientHeaders } from "./client-identity.mjs";
import { prepareBrowserFixture } from "./browser-fixture.mjs";
import { assertBrowserDiagnostics, createBrowserDiagnostics } from "../browser-diagnostics.mjs";

const output = ".qa-output/booking-ui";
await mkdir(output, { recursive: true });
const results = [];
const diagnostics = [];
const requestable = extras.filter((extra) => extra.requestable !== false);
assert.equal(requestable.length, 12, "Twelve bookable extras are expected");

const browser = await chromium.launch({ headless: true });

async function openContext(options) {
  const context = await browser.newContext({ ...options, serviceWorkers: "block", extraHTTPHeaders: qaClientHeaders("booking-ui", `context-${diagnostics.length}`) });
  const diagnostic = createBrowserDiagnostics({ origin: qaBase, label: `${options.viewport.width}x${options.viewport.height}` });
  diagnostics.push(diagnostic);
  const assets = [];
  await context.route("**/*", (route) => {
    const request = route.request();
    if (!diagnostic.allowRequest(request)) return route.abort();
    assets.push(new URL(request.url()).pathname);
    return route.continue();
  });
  const page = await context.newPage();
  diagnostic.attach(page);
  return { context, page, assets };
}

async function dismissConsent(page) {
  const reject = page.getByRole("button", { name: "Ablehnen" });
  if (await reject.isVisible().catch(() => false)) await reject.click();
}

async function openBooking(page) {
  await page.goto(`${qaBase}/#buchung`, { waitUntil: "networkidle" });
  await dismissConsent(page);
  await page.locator("form.booking-flow").waitFor();
}

const flat = (value) => (value ?? "").replace(/\s+/g, " ").trim();

async function expectText(page, selector, expected, label) {
  await page
    .waitForFunction(
      ([sel, value]) =>
        (document.querySelector(sel)?.textContent ?? "").replace(/\s+/g, " ").includes(value),
      [selector, expected],
      { timeout: 5000 },
    )
    .catch(async () => {
      const actual = flat(await page.locator(selector).first().textContent());
      throw new Error(`${label}: expected "${expected}" in ${selector}, got "${actual}"`);
    });
  results.push(`${label}: ${expected}`);
}

async function overflow(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function bookingLayout(page, desktop) {
  const geometry = await page.locator("form.booking-flow").evaluate((form) => {
    const price = form.querySelector(".booking-price");
    const panel = form.querySelector(".booking-step-panel:not([hidden])");
    const title = form.querySelector(".booking-step-title");
    return {
      price: price.getBoundingClientRect().toJSON(),
      panel: panel.getBoundingClientRect().toJSON(),
      title: title.getBoundingClientRect().toJSON(),
      pricePosition: getComputedStyle(price).position,
    };
  });
  if (desktop) {
    assert.equal(geometry.pricePosition, "sticky", "Desktop keeps the live price in its side column");
    assert.ok(geometry.price.left >= geometry.panel.right,
      "The desktop price summary must not cover the active form step");
  } else {
    assert.notEqual(geometry.pricePosition, "fixed", "The mobile price must not cover form controls");
    assert.ok(geometry.price.bottom <= geometry.title.top + 1,
      "The compact mobile price stays above the active step heading");
  }
  results.push(`${desktop ? "Desktop" : "Mobile"} price summary does not overlap the active form`);
}

async function capturePackageChapters(page) {
  const section = page.locator("#pakete");
  await page.waitForFunction(() => document.querySelector("#pakete")?.dataset.packageMotion === "scroll");
  assert.equal(await section.locator(".package-editorial-body").count(), 3);
  // Capture forward progression and then exercise reverse scrolling. All text
  // stays in the document; only the matching image should occupy the stage.
  for (const [position, index] of [0, 1, 2, 1].entries()) {
    await section.locator(".package-editorial-body").nth(index).evaluate((body) => {
      const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
      window.scrollTo({ top: window.scrollY + body.getBoundingClientRect().top - headerBottom - 16, behavior: "instant" });
    });
    await page.waitForFunction((activeIndex) => {
      const pictures = [...document.querySelectorAll("#pakete .package-editorial-media")];
      return pictures.length === 3 && pictures.every((picture, pictureIndex) => {
        const opacity = Number(getComputedStyle(picture).opacity);
        if (pictureIndex !== activeIndex) return picture.dataset.active === "false" && opacity < 0.01;
        const image = picture.querySelector("img");
        return picture.dataset.active === "true" && opacity > 0.99 && image?.complete && image.naturalWidth > 0;
      });
    }, index, { timeout: 10_000 });
    const picture = section.locator(".package-editorial-media").nth(index);
    assert.equal(await picture.evaluate((element) => getComputedStyle(element).position), "sticky");
    assert.ok((await overflow(page)) <= 2, `Package chapter ${index + 1}: no horizontal overflow`);
    await page.screenshot({ path: `${output}/desktop-package-${index + 1}${position === 3 ? "-reverse" : ""}.png` });
  }
  results.push("Package stages: three loaded images, correct forward/reverse selection, sticky desktop framing");
}

try {
  await prepareBrowserFixture({ scenario: "booking-ui" });
  // Test the real API limit, then give each unrelated browser scenario its own
  // stable client. Never reset the limiter or hide a 429 in browser diagnostics.
  const availability = `${qaBase}/api/availability?from=2040-01-01&to=2040-02-01`;
  const burstHeaders = qaClientHeaders("rate-limit-proof", "burst");
  for (let request = 1; request <= 8; request++) {
    const response = await fetch(availability, { headers: burstHeaders });
    assert.equal(response.status, 200, `Availability request ${request} stays within the production limit`);
    assert.equal((await response.json()).ok, true);
  }
  const ninth = await fetch(availability, { headers: burstHeaders });
  assert.equal(ninth.status, 429, "The same client is still limited after eight requests");
  assert.equal((await ninth.json()).error, "rate_limited");
  const independent = await fetch(availability, { headers: qaClientHeaders("rate-limit-proof", "independent") });
  assert.equal(independent.status, 200, "An independent client retains its own quota");
  results.push("Real availability limiter: eight allowed, ninth blocked, independent client unaffected");
  /* ---- Desktop: existing three-step form, prices, package/vehicle changes, pickup ---- */
  {
    const { context, page, assets } = await openContext({ viewport: { width: 1280, height: 900 } });
    await openBooking(page);
    await bookingLayout(page, true);
    const ids = await page
      .locator('input[type=checkbox][id^="extra-"]')
      .evaluateAll((inputs) => inputs.map((input) => input.id));
    assert.deepEqual(
      ids.sort(),
      requestable.map((extra) => `extra-${extra.id}`).sort(),
      "Every bookable extra must be selectable with its production ID",
    );
    results.push("All 12 bookable extras render with their production IDs");

    const total = ".booking-price strong";
    const step = async (number) => {
      await page
        .locator(".booking-steps button")
        .nth(number - 1)
        .click();
      if (number === 2) {
        const extrasBox = page.locator("details.booking-extras");
        if (!(await extrasBox.evaluate((details) => details.open)))
          await extrasBox.locator("summary").click();
      }
    };
    await page.locator('input[name="klasse"][value="kompakt"]').check();
    await page.locator('input[name="paket"][value="premium"]').check();
    await step(2);
    await page.selectOption("#city", "horb-am-neckar");
    await page.locator("#extra-felgen").check();
    await expectText(page, total, "468 €", "Kompakt · White-Gloss Signature + Felgen");
    await step(1);
    await page.locator('input[name="klasse"][value="suv"]').check();
    await expectText(page, total, "585 €", "SUV · White-Gloss Signature + Felgen");
    await page.screenshot({ path: `${output}/desktop-1280-auswahl.png` });

    await step(2);
    await page.locator("#extra-leder").check();
    await expectText(page, total, "771,25 €", "SUV · Politur + Felgen + Lederpflege");
    await step(1);
    await page.locator('input[name="paket"][value="keramik"]').check();
    await step(2);
    for (const id of ["leder", "glas"]) {
      assert.ok(await page.locator(`#extra-${id}`).isChecked(), `${id} shown as included`);
      assert.ok(await page.locator(`#extra-${id}`).isDisabled(), `${id} not selectable twice`);
    }
    await expectText(page, total, "1.272,50 €", "SUV · White-Gloss Ceramic + Felgen, Leder inklusive");
    await step(1);
    await page.locator('input[name="paket"][value="premium"]').check();
    await step(2);
    assert.equal(await page.locator("#extra-leder").isChecked(), false, "Included extra dropped");
    await expectText(page, total, "585 €", "Back to White-Gloss Signature without leftover extras");

    await step(1);
    await page.locator('input[name="klasse"][value="kompakt"]').check();
    await step(2);
    await page.selectOption("#city", "nagold");
    await expectText(page, total, "518 €", "Kompakt · Politur + Felgen · Abholung Nagold 50 €");
    await page.selectOption("#city", "sindelfingen");
    await expectText(page, total, "468 €", "Pickup beyond 50 km is not priced");
    await expectText(page, ".booking-price", "zzgl. Abholung nach Absprache", "Pickup on request");
    await step(1);
    await page.locator('input[name="paket"][value="keramik"]').check();
    await expectText(page, total, "1.018 €", "White-Gloss Ceramic includes pickup up to 60 km");

    await step(3);
    await page.locator("#name").waitFor({ state: "visible" });
    assert.ok(await page.locator('button[type="submit"]').isVisible());
    await page.screenshot({ path: `${output}/desktop-1280-kontakt.png` });
    await step(2);
    assert.equal(await page.locator("#extra-felgen").isChecked(), true, "Selection is kept");
    results.push("Contact step reachable and reversible without losing the selection");

    await page.goto(`${qaBase}/`, { waitUntil: "networkidle" });

    const pickupLinks = page.getByRole("list", { name: "Abholorte", exact: true });
    for (const [slug, name, expected] of [
      ["sulz-am-neckar", "Sulz am Neckar", "30 €"],
      ["voehringen", "Vöhringen", "30 €"],
      ["schopfloch", "Schopfloch", "30 €"],
      ["empfingen", "Empfingen", "kostenlos"],
      ["dornhan", "Dornhan", "50 €"],
      ["sindelfingen", "Sindelfingen", "auf Anfrage"],
    ]) {
      const chip = pickupLinks.locator(`a[href="/abholservice/${slug}"]`);
      assert.equal(await chip.count(), 1, `${name}: one pickup link`);
      assert.ok(
        flat(await chip.getAttribute("aria-label")).endsWith(`Abholung ${expected}`),
        `${name}: accessible pickup price is ${expected}`,
      );
      await chip.scrollIntoViewIfNeeded();
      const price = chip.locator(".city-chip-status");
      assert.ok(await price.isVisible(), `${name}: pickup price is visible`);
      assert.equal(flat(await price.innerText()), expected, `${name}: visible pickup price`);
    }
    results.push("Homepage pickup prices: city overrides, free pickup, tier and on-request agree visually and accessibly");
    await page.locator("#pakete").scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    assert.ok(
      assets.some((path) => /\/assets\/gsap-/.test(path)),
      "Desktop motion loads GSAP on demand",
    );
    results.push("Desktop loads the scroll-motion chunk on demand");
    await capturePackageChapters(page);
    await context.close();
  }

  /* ---- Mobile: form without overflow, no desktop motion download ---- */
  {
    const { context, page, assets } = await openContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await openBooking(page);
    await bookingLayout(page, false);
    await page.screenshot({ path: `${output}/mobile-390-auswahl.png` });
    await page.locator(".booking-steps button").nth(1).click();
    const extrasBox = page.locator("details.booking-extras");
    if (!(await extrasBox.evaluate((details) => details.open)))
      await extrasBox.locator("summary").click();
    await page.locator("#extra-ozon").check();
    await page.locator("#extra-leder").check();
    await expectText(page, ".booking-price strong", "597 €", "Mobile total");
    assert.ok((await overflow(page)) <= 2, "No horizontal overflow in the extras step");
    await page.locator("form.booking-flow").evaluate((form) => form.scrollIntoView());
    await page.waitForFunction(
      () => document.querySelector("[data-wa-float]")?.getAttribute("aria-hidden") === "true",
      undefined,
      { timeout: 5000 },
    );
    results.push("WhatsApp button hides over the lazily loaded booking form");
    await page.screenshot({ path: `${output}/mobile-390-extras.png` });
    await page.locator(".booking-steps button").nth(2).click();
    await page.locator("#name").waitFor({ state: "visible" });
    assert.ok((await overflow(page)) <= 2, "No horizontal overflow in the contact step");
    await page.screenshot({ path: `${output}/mobile-390-kontakt.png` });
    assert.ok(
      !assets.some((path) => /\/assets\/(gsap|ScrollTrigger)-/.test(path)),
      "Phones never download the desktop motion chunk",
    );
    results.push("Phones: booking without overflow, no GSAP download");
    await context.close();
  }

  /* ---- Gallery: curated selection, all photos, uncropped viewer, keyboard ---- */
  {
    const { context, page } = await openContext({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${qaBase}/galerie`, { waitUntil: "networkidle" });
    await dismissConsent(page);
    assert.equal(await page.locator(".customer-photo-grid > li").count(), 6);
    const dialog = page.locator("dialog.customer-photo-dialog");
    const curatedTitles = await page.locator(".customer-photo-grid h3").allTextContents();
    await page.locator(".customer-photo-trigger").first().click();
    await dialog.waitFor({ state: "visible" });
    await expectText(page, "dialog.customer-photo-dialog .kicker", "Bild 1 von 6", "Curated start");
    await page.keyboard.press("ArrowRight");
    await expectText(page, "dialog.customer-photo-dialog h2", curatedTitles[1], "Curated next");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.locator(".customer-photo-all").click();
    assert.equal(await page.locator(".customer-photo-grid > li").count(), 19);
    const trigger = page.locator(".customer-photo-trigger").first();
    await trigger.click();
    await dialog.waitFor({ state: "visible" });
    assert.equal(
      await dialog
        .locator(".customer-photo-viewer > img")
        .evaluate((img) => getComputedStyle(img).objectFit),
      "contain",
    );
    await expectText(page, "dialog.customer-photo-dialog .kicker", "Bild 1 von 19", "Viewer start");
    await page.keyboard.press("ArrowRight");
    await expectText(page, "dialog.customer-photo-dialog .kicker", "Bild 2 von 19", "ArrowRight");
    await page.screenshot({ path: `${output}/desktop-1280-galerie-viewer.png` });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await trigger.evaluate((element) => element === document.activeElement), true);
    results.push(
      "Gallery: 6 curated, all 19 photos, uncropped viewer, arrows, Escape, focus return",
    );
    assert.equal(
      (await page.locator("#kundenbeispiele video, #kundenbeispiele .wg-video-card").count()) > 0,
      true,
    );
    await context.close();
  }

  /* ---- Responsive widths required for the release ---- */
  for (const width of [320, 375, 768, 1280, 1536]) {
    const { context, page } = await openContext({
      viewport: { width, height: width < 700 ? 844 : 900 },
      reducedMotion: "reduce",
    });
    // 320 and 375 px are crawled page by page in check-responsive.mjs.
    const paths = width < 700 ? ["/", "/galerie"] : ["/", "/galerie", "/preise", "/impressum"];
    for (const path of paths) {
      await page.goto(qaBase + path, { waitUntil: "networkidle" });
      await dismissConsent(page);
      if (width >= 700) {
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < height; y += 700) {
          await page.evaluate((top) => window.scrollTo(0, top), y);
          const excess = await overflow(page);
          assert.ok(excess <= 2, `${path} @${width}, scroll ${y}: horizontal overflow ${excess}`);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
      } else {
        assert.ok((await overflow(page)) <= 2, `${path} @${width}: horizontal overflow`);
      }
      if (path === "/" || path === "/galerie")
        await page.screenshot({
          path: `${output}/${path === "/" ? "home" : "galerie"}-${width}.png`,
        });
      if (path === "/") {
        const packages = page.locator("#pakete");
        assert.equal(await packages.getAttribute("data-package-motion"), null,
          `Reduced motion @${width}: do not pin or crossfade the package chapters`);
        const imageStates = await packages.locator(".package-editorial-media").evaluateAll((pictures) =>
          pictures.map((picture) => ({ opacity: Number(getComputedStyle(picture).opacity), position: getComputedStyle(picture).position })),
        );
        assert.equal(imageStates.length, 3, `Reduced motion @${width}: retain all three package images`);
        assert.ok(imageStates.every((image) => image.opacity === 1 && image.position !== "sticky"),
          `Reduced motion @${width}: every package image remains visible in the normal document flow`);
        if (width === 1280) {
          await packages.locator(".package-editorial-body").first().scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${output}/desktop-packages-reduced-motion.png` });
        }
      }
    }
    await page.goto(`${qaBase}/#buchung`, { waitUntil: "networkidle" });
    await page.locator("form.booking-flow").waitFor();
    await page.locator("form.booking-flow").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/buchung-${width}.png` });
    results.push(`No horizontal overflow at ${width}px on ${paths.join(", ")}`);
    await context.close();
  }

  const impressum = await (await fetch(`${qaBase}/impressum`)).text();
  assert.match(impressum, /DE465024196/, "VAT ID stays in the imprint");
  assert.doesNotMatch(impressum, /42161-24623|Steuernummer/, "Private tax number stays removed");
  results.push("Imprint keeps the VAT ID and omits the private tax number");

  assertBrowserDiagnostics(diagnostics);
} finally {
  const evidence = diagnostics.map((item) => item.snapshot());
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({
      passed: results.length,
      results,
      errors: evidence.flatMap((item) => item.errors),
      blocked: evidence.flatMap((item) => item.blocked),
      ignored: evidence.flatMap((item) => item.ignored),
      warnings: evidence.flatMap((item) => item.warnings),
    }, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify({ passed: results.length, results }, null, 2));

