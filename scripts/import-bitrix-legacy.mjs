#!/usr/bin/env node
// Explicit one-time handoff of inspected existing bookings. Read-only by default.
// Uses the website's durable transfer journal; never creates invoices or messages.
import { lstat, readFile, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import pg from "pg";
import { parseEnvironment, describeKey } from "./cutover-bitrix-production.mjs";
import {
  legacyPlan,
  fingerprint,
  requireLegacy as check,
  assertLegacyBookingUnchanged,
  moneyCents,
} from "./bitrix-legacy-plan.mjs";
import { createBitrixRestClient, restCall } from "../src/lib/bitrix-rest.ts";
import {
  ensureBitrixSchema,
  runBitrixSync,
  loadReadyPhotos,
  findContact,
  ensureCalendar,
} from "../src/lib/bitrix-sync.ts";
import { readBitrixCalendar } from "../src/lib/bitrix-calendar.ts";

async function privateFile(path) {
  const info = await lstat(path);
  check(
    info.isFile() && !info.isSymbolicLink() && info.uid === 0 && (info.mode & 0o077) === 0,
    "private_root_file_required",
  );
  return readFile(path);
}

export function parseImportArgs(args) {
  const result = { apply: false };
  for (const arg of args) {
    if (arg === "--apply") {
      check(!result.apply, "duplicate_argument");
      result.apply = true;
      continue;
    }
    const match = /^--(environment|snapshot|approve|journal|database-backup)=(.+)$/.exec(arg);
    check(match && result[match[1]] === undefined, "invalid_argument");
    result[match[1]] = match[2];
  }
  check(result.environment && result.snapshot, "environment_and_snapshot_required");
  check(
    !result.apply ||
      (/^[a-f0-9]{64}$/.test(result.approve || "") && result.journal && result["database-backup"]),
    "reviewed_plan_and_backup_required",
  );
  return result;
}

function sqlAdapter(client) {
  const query = async (text, params = []) => (await client.query(text, params)).rows;
  const sql = (parts, ...params) =>
    query(
      parts.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, ""),
      params,
    );
  sql.query = query;
  sql.transaction = async (fn) => {
    await client.query("BEGIN");
    try {
      const result = await fn(sql);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  };
  return sql;
}

export async function transferLegacyBooking({
  plan,
  source,
  sql,
  request,
  nativeRead,
  loadedPhotos,
  record,
  calendarRead,
  verifySource,
}) {
  try {
    await sql.transaction(async (tx) => {
      const [current] = await tx.query(
        "SELECT * FROM bookings WHERE id=$1 AND shop_id='white-gloss' FOR UPDATE",
        [plan.bookingId],
      );
      assertLegacyBookingUnchanged(source.booking, current);
      const [existing] = await tx.query(
        "SELECT * FROM bitrix_sync_queue WHERE booking_id=$1 FOR UPDATE",
        [plan.bookingId],
      );
      if (existing)
        check(
          !existing.write_pending &&
            existing.status !== "review" &&
            fingerprint(existing.initial_deal) === fingerprint(plan.deal) &&
            fingerprint(existing.initial_products) === fingerprint(plan.products),
          "different_or_uncertain_transfer_exists",
        );
      if (!existing)
        await tx.query(
          "INSERT INTO bitrix_sync_queue(booking_id,shop_id,requested_version,initial_deal,initial_products,photo_keys) VALUES($1,'white-gloss',$2,$3::jsonb,$4::jsonb,'{}')",
          [plan.bookingId, plan.version, JSON.stringify(plan.deal), JSON.stringify(plan.products)],
        );
    });
    await record({ phase: "queued", bookingId: plan.bookingId });
    await runBitrixSync(sql, {
      request,
      productMap: {},
      bookingId: plan.bookingId,
      limit: 1,
      loadPhotos: async () => loadedPhotos.get(plan.bookingId),
    });
    const [progress] = await sql.query("SELECT * FROM bitrix_sync_queue WHERE booking_id=$1", [
      plan.bookingId,
    ]);
    check(
      progress?.status === "synced" &&
        !progress.write_pending &&
        progress.synced_version === plan.version &&
        progress.details_done &&
        progress.photos_done,
      "transfer_not_verified",
    );
    if (!progress.bitrix_event_id) {
      const occupied = await calendarRead(plan.start, plan.end);
      check(
        !occupied.some((w) => w.start < plan.end && w.end > plan.start),
        "native_calendar_conflict",
      );
      await sql.query(
        "UPDATE bitrix_sync_queue SET write_pending='legacy_calendar',status='review' WHERE booking_id=$1",
        [plan.bookingId],
      );
      await record({
        phase: "calendar_write_pending",
        bookingId: plan.bookingId,
        dealId: progress.bitrix_deal_id,
      });
      const eventId = await ensureCalendar(
        request,
        plan.forTransfer,
        progress.bitrix_deal_id,
        null,
      );
      check(Number.isSafeInteger(eventId) && eventId > 0, "calendar_write_unverified");
      await sql.transaction(async (tx) => {
        await tx.query(
          "UPDATE bitrix_sync_queue SET bitrix_event_id=$2,write_pending=null,status='synced' WHERE booking_id=$1",
          [plan.bookingId, eventId],
        );
        await tx.query("UPDATE bookings SET bitrix_event_id=$2 WHERE id=$1", [
          plan.bookingId,
          eventId,
        ]);
      });
      progress.bitrix_event_id = eventId;
    }
    const deal = await nativeRead("crm.deal.get", { id: progress.bitrix_deal_id });
    const products = await nativeRead("crm.deal.productrows.get", {
      id: progress.bitrix_deal_id,
    });
    const photoResult = await nativeRead("crm.item.get", {
      entityTypeId: 2,
      id: progress.bitrix_deal_id,
      useOriginalUfNames: "Y",
    });
    check(
      Number(deal.ID) === progress.bitrix_deal_id &&
        Number(deal.CONTACT_ID) === progress.bitrix_contact_id &&
        deal.UF_CRM_WG_BOOKING_REF === `WG-${plan.bookingId}` &&
        deal.STAGE_ID === plan.stage &&
        deal.CURRENCY_ID === "EUR" &&
        moneyCents(deal.OPPORTUNITY) === plan.amountCents,
      "native_deal_readback_failed",
    );
    check(
      Date.parse(deal.UF_CRM_WG_APPOINTMENT) === Date.parse(plan.start) &&
        Date.parse(deal.UF_CRM_WG_WORK_END) === Date.parse(plan.end),
      "native_dates_readback_failed",
    );
    check(
      Array.isArray(products) &&
        products.length === plan.products.length &&
        products.every(
          (row, i) =>
            row.PRODUCT_NAME === plan.products[i].name &&
            moneyCents(row.PRICE) === moneyCents(plan.products[i].price) &&
            Number(row.QUANTITY) === 1 &&
            Number(row.TAX_RATE) === plan.products[i].taxRate &&
            row.TAX_INCLUDED === "Y",
        ),
      "native_products_readback_failed",
    );
    const nativePhotos = photoResult?.item?.UF_CRM_WG_PHOTOS || [];
    check(
      Array.isArray(nativePhotos) && nativePhotos.length === plan.photoCount,
      "native_photos_readback_failed",
    );
    const windows = await calendarRead(plan.start, plan.end);
    check(
      windows.some(
        (w) =>
          w.eventId === progress.bitrix_event_id && w.start === plan.start && w.end === plan.end,
      ),
      "native_calendar_readback_failed",
    );
    await verifySource();
    await record({
      phase: "native_readback_verified",
      bookingId: plan.bookingId,
      contactId: progress.bitrix_contact_id,
      dealId: progress.bitrix_deal_id,
      eventId: progress.bitrix_event_id,
    });
  } catch (error) {
    await sql.query(
      "UPDATE bitrix_sync_queue SET status='review',last_error='legacy_transfer_unverified' WHERE booking_id=$1",
      [plan.bookingId],
    );
    throw error;
  }
}

async function main() {
  check(process.getuid?.() === 0, "root_required");
  const args = parseImportArgs(process.argv.slice(2));
  const snapshot = JSON.parse(await privateFile(args.snapshot));
  check(
    snapshot.readOnly === true &&
      Array.isArray(snapshot.records) &&
      snapshot.records.length > 0 &&
      snapshot.records.length <= 100,
    "inspected_snapshot_required",
  );
  const plans = snapshot.records.map(legacyPlan);
  check(new Set(plans.map((p) => p.bookingId)).size === plans.length, "duplicate_legacy_booking");
  const reviewHash = fingerprint({ records: snapshot.records, plans });
  const env = parseEnvironment((await privateFile(args.environment)).toString());
  check(
    env.DATABASE_URL &&
      env.ROAPP_API_KEY &&
      describeKey(env.BITRIX_WEBHOOK_URL).kind === "rest_webhook",
    "native_and_source_credentials_required",
  );
  check(
    /^https:\/\/b24-emfor7\.bitrix24\.de\/rest\//.test(env.BITRIX_WEBHOOK_URL),
    "expected_native_portal_required",
  );
  Object.assign(process.env, env);
  const webhook = env.BITRIX_WEBHOOK_URL.replace(/\/?$/, "/");
  const request = createBitrixRestClient(webhook);
  const nativeRead = (method, params) => restCall(webhook, method, params);
  const client = new pg.Client({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  let journal;
  try {
    await client.connect();
    // Serializes this CLI; the ordinary website worker additionally uses its own lease.
    check(
      (await client.query("SELECT pg_try_advisory_lock(745824, 1) AS locked")).rows[0].locked,
      "legacy_import_already_running",
    );
    const sql = sqlAdapter(client);
    const currentRows = await sql.query(
      "SELECT * FROM bookings WHERE shop_id='white-gloss' ORDER BY id",
    );
    check(
      fingerprint(currentRows.map((row) => row.id)) ===
        fingerprint(plans.map((p) => p.bookingId).sort((a, b) => a - b)),
      "booking_inventory_changed",
    );
    const loadedPhotos = new Map();
    const roRead = async (path) => {
      await pause(350);
      const response = await fetch(`https://api.roapp.io/v2${path}`, {
        headers: { Authorization: `Bearer ${env.ROAPP_API_KEY}`, Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      check(response.ok, "legacy_source_unavailable");
      const body = await response.json();
      check(body && !body.error && !body.error_description, "legacy_source_unavailable");
      return body;
    };
    // Finish every read-only preflight before any CRM or database mutation.
    for (let index = 0; index < plans.length; index++) {
      const plan = plans[index],
        source = snapshot.records[index];
      assertLegacyBookingUnchanged(
        source.booking,
        currentRows.find((row) => row.id === plan.bookingId),
      );
      const orderBody = await roRead(`/orders/${plan.orderId}`);
      const order = orderBody.data || orderBody;
      const items = await roRead(`/orders/${plan.orderId}/items`);
      check(
        fingerprint(order) === fingerprint(source.order) &&
          fingerprint(items) === fingerprint(source.items),
        "legacy_source_changed",
      );
      const [queue] = await sql.query(
        "SELECT to_jsonb(q) AS data FROM bitrix_sync_queue q WHERE booking_id=$1",
        [plan.bookingId],
      );
      const progress = queue?.data;
      if (progress) {
        check(
          !progress.write_pending && progress.status !== "review",
          "uncertain_transfer_requires_review",
        );
        check(
          fingerprint(progress.initial_deal) === fingerprint(plan.deal) &&
            fingerprint(progress.initial_products) === fingerprint(plan.products) &&
            progress.requested_version === plan.version,
          "different_transfer_snapshot_exists",
        );
      }
      const ref = `WG-${plan.bookingId}`;
      const byRef = await nativeRead("crm.deal.list", {
        filter: { "=UF_CRM_WG_BOOKING_REF": ref },
        select: ["ID", "TITLE"],
        start: 0,
      });
      const byTitle = await nativeRead("crm.deal.list", {
        filter: { "%TITLE": ref },
        select: ["ID", "TITLE"],
        start: 0,
      });
      check(
        Array.isArray(byRef) && Array.isArray(byTitle) && byRef.length < 50 && byTitle.length < 50,
        "native_lookup_incomplete",
      );
      const candidates = [
        ...new Set(
          [
            ...byRef,
            ...byTitle.filter((r) => new RegExp(`^${ref}(?:\\s|[·:–—-]|$)`).test(String(r.TITLE))),
          ].map((r) => Number(r.ID)),
        ),
      ];
      check(
        progress?.bitrix_deal_id
          ? candidates.length === 1 && candidates[0] === progress.bitrix_deal_id
          : candidates.length === 0,
        "native_mapping_requires_review",
      );
      await findContact(request, source.booking.email, source.booking.phone);
      const photos = await loadReadyPhotos(sql, plan.bookingId);
      check(
        photos.length === plan.photoCount &&
          fingerprint(photos.map((p) => p.key).sort()) ===
            fingerprint(source.photos.map((p) => p.storage_path).sort()),
        "legacy_photo_readback_failed",
      );
      loadedPhotos.set(plan.bookingId, photos);
      const windows = await readBitrixCalendar(webhook, plan.start, plan.end);
      check(
        !windows.some(
          (w) =>
            w.eventId !== progress?.bitrix_event_id && w.start < plan.end && w.end > plan.start,
        ),
        "native_calendar_conflict",
      );
    }
    const summary = plans.map(
      ({
        bookingId,
        orderId,
        originalStatus,
        stage,
        amountCents,
        paidCents,
        start,
        end,
        photoCount,
        warnings,
      }) => ({
        bookingId,
        orderId,
        originalStatus,
        stage,
        amountCents,
        paidCents,
        start,
        end,
        photoCount,
        warnings,
      }),
    );
    if (!args.apply) {
      console.log(JSON.stringify({ ok: true, readOnly: true, reviewHash, records: summary }));
      return;
    }
    check(args.approve === reviewHash, "reviewed_plan_changed");
    await privateFile(args["database-backup"]);
    await promisify(execFile)("pg_restore", ["--list", args["database-backup"]], {
      maxBuffer: 10 * 1024 * 1024,
    });
    const directory = await lstat(dirname(resolve(args.journal)));
    check(
      directory.isDirectory() &&
        !directory.isSymbolicLink() &&
        directory.uid === 0 &&
        (directory.mode & 0o077) === 0,
      "private_journal_directory_required",
    );
    journal = await open(args.journal, "wx", 0o600);
    const record = async (event) => {
      await journal.writeFile(JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n");
      await journal.sync();
    };
    await record({ phase: "preflight_verified", reviewHash, records: summary });
    await ensureBitrixSchema(sql);
    for (let index = 0; index < plans.length; index++) {
      await transferLegacyBooking({
        plan: plans[index],
        source: snapshot.records[index],
        sql,
        request,
        nativeRead,
        loadedPhotos,
        record,
        calendarRead: (from, to) => readBitrixCalendar(webhook, from, to),
        verifySource: async () => {
          const source = snapshot.records[index];
          const latestOrder = await roRead(`/orders/${plans[index].orderId}`);
          const latestItems = await roRead(`/orders/${plans[index].orderId}/items`);
          check(
            fingerprint(latestOrder.data || latestOrder) === fingerprint(source.order) &&
              fingerprint(latestItems) === fingerprint(source.items),
            "legacy_source_changed_during_transfer",
          );
          const [booking] = await sql.query(
            "SELECT * FROM bookings WHERE id=$1 AND shop_id='white-gloss'",
            [plans[index].bookingId],
          );
          assertLegacyBookingUnchanged(source.booking, booking);
        },
      });
    }
    // Availability is activated with the paired code/environment cutover, separately.
    await record({ phase: "handoff_verified", bookings: plans.length });
    console.log(
      JSON.stringify({
        ok: true,
        imported: plans.length,
        calendarEnabled: false,
        invoicesCreated: 0,
        customerMessagesSent: 0,
        reviewHash,
      }),
    );
  } finally {
    await journal?.close();
    await client.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const code = /^[a-z][a-z0-9_]+$/.test(error?.message || "")
      ? error.message
      : "legacy_handoff_failed";
    console.error(
      JSON.stringify({
        ok: false,
        code,
        instructions:
          "Inspect the private journal and Bitrix transfer queue before any retry. No customer messages or invoices are created by this tool.",
      }),
    );
    process.exitCode = 1;
  });
}
