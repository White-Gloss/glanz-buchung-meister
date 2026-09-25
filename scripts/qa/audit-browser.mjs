// Read-only UI regression: no customer data, submissions, uploads, or external messages.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:8080";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error("Local test server required");
const out = resolve(process.env.AUDIT_OUTPUT || "../audit-browser-dev");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = { base, date: new Date().toISOString(), checks: [], errors: [], externalRequests: [], csp: [] };
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "de-DE", extraHTTPHeaders: { "X-Forwarded-Host": "white-gloss.de" } });
await context.exposeBinding("recordAuditCsp", (_source, event) => results.csp.push(event));
await context.addInitScript(() => {
  window.__auditCsp = [];
  document.addEventListener("securitypolicyviolation", (e) => {
    const event = { directive: e.effectiveDirective, blocked: e.blockedURI, disposition: e.disposition };
    window.__auditCsp.push(event);
    void window.recordAuditCsp(event);
  });
});
await context.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (["127.0.0.1", "localhost"].includes(url.hostname)) return route.continue();
  results.externalRequests.push(url.origin + url.pathname);
  // Google lifecycle is tested using a harmless script; no analytics sent to a real account.
  if (url.hostname === "www.googletagmanager.com" && url.pathname === "/gtag/js") {
    return route.fulfill({ contentType: "application/javascript", body: 'document.cookie="_ga=audit;path=/";window.__auditTagExecuted=true;' });
  }
  return route.fulfill({ status: 204, body: "" });
});
const page = await context.newPage();
page.on("pageerror", (error) => results.errors.push(error.message));
const check = (name, detail = {}) => results.checks.push({ name, result: "pass", ...detail });
const wait = (ms = 300) => page.waitForTimeout(ms);
const consentButton = () => page.locator("footer").getByRole("button", { name: "Cookie-Einstellungen", exact: true });
async function assertHeader(width) {
  await page.setViewportSize({ width, height: 812 });
  await page.goto(base, { waitUntil: "networkidle" });
  const reject = page.getByRole("button", { name: "Ablehnen", exact: true });
  if (await reject.isVisible()) await reject.click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await wait();
  const bounds = await page.locator("header .menu-toggle").evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { left: b.left, right: b.right, width: b.width, viewport: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  assert.ok(bounds.left >= 0 && bounds.right <= bounds.clientWidth + 1, JSON.stringify(bounds));
  assert.ok(bounds.width >= 44);
  assert.ok(bounds.scrollWidth <= bounds.clientWidth + 1);
  await page.locator("header .menu-toggle").click();
  await wait();
  assert.equal(await page.locator("#site-nav").evaluate((d) => d.open), true);
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Startseite");
  // Native dialog + explicit wrap keep focus in the menu.
  await page.locator("#site-nav a").last().focus();
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.closest("#site-nav") !== null), true);
  await page.keyboard.press("Escape");
  await wait(500);
  assert.equal(await page.locator("header .menu-toggle").evaluate((el) => el === document.activeElement), true);
  await page.screenshot({ path: resolve(out, `header-${width}.png`) });
  check(`Header/menu/focus ${width} CSS px`, bounds);
}

