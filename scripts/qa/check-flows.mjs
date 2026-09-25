import { qaBase, controlBase } from "./ports.mjs";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { toJSONAsync, fromCrossJSON } from "seroval";
import { defaultSerovalPlugins } from "@tanstack/router-core";
const base = qaBase;
const identity = await fetch(controlBase + "/identity");
const qaRunId = identity.headers.get("x-qa-run-id");
assert.ok(qaRunId, "The isolated server must identify this QA run.");
assert.deepEqual(
  await identity.json(),
  { isolated: true, database: "in-memory-pglite", externalFetch: "blocked" },
  "Start the isolated QA server before running these mutations.",
);
const ids = {};
for (const file of await readdir(".output/server/_ssr")) {
  if (!/^(bookings|admin)\.functions-/.test(file)) continue;
  const source = await readFile(".output/server/_ssr/" + file, "utf8");
  for (const match of source.matchAll(/id: "([a-f0-9]+)",\s*name: "(\w+)"/g))
    ids[match[2]] = match[1];
}
let requestId = 10;
async function rpc(name, data, cookie = "") {
  assert.ok(ids[name], name);
  const response = await fetch(`${base}/_serverFn/${ids[name]}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tsr-serverFn": "true",
      "sec-fetch-site": "same-origin",
      "x-forwarded-for": `127.0.0.${requestId++}`,
      // Same TLS-termination contract as Caddy -> Node in production.
      "x-forwarded-proto": "https",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(await toJSONAsync({ data })),
  });
  const body = fromCrossJSON(await response.json(), { plugins: defaultSerovalPlugins });
  return {
    body,
    cookie: response.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; "),
    cookieAttributes: response.headers.getSetCookie().map((v) => v.slice(v.indexOf(";"))),
  };
}
// The committed booking returns before its background delivery pass finishes.
// Future reminders and retry backoff are settled; due work and active leases are not.
async function evidence() {
  const signal = AbortSignal.timeout(10_000);
  let pending = [];
  try {
    for (;;) {
      const response = await fetch(controlBase + "/evidence", { signal });
      assert.equal(response.status, 200, "Local QA evidence is unavailable");
      const snapshot = await response.json();
      assert.equal(
        snapshot.blocked.length,
        0,
        "An external request escaped the isolated provider stubs",
      );
      pending = snapshot.tables.outbound_queue.filter((row) => {
        if (row.status === "processing") return true;
        if (row.status !== "queued") return false;
        const next = Date.parse(row.next_attempt_at);
        return !Number.isFinite(next) || next <= Date.now();
      });
      if (pending.length === 0) return snapshot;
      await delay(100, undefined, { signal });
    }
  } catch (error) {
    if (signal.aborted) {
      throw new Error(
        `Local notifications did not settle within 10 seconds: ${pending.map((row) => `${row.id}:${row.status}`).join(", ")}`,
      );
    }
    throw error;
  }
}
const control = (flags) =>
  fetch(controlBase + "/control", {
    method: "POST",
    headers: { "x-qa-run-id": qaRunId },
    body: JSON.stringify(flags),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(
        `Local QA control failed (${response.status}): ${(await response.text()).slice(0, 500)}`,
      );
    }
    return response;
  });
const results = [];
const input = {
  idempotencyKey: randomUUID(),
  name: "QA Integration",
  phone: "+490000000010",
  email: "qa@example.invalid",
  date: "",
  slot: "",
  note: "Isolierter Test",
  packageId: "premium",
  classId: "kompakt",
  extraIds: [],
  citySlug: "horb-am-neckar",
  kind: "booking",
  privacy: true,
  website: "",
};
const booking = await rpc("createPublicBooking", input);
assert.ok(booking.body.result?.reference, JSON.stringify(booking.body));
assert.equal(booking.body.result.confirmed, false);
assert.match(booking.cookieAttributes.join(""), /HttpOnly/i);
assert.match(booking.cookieAttributes.join(""), /SameSite=Strict/i);
assert.match(booking.cookieAttributes.join(""), /; Secure(?:;|$)/i);
assert.match(booking.cookie, /^__Host-wg-upload-/);
let state = await evidence();
assert.equal(state.tables.bookings.at(-1).total_cents, 34900);
assert.equal(state.tables.bookings.at(-1).status, "neu");
assert.equal(state.mails.length, 2);
assert.equal(state.whatsapp.length, 1);
results.push(
  "Booking stays pending; persistence, inbox, owner WhatsApp and captured email; proxied HTTPS secure upload cookie",
);
const duplicate = await rpc("createPublicBooking", input);
assert.equal(duplicate.body.result?.id, booking.body.result.id);
assert.ok(duplicate.cookie === booking.cookie, "A retry must recover the same upload cookie");
state = await evidence();
assert.equal(state.tables.bookings.length, 1);
assert.equal(state.tables.customers.length, 1);
assert.equal(state.tables.booking_events.length, 1);
assert.equal(state.mails.length, 2);
assert.equal(state.whatsapp.length, 1);
results.push(
  "Same request UUID is idempotent across response loss: one booking, customer, event and notification set; same upload capability",
);
const changedReplay = await rpc("createPublicBooking", { ...input, name: "Changed request" });
assert.ok(changedReplay.body.error, "Reusing a UUID with changed data must fail");
assert.equal((await evidence()).tables.bookings.length, 1);
results.push("Reused UUID with different booking data is rejected");
const file = {
  name: "fahrzeug.webp",
  mime: "image/webp",
  base64: (await readFile("public/media/hero-720.webp")).toString("base64"),
};
const payload = { vorgang: booking.body.result.reference, files: [file] };
const denied = await rpc("attachBookingPhotos", payload);
assert.ok(denied.body.error);
assert.equal((await evidence()).uploads.length, 0);
results.push("Upload without booking cookie rejected before storage");
const invalid = await rpc(
  "attachBookingPhotos",
  {
    ...payload,
    files: [file, { name: "invalid.webp", mime: "image/webp", base64: "aW52YWxpZA==" }],
  },
  booking.cookie,
);
assert.ok(invalid.body.error);
assert.equal((await evidence()).uploads.length, 0);
results.push("Invalid second file rejects entire batch before first write");
await control({ failStorage: true });
const failed = await rpc("attachBookingPhotos", payload, booking.cookie);
assert.ok(failed.body.error);
assert.equal(
  (await evidence()).tables.booking_photos.filter((row) => row.upload_state === "failed").length,
  1,
);
await control({ failStorage: false });
const uploaded = await rpc("attachBookingPhotos", payload, booking.cookie);
assert.equal(uploaded.body.result?.count, 1);
state = await evidence();
assert.equal(state.uploads.length, 1);
assert.equal(state.tables.booking_photos.length, 1);
results.push("Storage failure reported; retry succeeds and persists exactly one photo");
await control({ failStorageNth: 1 });
const partial = await rpc(
  "attachBookingPhotos",
  {
    ...payload,
    files: [
      file,
      {
        ...file,
        name: "zweites-fahrzeug.webp",
        base64: Buffer.concat([Buffer.from(file.base64, "base64"), Buffer.from([1])]).toString(
          "base64",
        ),
      },
    ],
  },
  booking.cookie,
);
assert.ok(partial.body.error);
state = await evidence();
assert.equal(state.objects.length, 1);
assert.equal(state.tables.booking_photos.length, 2);
assert.equal(state.tables.booking_photos.filter((row) => row.upload_state === "ready").length, 1);
assert.equal(state.tables.booking_photos.filter((row) => row.upload_state === "failed").length, 1);
await control({ failStorageNth: 0 });
results.push("Retry deduplicates earlier files and preserves a recoverable failed reservation");
const photo = await rpc("createPublicPhotoInquiry", {
  requestId: randomUUID(),
  title: "Begutachtung Dellen",
  name: "QA Fotoanfrage",
  phone: "+490000000011",
  text: "Delle links",
  files: [file],
  privacy: true,
  website: "",
});
assert.equal(photo.body.result?.ok, true);
state = await evidence();
assert.equal(state.objects.length, 2);
const inquiry = state.tables.bookings.find((row) => row.package_id === "photo-inquiry");
assert.ok(inquiry, "Photo inquiries must be durable orders for Bitrix24");
assert.ok(
  state.tables.booking_photos.some(
    (row) => row.booking_id === inquiry.id && row.upload_state === "ready",
  ),
);
results.push("Photo inquiry persists an order and usable photo for Bitrix24");
await control({ failMail: true, failWhatsApp: true });
const future = new Date();
future.setUTCDate(future.getUTCDate() + 14);
while (future.getUTCDay() === 0 || future.getUTCDay() === 6)
  future.setUTCDate(future.getUTCDate() + 1);
const booking2 = await rpc("createPublicBooking", {
  ...input,
  idempotencyKey: randomUUID(),
  name: "QA Mailfehler",
  phone: "+490000000012",
  date: future.toISOString().slice(0, 10),
  slot: "09:00",
});
assert.equal(booking2.body.result?.confirmed, false, JSON.stringify(booking2.body));
state = await evidence();
await control({ failMail: false, failWhatsApp: false });
const queuedAfterFailure = state.tables.outbound_queue.filter(
  (row) => row.booking_id === booking2.body.result.id,
);
assert.equal(queuedAfterFailure.length, 3);
assert.ok(
  queuedAfterFailure.every(
    (row) => row.status === "queued" && row.attempt_count === 1 && row.last_error_code,
  ),
);
assert.ok(queuedAfterFailure.every((row) => new Date(row.next_attempt_at).getTime() > Date.now()));
assert.equal(state.tables.bookings.find((row) => row.id === booking2.body.result.id).status, "neu");
results.push(
  "Free weekday remains pending; mail/WhatsApp failures keep booking durable and schedule bounded retries with backoff",
);
const foreign = await rpc(
  "attachBookingPhotos",
  { ...payload, vorgang: booking2.body.result.reference },
  booking.cookie,
);
assert.ok(foreign.body.error);
assert.equal((await evidence()).objects.length, 2);
results.push("Cookie for another booking cannot authorize upload");

const secondRequest = {
  ...input,
  idempotencyKey: randomUUID(),
  name: "QA Gleicher Wunschtermin",
  phone: "+490000000013",
  date: future.toISOString().slice(0, 10),
  slot: "09:00",
};
const booking3 = await rpc("createPublicBooking", secondRequest);
assert.equal(booking3.body.result?.confirmed, false, JSON.stringify(booking3.body));
state = await evidence();
for (const id of [booking2.body.result.id, booking3.body.result.id]) {
  assert.equal(state.tables.bookings.find((row) => row.id === id).status, "neu");
}
results.push(
  "Different UUIDs for the same desired appointment are both recorded as pending requests",
);

const id2 = booking2.body.result.id;
const id3 = booking3.body.result.id;
// The former website CRM cannot be used to bypass Bitrix24 decisions.
for (const name of [
  "confirmBooking",
  "updateBookingStatus",
  "updateBookingDetails",
  "createManualBooking",
  "runAgentCommand",
  "sendQontoInvoice",
])
  assert.equal(ids[name], undefined, name + " must not be published");
for (const route of ["/api/ro-callback", "/api/zoho-webhook", "/api/hub", "/api/operator"])
  assert.equal((await fetch(base + route, { method: "POST", body: "{}" })).status, 410, route);
assert.equal(
  (await fetch(base + "/api/bitrix-workshop", { method: "POST", body: "{}" })).status,
  410,
);
results.push(
  "Legacy CRM actions are absent, legacy callbacks return 410, the retired app bridge returns 410",
);

await control({ retryBookingId: id2 });
const cron = await fetch(base + "/api/automation-cron", {
  method: "POST",
  headers: { authorization: "Bearer isolated-qa-cron-secret-32-characters" },
});
assert.equal(cron.status, 200);
state = await evidence();
assert.ok(
  state.tables.outbound_queue
    .filter((row) => row.booking_id === id2)
    .every((row) => row.status === "sent" && row.attempt_count === 2),
);
assert.equal(state.tables.bookings.find((row) => row.id === id2).status, "neu");
results.push("Authenticated cron recovers queued delivery once without confirming the booking");

const deliveredMessage = state.tables.outbound_queue.find(
  (row) => row.channel === "whatsapp" && row.provider_message_id,
);
const receipt = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "000000000000",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: "000000000000" },
            statuses: [
              {
                id: deliveredMessage.provider_message_id,
                status: "delivered",
                timestamp: String(Math.floor(Date.now() / 1000)),
                recipient_id: "490000000000",
              },
            ],
            messages: [{ text: { body: `bestätige ${id3}` } }],
          },
        },
      ],
    },
  ],
});
const signature = `sha256=${createHmac("sha256", "isolated-qa-not-an-app-secret").update(receipt).digest("hex")}`;
const webhook = (signed) =>
  fetch(`${base}/api/whatsapp-webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signed ? { "x-hub-signature-256": signature } : {}),
    },
    body: receipt,
  });
assert.equal((await webhook(false)).status, 403);
assert.equal((await webhook(true)).status, 200);
const afterWebhook = await evidence();
assert.equal(
  afterWebhook.tables.outbound_queue.find((row) => row.id === deliveredMessage.id).delivery_status,
  "delivered",
);
assert.equal((await webhook(true)).status, 200);
state = await evidence();
assert.equal(state.webhookReceiptCount, 1);
assert.equal(state.mails.length, afterWebhook.mails.length);
assert.equal(state.whatsapp.length, afterWebhook.whatsapp.length);
assert.equal(state.tables.bookings.find((row) => row.id === id3).status, "neu");
results.push(
  "Signed WhatsApp receipts are idempotent; missing signature fails and incoming chat text never confirms bookings",
);
assert.equal(state.blocked.length, 0);
await writeFile(
  ".qa-output/flow-results.json",
  JSON.stringify({ passed: results.length, results }, null, 2),
);
console.log(JSON.stringify({ passed: results.length, results }, null, 2));
