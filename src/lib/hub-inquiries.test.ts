import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { handleHubInquiries } from "./hub-inquiries.ts";
import { saveBookingRequest } from "./booking-workflow.ts";
import { createRequestUploadCapability } from "./booking-upload-capability.ts";
import type { PublicBookingInput } from "./booking-schema.ts";
import { quoteTotal } from "../data/site.ts";

// Test-only value; the real token exists only in the server environment.
const TOKEN = "hub-test-only-" + "t".repeat(40);
const KEYS = [
  "id",
  "customer_name",
  "phone",
  "email",
  "vehicle",
  "package_id",
  "class_id",
  "extra_ids",
  "city_slug",
  "note",
  "total_cents",
  "pickup_cents",
  "preferred_date",
  "preferred_slot",
  "address",
  "review_email_consent",
].sort();

function wrap(pg: Pick<PGlite, "query">, transaction?: Sql["transaction"]): Sql {
  const sql = (async (strings: TemplateStringsArray, ...args: unknown[]) => {
    const text = strings.reduce((s, part, i) => s + (i ? `$${i}` : "") + part, "");
    return (await pg.query(text, args)).rows;
  }) as Sql;
  sql.query = async <T>(text: string, args: unknown[] = []) => (await pg.query<T>(text, args)).rows;
  sql.transaction = transaction ?? ((fn) => fn(sql));
  return sql;
}

async function database() {
  const pg = new PGlite({ parsers: { 1082: (v) => v, 20: Number } });
  for (const f of (await readdir("migrations")).filter((f) => f.endsWith(".sql")).sort())
    await pg.exec(await readFile(`migrations/${f}`, "utf8"));
  return wrap(pg, (fn) => pg.transaction((tx) => fn(wrap(tx))));
}

function form(overrides: Partial<PublicBookingInput> = {}): PublicBookingInput {
  return {
    idempotencyKey: randomUUID(),
    name: "Max Mustermann",
    phone: "+49 7451 000000",
    email: "max@example.invalid",
    street: "Musterstraße 1",
    postalCode: "72202",
    town: "Nagold",
    date: "2999-10-12",
    slot: "09:00",
    note: "Abholung gewünscht",
    packageId: "premium",
    classId: "suv",
    extraIds: ["felgen", "ozon"],
    citySlug: "nagold",
    kind: "booking",
    vehicleMake: "VW",
    vehicleModel: "Golf",
    privacy: true,
    ...overrides,
  };
}

async function book(sql: Sql, data = form()) {
  return (await saveBookingRequest(sql, data, createRequestUploadCapability(data.idempotencyKey)))
    .booking;
}

function call(
  sql: Sql | null,
  init: { method?: string; auth?: string | null; body?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };
  const auth = init.auth === undefined ? `Bearer ${TOKEN}` : init.auth;
  if (auth !== null) headers.authorization = auth;
  const method = init.method ?? "POST";
  return handleHubInquiries(
    new Request("https://white-gloss.de/api/hub", {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : (init.body ?? '{"action":"list"}'),
    }),
    async () => {
      if (!sql) throw new Error("database must not be touched");
      return sql;
    },
  );
}

async function list(sql: Sql) {
  const response = await call(sql);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  return (await response.json()) as { inquiries: Record<string, unknown>[] };
}

test("hub route: configuration, auth, method and action gates", async () => {
  delete process.env.HUB_SYNC_TOKEN;
  let response = await call(null);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "not_configured" });

  process.env.HUB_SYNC_TOKEN = "x".repeat(31);
  response = await call(null, { auth: `Bearer ${"x".repeat(31)}` });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "not_configured" });

  process.env.HUB_SYNC_TOKEN = TOKEN;
  for (const auth of [
    null,
    "",
    "Bearer",
    `Bearer ${TOKEN}x`,
    `Basic ${TOKEN}`,
    TOKEN,
    "Bearer wrong",
  ]) {
    response = await call(null, { auth });
    assert.equal(response.status, 401, String(auth));
    const body = await response.text();
    assert.equal(body, '{"error":"unauthorized"}');
    assert.ok(!body.includes(TOKEN));
  }

  for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
    response = await call(null, { method });
    assert.equal(response.status, 405, method);
    assert.equal(await response.text(), "");
  }

  for (const body of ['{"action":"sync"}', "{}", "[]", "null", "not json", '{"action":"LIST"}'])
    assert.equal((await call(null, { body })).status, 400, body);
  assert.deepEqual(await (await call(null, { body: "{}" })).json(), { error: "bad_request" });
});

