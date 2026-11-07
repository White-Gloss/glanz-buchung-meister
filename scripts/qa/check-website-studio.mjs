// This test mutates only the owned, ephemeral database and media store in Linux CI.
// No production URL, customer upload, booking or message endpoint is allowed.
import { assertIsolatedGithubCi } from "../hosting-policy.mjs";
assertIsolatedGithubCi();
import assert from "node:assert/strict";
import { createHash, X509Certificate } from "node:crypto";
import { mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { qaBase, controlBase, lighthouseBase } from "./ports.mjs";
import { qaClientHeaders } from "./client-identity.mjs";
import { robotsEvidence } from "./robots-evidence.mjs";
import { observeBrowserAction } from "./browser-action.mjs";
import { emptyCmsContent } from "../../src/lib/cms.model.ts";
import { assertBrowserDiagnostics, createBrowserDiagnostics } from "../browser-diagnostics.mjs";

const output = resolve(".qa-output/website-studio");
await mkdir(output, { recursive: true });
const report = { status: "running", checks: [], screenshots: [], diagnostics: [], blocked: [], serverFunctionTraffic: [], serverFunctions: {} };
let browser;
let latest;
let home;
let operatorCookie = "";
const diagnostics = [];
const ids = {};
const serverFunctionCandidates = {};
const pageTraffic = new WeakMap();
const mutationNames = ["saveCmsDraft", "publishCmsRevision", "restoreCmsRevisionAsDraft", "archiveCmsDocument", "updateCmsMedia", "archiveCmsMedia"];
let fromCrossJSON;
let toJSONAsync;
let defaultSerovalPlugins;

async function decoded(response) {
  return fromCrossJSON(await response.json(), { plugins: defaultSerovalPlugins });
}
async function rpc(name, data, cookie = "") {
  assert.ok(mutationNames.includes(name) && ids[name], `Unknown Studio mutation: ${name}`);
  const response = await fetch(`${qaBase}/_serverFn/${ids[name]}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tsr-serverFn": "true", "sec-fetch-site": "same-origin", "x-forwarded-proto": "https", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(await toJSONAsync({ data })),
    signal: AbortSignal.timeout(15000),
  });
  return decoded(response);
}
async function operation(page, name, action) {
  const path = name === "uploadCmsImage" ? "/api/studio-media-upload" : `/_serverFn/${ids[name]}`;
  const received = await observeBrowserAction(page, (value) => new URL(value.url()).pathname === path && value.request().method() === "POST", action);
  if (name === "uploadCmsImage") {
    assert.equal(received.status(), 201);
    const result = await received.json();
    assert.ok(result.media && !result.error, JSON.stringify(result.error));
    return result.media;
  }
  const result = await decoded(received);
  assert.ok(!result.error && result.result, `${name}: ${JSON.stringify(result.error)}`);
  return result.result;
}
async function session(kind) {
  const response = await fetch(controlBase + "/control", {
    method: "POST", headers: { "x-qa-run-id": process.env.QA_RUN_ID }, body: JSON.stringify({ createSession: kind }),
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200);
  return (await response.json()).cookie;
}
async function publicPage(path) {
  const response = await fetch(qaBase + path, { headers: { "x-forwarded-host": "white-gloss.de" }, signal: AbortSignal.timeout(15000) });
  return { response, html: await response.text() };
}
async function screenshot(page, name) {
  await page.screenshot({ path: resolve(output, name) });
  report.screenshots.push(name);
}
async function openStudio(width, cookie = operatorCookie) {
  const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 1000 }, reducedMotion: "reduce", serviceWorkers: "block", extraHTTPHeaders: qaClientHeaders("website-studio", `context-${diagnostics.length}`) });
  const diagnostic = createBrowserDiagnostics({ origin: lighthouseBase, label: `studio-${width}` });
  diagnostics.push(diagnostic);
  await context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === lighthouseBase && request.method() === "POST" && (url.pathname === "/api/studio-media-upload" || mutationNames.some((name) => url.pathname === `/_serverFn/${ids[name]}`))) return route.continue();
    if (diagnostic.allowRequest(request)) return route.continue();
    if (!["GET", "HEAD"].includes(request.method())) report.blocked.push(`${request.method()} ${url.origin}${url.pathname}`);
    return route.abort();
  });
  const separator = cookie.indexOf("=");
  await context.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: lighthouseBase, secure: true, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  const traffic = [];
  pageTraffic.set(page, traffic);
  const trace = (request, event, details = {}) => {
    const path = new URL(request.url()).pathname;
    if (!path.startsWith("/_serverFn/") || traffic.length >= 200) return;
    const entry = { label: `studio-${width}-${diagnostics.length}`, event, method: request.method(), path, ...details };
    traffic.push(entry);
    report.serverFunctionTraffic.push(entry);
  };
  page.on("request", (request) => trace(request, "request"));
  page.on("response", (response) => trace(response.request(), "response", { status: response.status() }));
  page.on("requestfailed", (request) => trace(request, "failed", { error: request.failure()?.errorText }));
  diagnostic.attach(page);
  page.setDefaultTimeout(15000);
  await page.goto(`${lighthouseBase}/admin/studio`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Website Studio", exact: true }).waitFor();
  await page.getByLabel("Überschrift", { exact: true }).waitFor();
  return { context, page };
}
async function selectAbout(page) {
  // Wait for this selection's real response, not a field left over from Home.
  let response;
  try {
    response = await observeBrowserAction(page,
      (value) => new URL(value.url()).pathname === `/_serverFn/${ids.getCmsStudioDocument}` && value.request().method() === "GET",
      () => page.getByLabel("Seite bearbeiten", { exact: true }).selectOption("about"));
  } catch (error) {
    report.lastFailureContext = {
      action: "selectAbout", expectedReaderId: ids.getCmsStudioDocument,
      traffic: pageTraffic.get(page)?.slice(-25) ?? [],
      ui: await page.evaluate(() => ({
        path: location.pathname,
        busy: [...document.querySelectorAll("main[aria-busy]")].map((element) => element.getAttribute("aria-busy")),
        selects: [...document.querySelectorAll("select")].map((element) => ({
          label: element.closest("label")?.querySelector("span")?.textContent,
          value: element.value, disabled: element.disabled,
          options: [...element.options].slice(0, 30).map((option) => option.value),
        })),
        inputs: [...document.querySelectorAll("input")].slice(0, 20).map((element) => ({ label: element.closest("label")?.querySelector("span")?.textContent, value: element.value.slice(0, 200), disabled: element.disabled })),
        alerts: [...document.querySelectorAll('[role="alert"]')].map((element) => element.textContent?.slice(0, 500)),
      })).catch((failure) => ({ unavailable: failure.message })),
    };
    throw new Error(`${error.message}\nStudio selection evidence: ${JSON.stringify(report.lastFailureContext)}`, { cause: error });
  }
  const result = await decoded(response);
  assert.ok(result.result && !result.error, JSON.stringify(result.error));
  assert.equal(result.result.key, "about");
  await page.getByLabel("Überschrift", { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector("main[aria-busy]")?.getAttribute("aria-busy") === "false");
  return result.result;
}
async function assertNoOverflow(page) {
  const excess = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(excess <= 2, `Studio horizontal overflow: ${excess}px`);
}
async function saved(page, title, body) {
  await page.getByLabel("Überschrift", { exact: true }).fill(title);
  if (body !== undefined) await page.getByLabel("Text", { exact: true }).fill(body);
  const result = await operation(page, "saveCmsDraft", () => page.getByRole("button", { name: "Entwurf speichern", exact: true }).click());
  await page.getByRole("status").filter({ hasText: "Entwurf gespeichert." }).waitFor();
  return result;
}

try {
  assert.ok(process.env.QA_RUN_ID, "An owned QA run is required");
  const identity = await fetch(controlBase + "/identity", { signal: AbortSignal.timeout(5000) });
  assert.equal(identity.status, 200);
  assert.equal(identity.headers.get("x-qa-run-id"), process.env.QA_RUN_ID);
  assert.deepEqual(await identity.json(), { isolated: true, database: "in-memory-pglite", externalFetch: "blocked" });
  const before = await (await fetch(controlBase + "/evidence")).json();
  ({ fromCrossJSON, toJSONAsync } = await import("seroval"));
  ({ defaultSerovalPlugins } = await import("@tanstack/router-core/ssr/client"));
  for (const file of await readdir(".output/server/_ssr")) {
    if (!file.endsWith(".mjs") && !file.endsWith(".js")) continue;
    const source = await readFile(resolve(".output/server/_ssr", file), "utf8");
    for (const match of source.matchAll(/id: "([a-f0-9]+)",\s*name: "(\w+)"/g)) {
      (serverFunctionCandidates[match[2]] ??= []).push({ id: match[1], file });
      ids[match[2]] = match[1];
    }
  }
  for (const name of [...mutationNames, "getCmsStudioDocument"]) {
    const candidates = serverFunctionCandidates[name] ?? [];
    report.serverFunctions[name] = candidates;
    assert.equal(new Set(candidates.map(({ id }) => id)).size, 1, `${name} must resolve to exactly one production server-function ID: ${JSON.stringify(candidates)}`);
  }

  // Trust this run's certificate pin, never disable certificate validation globally.
  const transport = JSON.parse(await readFile(".qa-output/lighthouse-transport.json", "utf8"));
  assert.equal(transport.runId, process.env.QA_RUN_ID);
  assert.equal(transport.origin, lighthouseBase);
  const certificatePath = await realpath(transport.certificatePath);
  assert.match(relative(resolve(".qa-output"), certificatePath).replaceAll("\\", "/"), /^lighthouse-tls-[A-Za-z0-9]+\/cert\.pem$/);
  const certificate = new X509Certificate(await readFile(certificatePath));
  const pin = createHash("sha256").update(certificate.publicKey.export({ type: "spki", format: "der" })).digest("base64");
  assert.equal(pin, transport.spkiPin);
  const { chromium } = await import("playwright");
  browser = await chromium.launch({ headless: true, args: [`--ignore-certificate-errors-spki-list=${pin}`] });
  operatorCookie = await session("operator");
  const outsiderCookie = await session("outsider");
  const expiredCookie = await session("expired-operator");
  const firstContent = { ...emptyCmsContent(), title: "QA Studio erster Entwurf", body: "<script>window.__studioUnexpected=1</script>", metaTitle: "QA Studio Suchvorschau", metaDescription: "Nur isolierte CI-Prüfung, keine Unternehmensangaben." };
  for (const cookie of ["", outsiderCookie, expiredCookie]) {
    const denied = await rpc("saveCmsDraft", { key: "about", expectedDraftRevisionId: null, content: firstContent }, cookie);
    assert.ok(denied.error, "Anonymous users and signed-in outsiders must not save drafts");
    const deniedUpload = await fetch(qaBase + "/api/studio-media-upload", { method: "POST", headers: { "x-forwarded-proto": "https", ...(cookie ? { cookie } : {}) }, body: "not-an-image" });
    assert.equal(deniedUpload.status, 401, "Upload authorization precedes image parsing");
    assert.match(deniedUpload.headers.get("cache-control"), /private.*no-store/);
  }
  report.checks.push("Anonymous, expired-session and non-operator draft writes/uploads are rejected by the real server");
  const first = await rpc("saveCmsDraft", { key: "about", expectedDraftRevisionId: null, content: firstContent }, operatorCookie);
  assert.ok(first.result && !first.error, JSON.stringify(first.error));
  latest = first.result;
  const firstRevision = latest.draftRevisionId;
  const unpublished = await publicPage("/ueber-uns");
  assert.equal(unpublished.response.status, 404, "About stays unpublished until approval");
  const unpublishedRobots = robotsEvidence(unpublished.html, unpublished.response.headers);
  assert.ok(unpublishedRobots.meta.some((value) => value.split(/[\s,]+/).includes("noindex")), `Unpublished About must have a real robots noindex meta: ${JSON.stringify(unpublishedRobots)}`);
  assert.ok(unpublishedRobots.meta.some((value) => value.split(/[\s,]+/).includes("nofollow")), `Unpublished About must have robots nofollow: ${JSON.stringify(unpublishedRobots)}`);
  assert.doesNotMatch(unpublished.html, /QA Studio erster Entwurf/);
  assert.doesNotMatch((await publicPage("/")).html, /href="\/ueber-uns"/);
  assert.doesNotMatch((await publicPage("/sitemap.xml")).html, /https:\/\/white-gloss\.de\/ueber-uns/);

  const desktop = await openStudio(1440);
  await selectAbout(desktop.page);
  assert.equal(await desktop.page.getByLabel("Überschrift", { exact: true }).inputValue(), firstContent.title);
  assert.match(await desktop.page.locator('meta[name="robots"]').last().getAttribute("content"), /noindex/);
  const stale = await openStudio(1440);
  await selectAbout(stale.page);
  latest = await saved(desktop.page, "QA Studio zweite Fassung");
  await stale.page.getByLabel("Überschrift", { exact: true }).fill("QA Studio konkurrierender Text");
  await stale.page.getByRole("button", { name: "Entwurf speichern", exact: true }).click();
  await stale.page.getByRole("alert").filter({ hasText: "zwischenzeitlich" }).waitFor();
  assert.equal(await stale.page.getByLabel("Überschrift", { exact: true }).inputValue(), "QA Studio konkurrierender Text");
  await screenshot(stale.page, "desktop-conflict.png");
  await stale.context.close();
  assert.doesNotMatch((await publicPage("/ueber-uns")).html, /QA Studio zweite Fassung/);
  report.checks.push("Draft saving stays private; concurrent edits are rejected without losing typed text");

  const previewButton = desktop.page.getByRole("button", { name: "Vorschau", exact: true });
  await previewButton.focus();
  await desktop.page.keyboard.press("Enter");
  const preview = desktop.page.getByRole("region", { name: "Geschützte Inhaltsvorschau", exact: true });
  await preview.waitFor();
  assert.ok((await preview.textContent()).includes("QA Studio zweite Fassung"));
  assert.equal(await preview.locator("script").count(), 0);
  assert.equal(await desktop.page.evaluate(() => window.__studioUnexpected), undefined);
  await screenshot(desktop.page, "desktop-preview.png");
  await desktop.page.getByRole("button", { name: "Fassungen", exact: true }).click();
  const revision = desktop.page.getByRole("listitem").filter({ has: desktop.page.getByText(`Fassung ${firstRevision}`, { exact: true }) });
  latest = await operation(desktop.page, "restoreCmsRevisionAsDraft", () => revision.getByRole("button", { name: "Als Entwurf wiederherstellen", exact: true }).click());
  assert.ok(latest.draftRevisionId > firstRevision);
  assert.equal(latest.publishedRevisionId, null);
  await desktop.page.getByRole("button", { name: "Inhalt", exact: true }).click();
  assert.equal(await desktop.page.getByLabel("Überschrift", { exact: true }).inputValue(), firstContent.title);
  report.checks.push("Keyboard preview renders text safely; restore creates a new private revision");

  await desktop.page.getByRole("button", { name: "Bilder", exact: true }).click();
  const input = desktop.page.getByLabel("Website-Bilder auswählen", { exact: true });
  await input.setInputFiles({ name: "untrusted.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
  await desktop.page.getByRole("alert").filter({ hasText: "Erlaubt sind JPEG" }).waitFor();
  const sourceImage = await readFile("public/media/hero-720.webp");
  const upload = await operation(desktop.page, "uploadCmsImage", () => input.setInputFiles({ name: "qa-studio.webp", mimeType: "image/webp", buffer: sourceImage }));
  assert.equal(upload.approved, false);
  assert.ok(upload.width <= 2400 && upload.height <= 2400);
  assert.equal((await fetch(qaBase + upload.publicUrl)).status, 404);
  for (const cookie of ["", outsiderCookie, expiredCookie]) {
    const deniedPreview = await fetch(qaBase + upload.previewUrl, { headers: { "x-forwarded-proto": "https", ...(cookie ? { cookie } : {}) } });
    assert.equal(deniedPreview.status, 401, "Private media preview requires a current operator session");
    assert.match(deniedPreview.headers.get("cache-control"), /private.*no-store/);
  }
  const privateImage = await fetch(qaBase + upload.previewUrl, { headers: { cookie: operatorCookie, "x-forwarded-proto": "https" } });
  assert.equal(privateImage.status, 200);
  assert.match(privateImage.headers.get("cache-control"), /private.*no-store/);
  assert.match(privateImage.headers.get("content-type"), /image\/webp/);
  const card = desktop.page.getByRole("listitem").filter({ hasText: "qa-studio.webp" });
  await card.getByLabel("Bildbeschreibung (Alt-Text)", { exact: true }).fill("Isoliertes QA-Bild aus dem öffentlichen Motivbestand");
  await card.getByRole("checkbox", { name: /Ich darf dieses Bild öffentlich verwenden/ }).check();
  const approved = await operation(desktop.page, "updateCmsMedia", () => card.getByRole("button", { name: "Bildangaben speichern", exact: true }).click());
  assert.equal((await fetch(qaBase + upload.publicUrl)).status, 404, "Approval alone does not publish an image");
  await screenshot(desktop.page, "desktop-media.png");
  await card.getByRole("button", { name: "Zur Seite hinzufügen", exact: true }).click();
  latest = await saved(desktop.page, "QA Studio freigegebene Fassung", "Isolierte Veröffentlichung zur Prüfung der Vorschau und Bildfreigabe.");
  await desktop.page.getByRole("button", { name: "Veröffentlichung prüfen", exact: true }).click();
  latest = await operation(desktop.page, "publishCmsRevision", () => desktop.page.getByRole("button", { name: "Jetzt veröffentlichen", exact: true }).click());
  const published = await publicPage("/ueber-uns");
  assert.equal(published.response.status, 200);
  assert.match(published.html, /QA Studio freigegebene Fassung/);
  assert.match(published.html, /QA Studio Suchvorschau/);
  assert.ok(published.html.includes(upload.publicUrl));
  assert.match((await publicPage("/")).html, /href="\/ueber-uns"/);
  assert.match((await publicPage("/sitemap.xml")).html, /https:\/\/white-gloss\.de\/ueber-uns/);
  const publicImage = await fetch(qaBase + upload.publicUrl);
  assert.equal(publicImage.status, 200);
  assert.match(publicImage.headers.get("cache-control"), /no-store/);
  const imageBytes = Buffer.from(await publicImage.arrayBuffer());
  assert.equal(imageBytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(imageBytes.toString("ascii", 8, 12), "WEBP");
  report.checks.push("Upload stays private until rights approval AND publication; optimized WebP and private preview verified");

  const mobile = await openStudio(390);
  await selectAbout(mobile.page);
  await assertNoOverflow(mobile.page);
  await screenshot(mobile.page, "mobile-editor.png");
  await mobile.page.getByRole("button", { name: "Vorschau", exact: true }).click();
  await mobile.page.getByRole("region", { name: "Geschützte Inhaltsvorschau", exact: true }).waitFor();
  await assertNoOverflow(mobile.page);
  await screenshot(mobile.page, "mobile-preview.png");
  await mobile.context.close();

  const archivedImage = await rpc("archiveCmsMedia", { id: upload.id, expectedVersion: approved.version }, operatorCookie);
  assert.equal(archivedImage.result?.ok, true, JSON.stringify(archivedImage.error));
  assert.equal((await fetch(qaBase + upload.publicUrl)).status, 404);
  assert.ok(!(await publicPage("/ueber-uns")).html.includes(upload.publicUrl), "Revoked media disappears from public markup");
  const restoreImage = await rpc("restoreCmsRevisionAsDraft", { key: "about", revisionId: latest.draftRevisionId, expectedDraftRevisionId: latest.draftRevisionId }, operatorCookie);
  assert.match(restoreImage.error?.message ?? "", /nicht zur Veröffentlichung freigegeben|entfernt/, "Restore itself must reject revoked media");
  await desktop.page.reload({ waitUntil: "networkidle" });
  await desktop.page.getByLabel("Überschrift", { exact: true }).waitFor();
  const afterDeniedRestore = await selectAbout(desktop.page);
  assert.equal(afterDeniedRestore.draftRevisionId, latest.draftRevisionId, "Rejected restore must not change the draft pointer");
  assert.equal(afterDeniedRestore.publishedRevisionId, latest.publishedRevisionId, "Rejected restore must not change the publication pointer");
  assert.deepEqual(afterDeniedRestore.revisions, latest.revisions, "Rejected restore must not insert a revision");
  assert.equal((await fetch(qaBase + upload.publicUrl)).status, 404, "Rejected restore leaves media inaccessible");
  const republication = await rpc("publishCmsRevision", { key: "about", revisionId: latest.draftRevisionId, expectedDraftRevisionId: latest.draftRevisionId, expectedPublishedRevisionId: latest.publishedRevisionId }, operatorCookie);
  assert.match(republication.error?.message ?? "", /nicht zur Veröffentlichung freigegeben|entfernt/, "Publishing the current revision must also reject revoked media");
  report.checks.push("390px editing/preview stay within viewport; revoked images cannot be reactivated through history");
  await desktop.context.close();

  // Verify the home consumer separately, then restore its static fallback.
  const homeDraft = await rpc("saveCmsDraft", { key: "home", expectedDraftRevisionId: null, content: { ...emptyCmsContent(), title: "QA Home nur Entwurf", metaTitle: "QA Home Suchvorschau" } }, operatorCookie);
  assert.ok(homeDraft.result, JSON.stringify(homeDraft.error));
  home = homeDraft.result;
  assert.doesNotMatch((await publicPage("/")).html, /QA Home nur Entwurf/);
  const homePublished = await rpc("publishCmsRevision", { key: "home", revisionId: home.draftRevisionId, expectedDraftRevisionId: home.draftRevisionId, expectedPublishedRevisionId: home.publishedRevisionId }, operatorCookie);
  assert.ok(homePublished.result, JSON.stringify(homePublished.error));
  home = homePublished.result;
  const homeHtml = (await publicPage("/")).html;
  assert.match(homeHtml, /QA Home nur Entwurf/);
  assert.match(homeHtml, /QA Home Suchvorschau/);
  report.checks.push("Homepage title and metadata consume only the explicitly published revision");
  const after = await (await fetch(controlBase + "/evidence")).json();
  assert.deepEqual(after.tables, before.tables, "Studio changes must not change bookings, customers or messages");
  for (const key of ["mails", "whatsapp", "uploads", "objects", "blocked"]) assert.deepEqual(after[key], before[key], key);
  assert.deepEqual(report.blocked, []);
  assertBrowserDiagnostics(diagnostics);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack ?? String(error);
  process.exitCode = 1;
  for (const [index, context] of (browser?.contexts() ?? []).entries()) {
    const page = context.pages()[0];
    if (page) await screenshot(page, `failure-${index}.png`).catch((failure) => { report.screenshotError = failure.message; });
  }
} finally {
  for (const [key, document] of [["about", latest], ["home", home]]) {
    if (!document?.id || !operatorCookie) continue;
    try {
      const result = await rpc("archiveCmsDocument", { key, expectedDraftRevisionId: document.draftRevisionId, expectedPublishedRevisionId: document.publishedRevisionId }, operatorCookie);
      assert.ok(result.result && !result.error, JSON.stringify(result.error));
    } catch (error) {
      report.status = "failed";
      report.cleanupError = `${key}: ${error.message}`;
      process.exitCode = 1;
    }
  }
  if (report.status === "passed") {
    try {
      assert.equal((await publicPage("/ueber-uns")).response.status, 404);
      const restoredHome = (await publicPage("/")).html;
      assert.doesNotMatch(restoredHome, /QA Home nur Entwurf|href="\/ueber-uns"/);
      assert.doesNotMatch((await publicPage("/sitemap.xml")).html, /https:\/\/white-gloss\.de\/ueber-uns/);
      report.checks.push("QA publication withdrawn; original public fallbacks restored before subsequent checks");
    } catch (error) {
      report.status = "failed";
      report.cleanupError = error.message;
      process.exitCode = 1;
    }
  }
  report.diagnostics = diagnostics.map((item) => item.snapshot());
  try { await browser?.close(); }
  catch (error) { report.status = "failed"; report.browserCleanupError = error.message; process.exitCode = 1; }
  await writeFile(resolve(output, "results.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
