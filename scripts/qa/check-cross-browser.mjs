// Browser engines run only against this run's isolated production build in Linux CI.
import { assertIsolatedGithubCi } from "../hosting-policy.mjs";
assertIsolatedGithubCi();
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { qaBase, controlBase } from "./ports.mjs";
import { assertBrowserDiagnostics, createBrowserDiagnostics } from "../browser-diagnostics.mjs";

const output = resolve(".qa-output/cross-browser");
await mkdir(output, { recursive: true });
const report = {
  status: "running",
  scope: "Playwright Firefox and WebKit on Linux, 390px and 1440px viewports. WebKit is not a real Safari/iOS test; no physical device or native Windows/macOS browser claim.",
  checks: [], diagnostics: [], failures: [], screenshots: [],
};
const diagnostics = [];

async function rejectConsent(page) {
  const reject = page.getByRole("button", { name: "Ablehnen", exact: true });
  if (await reject.isVisible()) await reject.click();
}
async function screenshot(page, name) {
  await page.screenshot({ path: resolve(output, name) });
  report.screenshots.push(name);
}
async function verifyLayout(page, label) {
  assert.equal(await page.locator("h1").count(), 1, `${label}: one H1`);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (const top of [0, Math.floor(height / 2), height]) {
    await page.evaluate((y) => window.scrollTo(0, y), top);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 2, `${label}: overflow ${overflow}px at ${top}`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => [...document.images].filter((image) => {
    const box = image.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && getComputedStyle(image).visibility !== "hidden";
  }).every((image) => image.complete && image.naturalWidth > 0));
}

try {
  assert.ok(process.env.QA_RUN_ID);
  const identity = await fetch(controlBase + "/identity", { signal: AbortSignal.timeout(5000) });
  assert.equal(identity.status, 200);
  assert.equal(identity.headers.get("x-qa-run-id"), process.env.QA_RUN_ID);
  assert.deepEqual(await identity.json(), { isolated: true, database: "in-memory-pglite", externalFetch: "blocked" });
  const engines = await import("playwright");
  for (const name of ["firefox", "webkit"]) {
    let browser;
    try {
      browser = await engines[name].launch({ headless: true });
      for (const width of [390, 1440]) {
        const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 1000 }, hasTouch: width < 700, reducedMotion: "reduce", serviceWorkers: "block" });
        const diagnostic = createBrowserDiagnostics({ origin: qaBase, label: `${name}-${width}` });
        diagnostics.push(diagnostic);
        await context.route("**/*", (route) => diagnostic.allowRequest(route.request()) ? route.continue() : route.abort());
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        diagnostic.attach(page);
        try {
          for (const path of ["/", "/abholservice/nagold", "/leistungen/keramikversiegelung", "/galerie"]) {
            const response = await page.goto(qaBase + path, { waitUntil: "networkidle" });
            assert.equal(response.status(), 200, `${name} ${path}`);
            await rejectConsent(page);
            await verifyLayout(page, `${name} ${width} ${path}`);
            await screenshot(page, `${name}-${width}-${path.replace(/\W+/g, "-") || "home"}.png`);
            report.checks.push(`${name} ${width}px ${path}: status, H1, visible images and horizontal layout`);
          }

          const trigger = page.locator(".customer-photo-trigger").first();
          await trigger.click();
          const viewer = page.locator("dialog.customer-photo-dialog");
          await viewer.waitFor({ state: "visible" });
          await page.keyboard.press("ArrowRight");
          await page.waitForFunction(() => document.querySelector("dialog.customer-photo-dialog .kicker")?.textContent?.includes("Bild 2 von"));
          assert.equal(await viewer.locator(".customer-photo-viewer > img").evaluate((image) => getComputedStyle(image).objectFit), "contain");
          await page.keyboard.press("Escape");
          await viewer.waitFor({ state: "hidden" });
          assert.ok(await trigger.evaluate((element) => document.activeElement === element));

          const menu = page.getByRole("button", { name: "Menü öffnen", exact: true });
          await menu.focus();
          await page.keyboard.press("Enter");
          const dialog = page.getByRole("dialog", { name: "Hauptnavigation", exact: true });
          await dialog.waitFor({ state: "visible" });
          const controls = dialog.locator('a[href],button:not([disabled])');
          await controls.first().focus();
          await page.keyboard.press("Shift+Tab");
          assert.ok(await controls.last().evaluate((element) => element === document.activeElement));
          await page.keyboard.press("Tab");
          assert.ok(await controls.first().evaluate((element) => element === document.activeElement));
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
          assert.ok(await menu.evaluate((element) => element === document.activeElement));
          const skip = page.getByRole("link", { name: "Zum Inhalt springen", exact: true });
          await skip.focus();
          await page.keyboard.press("Enter");
          assert.equal(await page.evaluate(() => document.activeElement?.id), "main-content");
          report.checks.push(`${name} ${width}px: gallery keys/focus return, menu focus trap/Escape and skip link`);

          await page.goto(`${qaBase}/#buchung`, { waitUntil: "networkidle" });
          await rejectConsent(page);
          await page.locator("form.booking-flow").waitFor();
          await page.locator('input[name="klasse"][value="kompakt"]').check();
          await page.locator('input[name="paket"][value="premium"]').check();
          await page.locator(".booking-steps button").nth(1).click();
          const extras = page.locator("details.booking-extras");
          if (!(await extras.evaluate((element) => element.open))) await extras.locator("summary").click();
          await page.locator("#extra-felgen").check();
          await page.waitForFunction(() => document.querySelector(".booking-price strong")?.textContent?.includes("468 €"));
          assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 2);
          await screenshot(page, `${name}-${width}-booking.png`);
          report.checks.push(`${name} ${width}px: real booking selection totals 468 EUR without submission`);
        } finally {
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
  assert.equal(report.checks.length, 24, "Every engine and viewport must complete all checks");
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