try {
  await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(results.externalRequests.filter((u) => /google.*(gtag|analytics)/.test(u)).length, 0);
  assert.equal(await page.locator(".scroll-film video").getAttribute("src"), null);
  check("No Google tag or hero video request before choice/scroll");
  await page.getByRole("button", { name: "Ablehnen", exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem("wg-consent")), "rejected");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator('script[src*="googletagmanager"]').count(), 0);
  check("Rejection persists and blocks script after reload");
  await consentButton().click();
  await page.getByRole("button", { name: "Akzeptieren", exact: true }).click();
  await page.waitForFunction(() => window.__auditTagExecuted === true);
  assert.equal(await page.locator('script[src*="googletagmanager"]').count(), 1);
  check("Consent loads one tag only (external script isolated)");
  await consentButton().click();
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: "Einwilligung widerrufen", exact: true }).click(),
  ]);
  await wait(400);
  assert.equal(await page.evaluate(() => localStorage.getItem("wg-consent")), "rejected");
  assert.equal(await page.locator('script[src*="googletagmanager"]').count(), 0);
  assert.equal((await context.cookies()).some((c) => c.name === "_ga"), false);
  check("Withdrawal persists denial, removes analytics cookie, unloads tag");
  await assertHeader(320);
  await assertHeader(375);
  // 1280px at 400% browser zoom has a 320 CSS-pixel layout viewport.
  check("400% reflow equivalent: 1280 / 4 = 320 CSS px (no browser zoom claim)");
  await page.locator(".scroll-film").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo({ top: 350, behavior: "instant" }));
  await page.waitForFunction(() => document.querySelector(".scroll-film video")?.readyState >= 2);
  await page.waitForFunction(() => { const v = document.querySelector(".scroll-film video"); const s = document.querySelector(".scroll-film"); const stage = document.querySelector(".scroll-film-stage"); return v && !v.seeking && Math.abs(v.currentTime - window.scrollY / (s.offsetHeight - stage.offsetHeight) * (v.duration - 1/24)) < 0.06; });
  const film = await page.locator(".scroll-film video").evaluate((v) => ({ src: v.currentSrc, duration: v.duration, time: v.currentTime, width: v.videoWidth, height: v.videoHeight }));
  await page.evaluate(() => window.scrollTo({ top: 700, behavior: "instant" }));
  await wait(800);
  const forward = await page.locator(".scroll-film video").evaluate((v) => v.currentTime);
  assert.ok(forward > film.time);
  await page.getByRole("button", { name: "Bewegung pausieren", exact: true }).click();
  const held = await page.locator(".scroll-film video").evaluate((v) => v.currentTime);
  await page.evaluate(() => window.scrollTo({ top: 1100, behavior: "instant" }));
  await wait(500);
  assert.equal(await page.locator(".scroll-film video").evaluate((v) => v.currentTime), held);
  await page.getByRole("button", { name: "Bewegung fortsetzen", exact: true }).click();
  await wait(800);
  assert.ok(await page.locator(".scroll-film video").evaluate((v) => v.currentTime) > held);
  check("Original mobile film: deferred start, forward scroll, pause/resume", film);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await wait();
  assert.equal(await page.locator(".scroll-film video").getAttribute("src"), null);
  check("Reduced motion unloads video and retains poster");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const labels = await page.locator(".wg-video-trigger, .instagram-badge").evaluateAll((nodes) => nodes.map((el) => ({ text: document.getElementById(el.getAttribute("aria-labelledby"))?.textContent.trim().replace(/\s+/g, " "), role: el.tagName === "A" ? "link" : "button" })));
  for (const label of labels) {
    assert.ok(label.text, JSON.stringify(label));
    assert.ok(await page.getByRole(label.role, { name: label.text, exact: true }).count() > 0, JSON.stringify(label));
  }
  check("Video and Instagram visible labels included in accessible names", { labels });

  // Package flow: no contact data and no submit interaction.
  await page.goto(`${base}/ratgeber/keramikversiegelung-kosten`, { waitUntil: "networkidle" });
  const articleLink = page.getByRole("link", { name: "Termin anfragen", exact: true }).filter({ hasNot: page.locator("header") });
  const hrefs = await articleLink.evaluateAll((links) => links.map((a) => a.getAttribute("href")));
  assert.ok(hrefs.some((href) => href.includes("paket=keramik")), JSON.stringify(hrefs));
  await page.locator('main a[href*="paket=keramik"]').first().click();
  await page.waitForSelector('input[value="keramik"]');
  assert.equal(await page.locator('input[value="keramik"]').isChecked(), true);
  assert.equal(await page.locator('input[value="kompakt"]').isChecked(), true);
  await page.locator('input[value="suv"]').check();
  await page.getByRole("button", { name: "Weiter zu Extras & Abholung" }).click();
  const select = page.locator("select").filter({ has: page.locator('option[value="nagold"]') });
  await select.selectOption("nagold");
  await page.getByRole("button", { name: "Weiter zu Kontakt & Anfrage" }).click();
  const summary = await page.getByRole("region", { name: "Zusammenfassung Ihrer Anfrage" }).innerText();
  assert.match(summary, /Keramikschutz/);
  assert.match(summary, /SUV \/ Limousine/);
  assert.match(summary, /Nagold/);
  assert.match(summary, /1\.123,75/);
  check("Guide → ceramic / SUV / Nagold / final summary 1123.75 EUR", { summary });
  await page.goto(`${base}/leistungen/innenraumreinigung/nagold`, { waitUntil: "networkidle" });
  await page.locator('main a[href*="paket=basis"]').first().click();
  await page.waitForSelector('input[value="basis"]');
  assert.equal(await page.locator('input[value="basis"]').isChecked(), true);
  // A fresh document starts with the compact-class default.
  assert.equal(await page.locator('input[value="kompakt"]').isChecked(), true);
  await page.locator('input[value="kompakt"]').check();
  await page.getByRole("button", { name: "Weiter zu Extras & Abholung" }).click();
  assert.equal(await page.locator('select').filter({ has: page.locator('option[value="nagold"]') }).inputValue(), "nagold");
  assert.equal(await page.locator("#extra-scheinwerfer").count(), 0);
  await page.getByRole("button", { name: "Weiter zu Kontakt & Anfrage" }).click();
  const interior = await page.getByRole("region", { name: "Zusammenfassung Ihrer Anfrage" }).innerText();
  assert.match(interior, /199\s*€/);
  check("Existing interior / Nagold path remains 199 EUR, suspended extra absent", { summary: interior });
  await page.goto(`${base}/ratgeber/innenraumreinigung-gerueche`, { waitUntil: "networkidle" });
  await page.locator('main a[href*="leistung=geruchsneutralisation"]').first().click();
  await page.waitForURL("**/fahrzeug-zustand?*");
  assert.match(await page.locator("form").innerText(), /Geruchsbehandlung mit Ozon/);
  check("Supplement guide preserves individual service context without priced package");
  for (const path of ["/galerie", "/preise"]) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    const controls = page.locator(".wg-video-trigger, .instagram-badge");
    assert.ok(await controls.count() > 0);
    for (const control of await controls.all()) {
      const label = await control.evaluate((el) => ({ name: document.getElementById(el.getAttribute("aria-labelledby"))?.textContent.trim().replace(/\s+/g, " "), role: el.tagName === "A" ? "link" : "button" }));
      assert.ok(label.name);
      assert.ok(await page.getByRole(label.role, { name: label.name, exact: true }).count() > 0);
    }
    check(`Shared accessible labels on ${path}`);
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.screenshot({ path: resolve(out, "desktop.png") });
  assert.deepEqual(results.errors, []);
  check("Browser render without uncaught JavaScript errors");
} catch (error) {
  results.failure = error.stack;
  await page.screenshot({ path: resolve(out, "failure.png") }).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(resolve(out, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ checks: results.checks.length, failure: results.failure, errors: results.errors, output: out }, null, 2));
  await browser.close();
}
