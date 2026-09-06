import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { toJSONAsync, fromCrossJSON } from "seroval";
import { defaultSerovalPlugins } from "@tanstack/router-core";
const base = "http://127.0.0.1:8082";
assert.deepEqual(
  await fetch("http://127.0.0.1:8099/identity").then((r) => r.json()),
  { isolated: true, database: "in-memory-pglite", externalFetch: "blocked" },
  "Start the isolated QA server before running these mutations.",
);
const ids = {};
for (const file of await readdir(".output/server/_ssr")) {
  if (!file.startsWith("bookings.functions-")) continue;
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
const evidence = () => fetch("http://127.0.0.1:8099/evidence").then((r) => r.json());
const control = (flags) =>
  fetch("http://127.0.0.1:8099/control", { method: "POST", body: JSON.stringify(flags) });
const results = [];
const input = {
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
let state = await evidence();
assert.equal(state.tables.bookings.at(-1).total_cents, 34900);
assert.equal(state.mails.length, 2);
results.push("Booking → persistence → inbox → captured email → reference; HttpOnly/Strict cookie");
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
assert.equal((await evidence()).tables.booking_photos.length, 0);
await control({ failStorage: false });
const uploaded = await rpc("attachBookingPhotos", payload, booking.cookie);
assert.equal(uploaded.body.result?.count, 1);
state = await evidence();
assert.equal(state.uploads.length, 1);
assert.equal(state.tables.booking_photos.length, 1);
results.push("Storage failure reported; retry succeeds and persists exactly one photo");
await control({ failStorageNth: 2 });
const partial = await rpc(
  "attachBookingPhotos",
  { ...payload, files: [file, { ...file, name: "zweites-fahrzeug.webp" }] },
  booking.cookie,
);
assert.ok(partial.body.error);
state = await evidence();
assert.equal(state.objects.length, 1);
assert.equal(state.tables.booking_photos.length, 1);
assert.equal(state.deletions.at(-1).length, 2);
await control({ failStorageNth: 0 });
results.push(
  "Second storage failure compensates exact batch objects/metadata; earlier upload survives",
);
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
await control({ failMail: true });
const future = new Date();
future.setUTCDate(future.getUTCDate() + 14);
while (future.getUTCDay() === 0 || future.getUTCDay() === 6)
  future.setUTCDate(future.getUTCDate() + 1);
const booking2 = await rpc("createPublicBooking", {
  ...input,
  name: "QA Mailfehler",
  phone: "+490000000012",
  date: future.toISOString().slice(0, 10),
  slot: "09:00",
});
assert.equal(booking2.body.result?.confirmed, true, JSON.stringify(booking2.body));
await control({ failMail: false });
state = await evidence();
assert.ok(state.tables.outbound_queue.some((r) => r.status === "failed"));
results.push(
  "Free weekday confirms appointment; mail-provider failure does not duplicate/reject saved booking",
);
const foreign = await rpc(
  "attachBookingPhotos",
  { ...payload, vorgang: booking2.body.result.reference },
  booking.cookie,
);
assert.ok(foreign.body.error);
assert.equal((await evidence()).objects.length, 1);
results.push("Cookie for another booking cannot authorize upload");
assert.equal(state.blocked.length, 0);
await writeFile(
  ".qa-output/flow-results.json",
  JSON.stringify({ passed: results.length, results }, null, 2),
);
console.log(JSON.stringify({ passed: results.length, results }, null, 2));