test("hub route: empty list is success; real form bookings map exactly", async () => {
  process.env.HUB_SYNC_TOKEN = TOKEN;
  const sql = await database();
  assert.deepEqual(await list(sql), { inquiries: [] });

  const booking = await book(sql);
  const expected = quoteTotal({
    packageId: "premium",
    classId: "suv",
    extraIds: ["felgen", "ozon"],
    citySlug: "nagold",
  });
  const first = await list(sql);
  assert.equal(first.inquiries.length, 1);
  const [row] = first.inquiries;
  assert.deepEqual(Object.keys(row).sort(), KEYS);
  for (const value of Object.values(row)) assert.notEqual(value, null);
  assert.equal(row.id, booking.id);
  assert.ok(Number.isSafeInteger(row.id) && (row.id as number) > 0);
  assert.equal(row.customer_name, "Max Mustermann");
  assert.equal(row.vehicle, "VW Golf");
  assert.equal(row.package_id, "premium");
  assert.equal(row.class_id, "suv");
  assert.deepEqual(row.extra_ids, ["felgen", "ozon"]);
  assert.equal(row.city_slug, "nagold");
  assert.equal(row.total_cents, Math.round(expected.total * 100));
  assert.equal(row.pickup_cents, 5000);
  assert.ok(Number.isInteger(row.total_cents) && Number.isInteger(row.pickup_cents));
  assert.equal(row.preferred_date, "2999-10-12");
  assert.equal(row.preferred_slot, "09:00");
  assert.equal(row.address, "Musterstraße 1, 72202 Nagold");
  assert.equal(row.note, "Abholung gewünscht");
  assert.equal(row.review_email_consent, false);

  // A second pull returns the same booking unchanged, with the same id.
  assert.deepEqual(await list(sql), first);

  const consenting = await book(sql, form({ reviewEmailConsent: true, name: "Erika Muster" }));
  const second = await list(sql);
  assert.deepEqual(
    second.inquiries.map((item) => item.id),
    [consenting.id, booking.id],
  );
  assert.equal(second.inquiries[0].review_email_consent, true);
  assert.deepEqual(second.inquiries[1], row);
});

test("hub route: basis price in whole cents, optional fields never null", async () => {
  process.env.HUB_SYNC_TOKEN = TOKEN;
  const sql = await database();
  await book(
    sql,
    form({
      packageId: "basis",
      classId: "kompakt",
      extraIds: [],
      citySlug: "",
      date: "",
      slot: "",
      note: "",
      vehicleMake: "",
      vehicleModel: "",
    }),
  );
  const [row] = (await list(sql)).inquiries;
  assert.equal(row.total_cents, 14900);
  assert.equal(row.pickup_cents, 0);
  assert.deepEqual(row.extra_ids, []);
  for (const key of ["vehicle", "city_slug", "note", "preferred_date", "preferred_slot"])
    assert.equal(row[key], "", key);
});

