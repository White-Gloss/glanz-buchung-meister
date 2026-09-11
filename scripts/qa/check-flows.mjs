import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { toJSONAsync, fromCrossJSON } from "seroval";
import { defaultSerovalPlugins } from "@tanstack/router-core";
const base = "http://127.0.0.1:8082";
const identity = await fetch("http://127.0.0.1:8099/identity");
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
      const response = await fetch("http://127.0.0.1:8099/evidence", { signal });
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
  fetch("http://127.0.0.1:8099/control", {
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
  title: "Begutachtung Dellen",
  name: "QA Fotoanfrage",
  phone: "+490000000011",
  text: "Delle links",
  files: ["fahrzeug.webp"],
  privacy: true,
  website: "",
});
assert.equal(photo.body.result?.ok, true);
state = await evidence();
assert.equal(state.objects.length, 1);
assert.ok(
  state.tables.inbox_messages.some(
    (r) => r.channel === "dellen" && r.body.includes("fahrzeug.webp"),
  ),
);
results.push("Photo inquiry persists description/filenames without uploading bytes");
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
assert.equal((await evidence()).objects.length, 1);
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
const mutation = { id: id2, expectedVersion: 1 };
assert.ok((await rpc("confirmBooking", mutation)).body.error, "Anonymous confirmation must fail");
async function session(role) {
  const fixture = await (await control({ createSession: role })).json();
  const response = await fetch(`${base}/api/auth/get-session`, {
    headers: { cookie: fixture.cookie, "x-forwarded-proto": "https" },
  });
  assert.equal(response.status, 200, "Better Auth session lookup failed");
  const body = await response.json();
  assert.ok(
    body?.user?.id === fixture.userId,
    `Better Auth must verify the ${role} fixture session`,
  );
  return fixture;
}
const owner = await session("owner");
const operator = await session("operator");
const outsider = await session("outsider");
const operatorDenial = await rpc("confirmBooking", mutation, operator.cookie);
assert.match(operatorDenial.body.error?.message ?? "", /Inhaber/);
assert.ok((await rpc("confirmBooking", mutation, outsider.cookie)).body.error);
assert.ok(
  (await rpc("updateBookingStatus", { ...mutation, status: "bestaetigt" }, owner.cookie)).body
    .error,
);
assert.equal((await evidence()).tables.bookings.find((row) => row.id === id2).status, "neu");
results.push(
  "Real Better Auth sessions enforce owner-only confirmation; anonymous, other operator, outsider and generic-status bypass fail",
);

await control({ retryBookingId: id2 });
const deliveryRetry = await rpc("flushOutboundMail", undefined, operator.cookie);
assert.ok(deliveryRetry.body.result, JSON.stringify(deliveryRetry.body));
state = await evidence();
assert.ok(
  state.tables.outbound_queue
    .filter((row) => row.booking_id === id2)
    .every((row) => row.status === "sent" && row.attempt_count === 2),
);
assert.equal(state.tables.bookings.find((row) => row.id === id2).status, "neu");
results.push(
  "Retry worker sends recovered provider messages exactly from the existing outbox and never confirms a booking",
);

const approved = await rpc("confirmBooking", mutation, owner.cookie);
assert.equal(approved.body.result?.ok, true, JSON.stringify(approved.body));
state = await evidence();
let current = state.tables.bookings.find((row) => row.id === id2);
assert.equal(current.status, "bestaetigt");
assert.equal(current.version, 2);
assert.equal(current.confirmed_by, owner.userId);
assert.ok(current.confirmed_at);
const sentAfterApproval = { mail: state.mails.length, whatsapp: state.whatsapp.length };
assert.equal((await rpc("confirmBooking", mutation, owner.cookie)).body.result?.ok, true);
state = await evidence();
assert.equal(
  state.tables.booking_events.filter(
    (row) => row.booking_id === id2 && row.event === "booking.confirmed",
  ).length,
  1,
);
assert.equal(state.mails.length, sentAfterApproval.mail);
assert.equal(state.whatsapp.length, sentAfterApproval.whatsapp);
const conflicting = await rpc("confirmBooking", { id: id3, expectedVersion: 1 }, owner.cookie);
assert.ok(conflicting.body.error, "A second booking at the occupied time must fail");
assert.equal((await evidence()).tables.bookings.find((row) => row.id === id3).status, "neu");
results.push(
  "Owner confirmation records actor/time/version once; retry is idempotent and conflicting confirmation leaves the other request pending",
);

