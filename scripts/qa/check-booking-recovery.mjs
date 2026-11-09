// Real form and RPC recovery, confined to the existing isolated Linux GitHub runner.
import { assertIsolatedGithubCi } from "../hosting-policy.mjs";
assertIsolatedGithubCi();
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { fromJSON } from "seroval";
import { chromium } from "playwright";
import { qaBase, controlBase } from "./ports.mjs";
import { qaClientHeaders } from "./client-identity.mjs";

const output = ".qa-output/booking-recovery";
await mkdir(output, { recursive: true });
const identity = await fetch(controlBase + "/identity", { signal: AbortSignal.timeout(5000) });
assert.equal(identity.headers.get("x-qa-run-id"), process.env.QA_RUN_ID);
assert.ok(process.env.QA_RUN_ID, "Recovery tests require the current isolated run identity");
assert.deepEqual(await identity.json(), {
  isolated: true, database: "in-memory-pglite", externalFetch: "blocked",
});

// Resolve the production-built RPC IDs instead of inventing transport endpoints.
const ids = {};
for (const file of await readdir(".output/server/_ssr")) {
  if (!/^bookings\.functions-/.test(file)) continue;
  const source = await readFile(".output/server/_ssr/" + file, "utf8");
  for (const match of source.matchAll(/id: "([a-f0-9]+)",\s*name: "(\w+)"/g))
    ids[match[2]] = match[1];
}
for (const name of ["createPublicBooking", "attachBookingPhotos"]) assert.ok(ids[name], name);
const createPath = "/_serverFn/" + ids.createPublicBooking;
const photoPath = "/_serverFn/" + ids.attachBookingPhotos;
const results = [];

