// Read-only browser check of the published IONOS site (GitHub runner only).
// Starts no server. Only same-origin GET/HEAD requests are allowed, the consent
// banner is declined, and no form, upload or message is ever submitted.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = "https://white-gloss.de";
const output = ".live-check";
await mkdir(output, { recursive: true });
const report = { base, checkedAt: new Date().toISOString(), pages: [], booking: [], errors: [] };
const blocked = [];
const flat = (value) => (value ?? "").replace(/\s+/g, " ").trim();

const browser = await chromium.launch({ headless: true });

async function openContext(viewport, mobile = false) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const assets = [];
  await context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base || !["GET", "HEAD"].includes(request.method())) {
      if (!["GET", "HEAD"].includes(request.method())) blocked.push(`${request.method()} ${url}`);
      return route.abort();
    }
    assets.push(url.pathname);
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(`${page.url()}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !/Failed to load resource/.test(message.text()))
      report.errors.push(`${page.url()}: ${message.text()}`);
  });
  return { context, page, assets };
}

async function visit(page, path) {
  const response = await page.goto(base + path, { waitUntil: "networkidle", timeout: 45_000 });
  const reject = page.getByRole("button", { name: "Ablehnen" });
  if (await reject.isVisible().catch(() => false)) await reject.click();
  return response;
}

async function total(page, selector, expected) {
  await page.waitForFunction(
    ([sel, value]) =>
      (document.querySelector(sel)?.textContent ?? "").replace(/\s+/g, " ").includes(value),
    [selector, expected],
    { timeout: 8000 },
  );
  return expected;
}

try {
  const viewports = [
    { name: "mobil-375", viewport: { width: 375, height: 812 }, mobile: true },
    { name: "mobil-390", viewport: { width: 390, height: 844 }, mobile: true },
    { name: "tablet-768", viewport: { width: 768, height: 1024 }, mobile: false },
    { name: "desktop-1280", viewport: { width: 1280, height: 900 }, mobile: false },
    { name: "desktop-1536", viewport: { width: 1536, height: 960 }, mobile: false },
  ];
  for (const { name, viewport, mobile } of viewports) {
    const { context, page } = await openContext(viewport, mobile);
    for (const path of ["/", "/galerie", "/leistungen", "/preise", "/impressum"]) {
      const response = await visit(page, path);
      const state = await page.evaluate(() => ({
        h1: [...document.querySelectorAll("h1")].map((h) => h.textContent?.trim()),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      report.pages.push({ viewport: name, path, status: response?.status(), ...state });
      assert.equal(response?.status(), 200, `${path} @${name}`);
      assert.equal(state.h1.length, 1, `${path} @${name}: one H1`);
      assert.ok(state.overflow <= 2, `${path} @${name}: horizontal overflow ${state.overflow}`);
      const slug = path === "/" ? "start" : path.slice(1);
      await page.screenshot({ path: `${output}/${name}-${slug}.png` });
    }
    await visit(page, "/");
    for (const id of ["pakete", "kundenergebnisse", "bewertungen"]) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${output}/${name}-start-${id}.png` });
    }
    await context.close();
  }

  const imprint = await (await fetch(`${base}/impressum`)).text();
  assert.match(imprint, /DE465024196/, "VAT ID in the imprint");
  assert.doesNotMatch(imprint, /42161-24623/, "Private tax number stays removed");
  const home = await (await fetch(`${base}/`)).text();
  report.release = {
    stylesheets: [...home.matchAll(/href="(\/assets\/[^"]+\.css)"/g)].map((m) => m[1]),
    luxuryLayout: /home-directory/.test(home) && /atelier-packages/.test(home),
  };

  for (const { name, viewport, mobile } of [
    { name: "desktop-1280", viewport: { width: 1280, height: 900 }, mobile: false },
    { name: "mobil-390", viewport: { width: 390, height: 844 }, mobile: true },
  ]) {
    const { context, page, assets } = await openContext(viewport, mobile);
    await visit(page, "/#buchung");
    await page.locator("form.booking-flow").waitFor({ timeout: 20_000 });
    const extras = await page.locator(".booking-extra input[type=checkbox]").count();
    await page.locator('input[name="klasse"][value="kompakt"]').check();
    await page.locator('input[name="paket"][value="premium"]').check();
    await page.locator("#extra-felgen").check();
    const sel = mobile ? ".booking-pricebar-toggle strong" : ".booking-aside .booking-total strong";
    const kompakt = await total(page, sel, "468 €");
    await page.locator('input[name="klasse"][value="suv"]').check();
    const suv = await total(page, sel, "585 €");
    await page.locator("#extra-felgen").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/${name}-buchung-auswahl.png` });
    if (mobile) {
      await page.locator(".booking-pricebar-toggle").click();
      await page.screenshot({ path: `${output}/${name}-buchung-preisdetails.png` });
      await page.keyboard.press("Escape");
      await page.locator(".booking-pricebar-action").click();
    } else {
      await page.locator(".booking-aside-action").click();
    }
    await page.locator("#name").waitFor({ state: "visible" });
    await page.screenshot({ path: `${output}/${name}-buchung-kontakt.png` });
    report.booking.push({
      viewport: name,
      extras,
      kompakt,
      suv,
      gsapLoaded: assets.some((path) => /\/assets\/gsap-/.test(path)),
    });
    assert.equal(extras, 12, "Twelve bookable extras");
    await context.close();
  }
  assert.deepEqual(blocked, [], "No write request may leave the browser");
} finally {
  report.blocked = blocked;
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(
  JSON.stringify(
    { release: report.release, booking: report.booking, errors: report.errors },
    null,
    2,
  ),
);
