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

const output = ".qa-output/booking-ui";
await mkdir(output, { recursive: true });
const results = [];
const blocked = [];
const errors = [];
const requestable = extras.filter((extra) => extra.requestable !== false);
assert.equal(requestable.length, 12, "Twelve bookable extras are expected");

const browser = await chromium.launch({ headless: true });

async function openContext(options) {
  const context = await browser.newContext(options);
  const assets = [];
  await context.route("**/*", (route) => {
    const request = route.request();
    if (new URL(request.url()).origin !== qaBase || !["GET", "HEAD"].includes(request.method())) {
      blocked.push(`${request.method()} ${request.url()}`);
      return route.abort();
    }
    assets.push(new URL(request.url()).pathname);
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));
  page.on("console", (message) => {
    // Third-party resources are aborted on purpose; everything else must stay quiet.
    if (message.type() === "error" && !/Failed to load resource/.test(message.text()))
      errors.push(`${page.url()}: ${message.text()}`);
  });
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

try {
  /* ---- Desktop: existing three-step form, prices, package/vehicle changes, pickup ---- */
  {
    const { context, page, assets } = await openContext({ viewport: { width: 1280, height: 900 } });
    await openBooking(page);
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
    await expectText(page, total, "468 €", "Kompakt · Reinigung & Politur + Felgen");
    await step(1);
    await page.locator('input[name="klasse"][value="suv"]').check();
    await expectText(page, total, "585 €", "SUV · Reinigung & Politur + Felgen");
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
    await expectText(page, total, "1.272,50 €", "SUV · Keramikschutz + Felgen, Leder inklusive");
    await step(1);
    await page.locator('input[name="paket"][value="premium"]').check();
    await step(2);
    assert.equal(await page.locator("#extra-leder").isChecked(), false, "Included extra dropped");
    await expectText(page, total, "585 €", "Back to Reinigung & Politur without leftover extras");

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
    await expectText(page, total, "1.018 €", "Keramikschutz includes pickup up to 60 km");

    await step(3);
    await page.locator("#name").waitFor({ state: "visible" });
    assert.ok(await page.locator('button[type="submit"]').isVisible());
    await page.screenshot({ path: `${output}/desktop-1280-kontakt.png` });
    await step(2);
    assert.equal(await page.locator("#extra-felgen").isChecked(), true, "Selection is kept");
    results.push("Contact step reachable and reversible without losing the selection");

    await page.goto(`${qaBase}/`, { waitUntil: "networkidle" });
    await page.locator("#pakete").scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    assert.ok(
      assets.some((path) => /\/assets\/gsap-/.test(path)),
      "Desktop motion loads GSAP on demand",
    );
    results.push("Desktop loads the scroll-motion chunk on demand");
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
    await page.locator(".booking-steps button").nth(1).click();
    const extrasBox = page.locator("details.booking-extras");
    if (!(await extrasBox.evaluate((details) => details.open)))
      await extrasBox.locator("summary").click();
    await page.locator("#extra-ozon").check();
    await page.locator("#extra-leder").check();
    await expectText(page, ".booking-price strong", "597 €", "Mobile total");
    assert.ok((await overflow(page)) <= 2, "No horizontal overflow in the extras step");
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

  assert.deepEqual(
    blocked.filter((entry) => !/^GET /.test(entry)),
    [],
    "No form, upload or other write request may leave the browser",
  );
  assert.deepEqual(errors, [], "The browser console must stay free of errors");
} finally {
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ passed: results.length, results, errors, blocked }, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify({ passed: results.length, results }, null, 2));