test("hub route: only open requests, newest first, at most 40", async () => {
  process.env.HUB_SYNC_TOKEN = TOKEN;
  const sql = await database();
  const insert = async (name: string, extra = "") => {
    const [row] = await sql<{
      id: number;
    }>`insert into bookings(shop_id,customer_name,phone,package_id,class_id,total_cents)
      values('white-gloss',${name},'+490000','basis','kompakt',14900) returning id`;
    if (extra) await sql.query(`update bookings set ${extra} where id=$1`, [row.id]);
    return row.id;
  };
  const open = await insert("Offen Eins");
  const feedback = await insert("Rückfrage", "ops_stage='kundenrueckmeldung'");
  const hidden = [
    await insert("Storniert", "status='storniert', cancelled_at=now()"),
    await insert("Abgelehnt", "status='abgelehnt'"),
    await insert("Rechnung", "invoice_status='erstellt'"),
    await insert("Qonto", "qonto_invoice_id='q-1'"),
    await insert("Bezahlt", "payment_status='bezahlt'"),
    await insert("Abgeschlossen", "ops_stage='abgeschlossen'"),
    await insert("X"),
    await insert("  "),
  ];
  const roAccepted = await insert("RO angenommen");
  await sql`insert into roapp_order_state(booking_id,status_id,status_name,amount_cents,inquiry_cents,remote_modified_at,owner_confirmed_at)
    values(${roAccepted},1,'Termin verbindlich',14900,14900,now(),now())`;
  hidden.push(roAccepted);

  const ids = (await list(sql)).inquiries.map((row) => row.id);
  assert.deepEqual(ids, [feedback, open]);
  for (const id of hidden) assert.ok(!ids.includes(id), String(id));

  for (let index = 0; index < 45; index += 1) await insert(`Kunde ${index}`);
  const page = (await list(sql)).inquiries;
  assert.equal(page.length, 40);
  const pageIds = page.map((row) => row.id as number);
  assert.deepEqual(
    pageIds,
    [...pageIds].sort((a, b) => b - a),
  );
  assert.equal(page[0].customer_name, "Kunde 44");
});

test("hub route: note stays under 1500 chars and carries no photo paths", async () => {
  process.env.HUB_SYNC_TOKEN = TOKEN;
  const sql = await database();
  const booking = await book(sql, form({ note: "Fotos anbei.\nhttps://example.invalid/a.jpg" }));
  await sql`insert into booking_photos(shop_id,booking_id,storage_path,mime,size_bytes,original_name)
    values('white-gloss',${booking.id},'private/secret-path.jpg','image/jpeg',10,'a.jpg')`;
  let [row] = (await list(sql)).inquiries;
  assert.equal(
    row.note,
    "Fotos anbei.\nhttps://example.invalid/a.jpg\nFotos: 1 hochgeladen (nicht öffentlich verlinkt)",
  );
  assert.ok(!JSON.stringify(row).includes("secret-path"));

  await sql`update bookings set note=${"n".repeat(3000)} where id=${booking.id}`;
  [row] = (await list(sql)).inquiries;
  assert.ok((row.note as string).length < 1500);
});

test("hub route: database failure answers 500 without details, never 410", async () => {
  process.env.HUB_SYNC_TOKEN = TOKEN;
  const broken = (async () => {
    throw new Error("select * from bookings where phone='+49 secret'");
  }) as unknown as Sql;
  broken.query = broken as unknown as Sql["query"];
  const original = console.error;
  const logged: unknown[] = [];
  console.error = (...args: unknown[]) => logged.push(...args);
  try {
    const response = await call(broken);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "unavailable" });
  } finally {
    console.error = original;
  }
  assert.deepEqual(logged, ["[hub] list_failed"]);
});

test("hub photos: signed preview only, storage path stays out", async () => {
  process.env.HUB_SYNC_TOKEN = TOKEN;
  const sql = await database();
  const booking = await book(sql);
  const stored = `bookings/${booking.id}/${"ab".repeat(16)}.jpg`;
  await sql`insert into booking_photos(shop_id,booking_id,storage_path,mime,size_bytes,original_name,upload_state)
    values('white-gloss',${booking.id},${stored},'image/jpeg',10,'vorne.jpg','ready')`;
  await sql`insert into booking_photos(shop_id,booking_id,storage_path,mime,size_bytes,original_name,upload_state)
    values('white-gloss',${booking.id},'private/secret-path.jpg','image/jpeg',10,'geheim.jpg','ready')`;
  const response = await handleHubInquiries(
    new Request("https://white-gloss.de/api/hub", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ action: "photos", id: booking.id }),
    }),
    async () => sql,
    async () => "https://cdn.example.invalid/preview",
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { photos: { name: string; mime: string; url: string }[] };
  assert.deepEqual(body.photos, [
    { name: "vorne.jpg", mime: "image/jpeg", url: "https://cdn.example.invalid/preview" },
  ]);
  const raw = JSON.stringify(body);
  assert.ok(!raw.includes("secret-path"));
  assert.ok(!raw.includes(stored));
});