const movedDate = new Date(future);
movedDate.setUTCDate(movedDate.getUTCDate() + 7);
const edit = {
  id: id2,
  expectedVersion: 2,
  name: "QA Umbuchung",
  phone: "+490000000012",
  email: input.email,
  date: movedDate.toISOString().slice(0, 10),
  slot: "11:00",
  packageId: input.packageId,
  classId: input.classId,
  extraIds: [],
  citySlug: input.citySlug,
  note: "Persönlich abgestimmte Umbuchung",
};
const changed = await rpc("updateBookingDetails", edit, operator.cookie);
assert.equal(changed.body.result?.ok, true, JSON.stringify(changed.body));
state = await evidence();
current = state.tables.bookings.find((row) => row.id === id2);
assert.equal(current.status, "neu");
assert.equal(current.version, 3);
assert.equal(current.confirmed_at, null);
assert.equal(current.confirmed_by, null);
assert.ok(
  !state.tables.outbound_queue.some(
    (row) =>
      row.booking_id === id2 && row.event_type === "booking.reminder" && ["queued", "processing"].includes(row.status),
  ),
);
assert.ok(
  (await rpc("updateBookingDetails", { ...edit, note: "Veralteter Versuch" }, operator.cookie)).body
    .error,
);
assert.equal((await evidence()).tables.bookings.find((row) => row.id === id2).version, 3);
assert.equal(
  (await rpc("confirmBooking", { id: id2, expectedVersion: 3 }, owner.cookie)).body.result?.ok,
  true,
);
results.push(
  "Rescheduling invalidates confirmation/reminders, rejects stale edits and requires a fresh explicit owner confirmation",
);

assert.equal(
  (
    await rpc(
      "updateBookingStatus",
      { id: id3, expectedVersion: 1, status: "abgelehnt" },
      operator.cookie,
    )
  ).body.result?.ok,
  true,
);
assert.equal(
  (
    await rpc(
      "updateBookingStatus",
      { id: id3, expectedVersion: 1, status: "abgelehnt" },
      operator.cookie,
    )
  ).body.result?.ok,
  true,
);
assert.equal(
  (
    await rpc(
      "updateBookingStatus",
      { id: id2, expectedVersion: 4, status: "storniert" },
      operator.cookie,
    )
  ).body.result?.ok,
  true,
);
state = await evidence();
current = state.tables.bookings.find((row) => row.id === id2);
assert.equal(current.status, "storniert");
assert.ok(current.cancelled_at);
assert.equal(current.version, 5);
assert.equal(state.tables.bookings.find((row) => row.id === id3).status, "abgelehnt");
assert.equal(
  state.tables.booking_events.filter(
    (row) => row.booking_id === id3 && row.event === "booking.rejected",
  ).length,
  1,
);
assert.deepEqual(
  state.tables.booking_events.filter((row) => row.booking_id === id2).map((row) => row.event),
  [
    "booking.created",
    "booking.confirmed",
    "booking.rescheduled",
    "booking.confirmed",
    "booking.cancelled",
  ],
);
results.push(
  "Authenticated rejection/cancellation keep their audit history; repeated rejection produces no duplicate event",
);

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
assert.equal(state.tables.bookings.find((row) => row.id === id3).status, "abgelehnt");
results.push(
  "Signed WhatsApp receipts are idempotent; missing signature fails and incoming chat text never confirms bookings",
);
const manual = {
  ...input,
  idempotencyKey: randomUUID(),
  name: "QA Telefonbuchung",
  notifyCustomer: false,
};
assert.ok((await rpc("createManualBooking", manual)).body.error, "Anonymous creation must fail");
assert.ok(
  (await rpc("createManualBooking", manual, outsider.cookie)).body.error,
  "Non-operators cannot create manual bookings",
);
const added = await rpc("createManualBooking", manual, operator.cookie);
assert.ok(added.body.result?.id, JSON.stringify(added.body));
assert.equal(added.body.result.confirmed, false);
const manualId = added.body.result.id;
assert.equal((await rpc("createManualBooking", manual, operator.cookie)).body.result?.id, manualId);
state = await evidence();
assert.equal(state.tables.bookings.filter((row) => row.id === manualId).length, 1);
assert.equal(state.tables.bookings.find((row) => row.id === manualId).status, "neu");
assert.equal(
  state.tables.booking_events.find((row) => row.booking_id === manualId).actor,
  operator.userId,
);
assert.equal(
  state.tables.outbound_queue.filter(
    (row) => row.booking_id === manualId && row.to_addr === manual.email,
  ).length,
  0,
);
const withEmail = await rpc(
  "createManualBooking",
  { ...manual, idempotencyKey: randomUUID(), notifyCustomer: true },
  owner.cookie,
);
assert.ok(withEmail.body.result?.id);
state = await evidence();
const manualMail = state.tables.outbound_queue.find(
  (row) => row.booking_id === withEmail.body.result.id && row.to_addr === manual.email,
);
assert.ok(manualMail, "Explicit opt-in creates a customer notification through Resend");
assert.deepEqual(manualMail.attachments, [], "No competing locally generated accounting PDF");
results.push(
  "Manual bookings require an operator, record the real actor, remain unconfirmed and notify the customer only on opt-in; retries do not duplicate bookings",
);
assert.equal(state.blocked.length, 0);
await writeFile(
  ".qa-output/flow-results.json",
  JSON.stringify({ passed: results.length, results }, null, 2),
);
console.log(JSON.stringify({ passed: results.length, results }, null, 2));