async function evidence() {
  const response = await fetch(controlBase + "/evidence", { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  const state = await response.json();
  assert.equal(state.blocked.length, 0, "No provider request may escape the isolated sinks");
  return state;
}

async function control(flags) {
  const response = await fetch(controlBase + "/control", {
    method: "POST",
    headers: { "content-type": "application/json", "x-qa-run-id": process.env.QA_RUN_ID },
    body: JSON.stringify(flags), signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 200, "The isolated storage-failure control must succeed");
}

const sameId = (a, b) => String(a) === String(b);
const mailsTo = (state, email) => state.mails.filter((mail) => [mail.to].flat().includes(email));

async function settled(email) {
  const deadline = Date.now() + 10000;
  do {
    const state = await evidence();
    const booking = state.tables.bookings.find((row) => row.email === email);
    const queue = booking ? state.tables.outbound_queue.filter((row) => sameId(row.booking_id, booking.id)) : [];
    if (booking && queue.length && queue.every((row) => !["queued", "processing"].includes(row.status)))
      return state;
    await delay(100);
  } while (Date.now() < deadline);
  throw new Error("The synthetic booking's own notification queue did not settle");
}

async function assertOneRequest(email, reference) {
  const state = await settled(email);
  const bookings = state.tables.bookings.filter((row) => row.email === email);
  assert.equal(bookings.length, 1, "Recovery must retain one booking");
  assert.equal(reference, "WG-" + bookings[0].id);
  assert.equal(state.tables.customers.filter((row) => row.email === email).length, 1);
  assert.equal(state.tables.booking_events.filter((row) => sameId(row.booking_id, bookings[0].id)).length, 1);
  const customerQueue = state.tables.outbound_queue.filter((row) => row.to_addr === email);
  assert.equal(customerQueue.length, 1, "Recovery must not queue another customer email");
  assert.equal(customerQueue[0].status, "sent");
  assert.equal(mailsTo(state, email).length, 1, "The isolated provider sees one customer receipt");
  return { state, booking: bookings[0] };
}

// Two different real image bytes exercise per-file hashes and retries.
const files = [
  { name: "recovery-first.webp", mimeType: "image/webp", buffer: await readFile("public/media/hero-720.webp") },
  { name: "recovery-second.webp", mimeType: "image/webp", buffer: await readFile("public/media/finish-480.webp") },
];
assert.ok(!files[0].buffer.equals(files[1].buffer));
const browser = await chromium.launch({ headless: true });

async function scenario({ name, failAt, retry }) {
  const email = `recovery-${randomUUID()}@example.invalid`;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    serviceWorkers: "block", extraHTTPHeaders: qaClientHeaders("booking-ui", `recovery:${name}`),
  });
  const requests = { create: 0, photos: [] };
  const errors = [], expectedPhotoErrors = [], externalReads = new Set();
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push({ type: "pageerror", message: error.message }));
  page.on("crash", () => errors.push({ type: "crash" }));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location().url;
    // Only an explicitly forced photo failure or deliberately blocked remote read
    // may produce the browser's resource-error line. Other console errors fail.
    if (/^Failed to load resource\b/.test(message.text()) &&
        (externalReads.has(location) || location === qaBase + photoPath)) return;
    errors.push({ type: "console", message: message.text() });
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    if (new URL(response.url()).pathname === photoPath) expectedPhotoErrors.push(response.status());
    else errors.push({ type: "http", path: new URL(response.url()).pathname, status: response.status() });
  });
  await context.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    const read = ["GET", "HEAD"].includes(request.method());
    if (url.origin !== qaBase) {
      if (read) externalReads.add(request.url());
      else errors.push({ type: "external-write", method: request.method(), origin: url.origin });
      return route.abort();
    }
    if (read) return route.continue();
    if (request.method() !== "POST" || ![createPath, photoPath].includes(url.pathname)) {
      errors.push({ type: "unexpected-write", path: url.pathname });
      return route.abort();
    }
    if (url.pathname === createPath) requests.create++;
    else {
      const payload = fromJSON(JSON.parse(request.postData()));
      requests.photos.push({ reference: payload.data.vorgang, names: payload.data.files.map((file) => file.name) });
    }
    return route.continue();
  });
  try {
    const before = await evidence();
    assert.equal(before.failStorage, false);
    assert.equal(before.failStorageAt, 0);
    assert.equal(before.failMail, false);
    assert.equal(before.failWhatsApp, false);
    assert.equal(before.tables.bookings.filter((row) => row.email === email).length, 0);
    await page.goto(qaBase + "/#buchung", { waitUntil: "networkidle" });
    const reject = page.getByRole("button", { name: "Ablehnen", exact: true });
    if (await reject.isVisible().catch(() => false)) await reject.click();
    await page.locator("form.booking-flow").waitFor();
    await page.locator(".booking-steps button").nth(2).click();
    for (const [id, value] of Object.entries({
      name: "Synthetic recovery customer", phone: "+490000000099", email,
      street: "Musterweg 1", postalCode: "72160", town: "Horb am Neckar",
    })) await page.locator("#" + id).fill(value);
    await page.locator("#privacy").check();
    await page.locator('section[aria-label="Optionale Fahrzeugfotos"] input[type="file"]').first().setInputFiles(files);
    await control({ failStorageNth: failAt });
    // Two click events in one turn also test the synchronous submit lock before
    // React can replace the enabled button with its pending rendering.
    await page.locator('form.booking-flow button[type="submit"]').evaluate((button) => { button.click(); button.click(); });
    const alert = page.locator('form.booking-flow [role="alert"]');
    await alert.filter({ hasText: /WG-\d+/ }).waitFor({ state: "visible" });
    const reference = (await alert.allTextContents()).join(" ").match(/WG-\d+/)?.[0];
    assert.ok(reference);
    assert.equal(await page.getByRole("button", { name: "Neue Anfrage beginnen", exact: true }).count(), 0);
    assert.equal(requests.create, 1);
    assert.equal(requests.photos.length, failAt);
    assert.ok(requests.photos.every((request) => request.reference === reference));
    let saved = await assertOneRequest(email, reference);
    const photos = saved.state.tables.booking_photos.filter((row) => sameId(row.booking_id, saved.booking.id));
    assert.equal(photos.filter((row) => row.upload_state === "ready").length, failAt - 1);
    assert.equal(photos.filter((row) => row.upload_state === "failed").length, 1);
    assert.equal(saved.state.storageAttempts - before.storageAttempts, failAt);
    await page.screenshot({ path: `${output}/${name}-failure-390.png`, fullPage: true });

    await control({ failStorageNth: 0 });
    const continuation = retry
      ? page.getByRole("button", { name: "Übrige Fotos erneut senden", exact: true })
      : page.getByRole("button", { name: "Fotos später nachreichen", exact: true });
    await continuation.evaluate((button) => { button.click(); button.click(); });
    await page.waitForURL((url) => url.pathname === "/danke" && url.searchParams.get("vorgang") === reference);
    await page.getByRole("heading", { name: "Fahrzeugfotos nachreichen", exact: true }).waitFor();
    saved = await assertOneRequest(email, reference);
    assert.equal(requests.create, 1, "Neither retry nor skipping creates a second booking");
    assert.ok(requests.photos.every((request) => request.reference === reference));
    if (retry) {
      assert.deepEqual(requests.photos.map((request) => request.names), [
        [files[0].name], [files[1].name], [files[1].name],
      ], "Retry sends only the file whose first upload failed");
      assert.equal(saved.state.tables.booking_photos.filter((row) => sameId(row.booking_id, saved.booking.id) && row.upload_state === "ready").length, 2);
      assert.equal(saved.state.uploads.length - before.uploads.length, 2);
      assert.equal(saved.state.storageAttempts - before.storageAttempts, 3);
    } else {
      assert.equal(requests.photos.length, 1, "Skipping uploads does not retry or create a new request");
      assert.equal(saved.state.uploads.length - before.uploads.length, 0);
      assert.equal(saved.state.storageAttempts - before.storageAttempts, 1);
    }
    assert.ok(expectedPhotoErrors.length <= 1, "Only the deliberately forced photo call may fail");
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${output}/${name}-thanks-390.png`, fullPage: true });
    results.push({ scenario: name, passed: true, createRequests: requests.create, photoRequests: requests.photos.length, customerEmails: mailsTo(saved.state, email).length, expectedPhotoErrors });
  } finally {
    await control({ failStorageNth: 0 });
    await context.close();
  }
}

try {
  await scenario({ name: "second-file-retry", failAt: 2, retry: true });
  await scenario({ name: "first-file-skip", failAt: 1, retry: false });
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify({ results }, null, 2));
}
console.log(JSON.stringify({ passed: results.length, results }, null, 2));
