import { assertIsolatedGithubCi } from "../hosting-policy.mjs";
import { qaBase } from "./ports.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

assertIsolatedGithubCi();
const device = process.argv[2];
assert.ok(["desktop", "mobile"].includes(device));
const viewport = device === "desktop" ? { width: 1440, height: 1000 } : { width: 390, height: 844 };
const out = resolve(".qa-output/prototype");
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport, locale: "de-DE", reducedMotion: "reduce" });
await context.route("**/*", (route) => {
  const url = new URL(route.request().url());
  return url.origin === qaBase
    ? route.continue()
    : route.fulfill({ status: 204, body: "" });
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const checks = [];

async function settle() {
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const img of document.images) img.loading = "eager";
    for (let top = 0; top < document.body.scrollHeight; top += innerHeight * 0.8) {
      window.scrollTo({ top, behavior: "instant" });
      await new Promise((done) => setTimeout(done, 60));
    }
    await Promise.race([
      Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => {}))),
      new Promise((done) => setTimeout(done, 10000)),
    ]);
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(250);
  const broken = await page.locator("main img").evaluateAll((imgs) => imgs.filter((img) => !img.complete || !img.naturalWidth).map((img) => img.getAttribute("src")));
  assert.deepEqual(broken, [], "All prototype images must load");
}

async function invariant() {
  return page.locator("main").evaluate((main) => ({
    text: main.textContent.replace(/\s+/g, " ").trim(),
    media: [...main.querySelectorAll("img")].map((img) => ({ src: img.getAttribute("src"), alt: img.alt })),
    links: [...main.querySelectorAll("a")].map((a) => a.getAttribute("href")),
  }));
}

async function capture(name, state) {
  if (state === "entwurf" && name !== "startseite") {
    const clearance = await page.evaluate(() => ({
      headerBottom: document.querySelector("header").getBoundingClientRect().bottom,
      crumbsTop: document.querySelector('[aria-label="Brotkrumen"]').getBoundingClientRect().top,
    }));
    assert.ok(clearance.crumbsTop >= clearance.headerBottom, `${name}: header overlaps breadcrumbs ${JSON.stringify(clearance)}`);
  }
  await page.screenshot({ path: resolve(out, `${name}-${device}-${state}.png`), fullPage: true });
  await page.screenshot({ path: resolve(out, `${name}-hero-${device}-${state}.png`) });
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  assert.ok(widths.content <= widths.viewport + 1, `${name}/${device}/${state}: horizontal overflow ${JSON.stringify(widths)}`);
  checks.push({ page: name, state, ...widths });
  if (name === "startseite") {
    for (const [detail, selector] of [["pakete", ".gd-pack"], ["ergebnisse", ".wg-results-teaser"], ["anfrage", "#buchung"]]) {
      const target = detail === "pakete" ? page.locator(selector).first().locator("xpath=../..") : page.locator(selector);
      await target.screenshot({ path: resolve(out, `${detail}-${device}-${state}.png`) });
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.locator("header .menu-toggle").click();
    await page.locator("#site-nav[open]").waitFor();
    await page.screenshot({ path: resolve(out, `menue-${device}-${state}.png`) });
    await page.keyboard.press("Escape");
    await page.locator("#site-nav[open]").waitFor({ state: "detached" });
    assert.equal(await page.locator("header .menu-toggle").evaluate((el) => el === document.activeElement), true);
  }
}

try {
  for (const [name, path] of [["startseite", "/"], ["preise", "/preise"], ["keramik", "/leistungen/keramikversiegelung"]]) {
    const response = await page.goto(qaBase + path, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    const reject = page.getByRole("button", { name: "Ablehnen", exact: true });
    if (await reject.isVisible()) await reject.click();
    await page.evaluate(() => document.documentElement.setAttribute("data-wg-baseline", ""));
    await settle();
    const before = await invariant();
    await capture(name, "vorher");
    await page.evaluate(() => document.documentElement.removeAttribute("data-wg-baseline"));
    await settle();
    const after = await invariant();
    assert.deepEqual(after, before, `${name}: content, images and destinations must be identical`);
    await capture(name, "entwurf");
  }
  if (device === "mobile") {
    for (const width of [320, 375, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(qaBase, { waitUntil: "networkidle" });
      const bounds = await page.locator("header .menu-toggle").evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width, viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth };
      });
      assert.ok(bounds.left >= 0 && bounds.right <= bounds.viewport + 1 && bounds.width >= 44, JSON.stringify(bounds));
      assert.ok(bounds.content <= bounds.viewport + 1, JSON.stringify(bounds));
      checks.push({ page: "header-reflow", width, ...bounds });
    }
  }
  assert.deepEqual(errors, []);
  console.log(`Prototype ${device}: ${checks.length} checks passed; identical content, media and links.`);
} catch (error) {
  await page.screenshot({ path: resolve(out, `failure-${device}.png`) }).catch(() => {});
  throw error;
} finally {
  await writeFile(resolve(out, `checks-${device}.json`), JSON.stringify({ viewport, checks, errors, note: "Isolated GitHub CI, reduced motion; external providers blocked, no real customer data or submissions." }, null, 2));
  await browser.close();
}
