#!/usr/bin/env node
// Read-only reconciliation of existing RO orders before a native Bitrix handoff.
// Private snapshot only; no CRM creation, local mutation, mail or invoice operation.
import { lstat, open, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import pg from "pg";
import { describeKey, parseEnvironment } from "./cutover-bitrix-production.mjs";

async function main() {
  if (process.getuid?.() !== 0) throw new Error("root_required");
  const args = Object.fromEntries(
    process.argv.slice(2).map((value) => {
      const at = value.indexOf("=");
      if (at < 0) throw new Error("named_arguments_required");
      return [value.slice(0, at), value.slice(at + 1)];
    }),
  );
  if (
    Object.keys(args).some((key) => !["--environment", "--output"].includes(key)) ||
    !args["--output"]
  )
    throw new Error("invalid_arguments");
  const envFile = args["--environment"] || "/etc/white-gloss/environment";
  const info = await lstat(envFile);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== 0 || (info.mode & 0o077) !== 0)
    throw new Error("private_environment_required");
  const env = parseEnvironment(await readFile(envFile, "utf8"));
  const key = env.BITRIX_WEBHOOK_URL;
  if (!env.DATABASE_URL || !env.ROAPP_API_KEY || describeKey(key).kind !== "rest_webhook")
    throw new Error("source_and_target_credentials_required");
  const output = resolve(args["--output"]);
  if (output === resolve(envFile)) throw new Error("separate_output_required");
  const parent = await lstat(dirname(output));
  if (
    !parent.isDirectory() ||
    parent.isSymbolicLink() ||
    parent.uid !== 0 ||
    (parent.mode & 0o077) !== 0
  )
    throw new Error("private_output_directory_required");
  // Refuse overwrite before making any external request.
  const file = await open(output, "wx", 0o600);
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  let db;
  try {
    db = await pool.connect();
    await db.query("begin read only isolation level repeatable read");
    await db.query("set local statement_timeout = '10s'");
    const rows = (
      await db.query(
        `select b.*,q.ro_order_id,q.ro_contact_id,q.status as ro_sync_status,
      to_jsonb(s) as cached_ro_state from bookings b join roapp_sync_queue q on q.booking_id=b.id
      left join roapp_order_state s on s.booking_id=b.id where b.shop_id=$1 order by b.id`,
        ["white-gloss"],
      )
    ).rows;
    const photos = (
      await db.query(
        `select p.* from booking_photos p join bookings b on b.id=p.booking_id
      where b.shop_id=$1 order by p.booking_id`,
        ["white-gloss"],
      )
    ).rows;
    await db.query("rollback");
    db.release();
    db = undefined;
    const request = async (url, options) => {
      const response = await fetch(url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("read_request_failed");
      const body = await response.json();
      if (!body || body.error || body.error_description) throw new Error("invalid_read_response");
      return body;
    };
    const roRead = async (path) => {
      await pause(350);
      return request("https://api.roapp.io/v2" + path, {
        headers: { Authorization: `Bearer ${env.ROAPP_API_KEY}`, Accept: "application/json" },
      });
    };
    const nativeRead = async (filter) => {
      const body = await request(key.replace(/\/?$/, "/") + "crm.deal.list.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filter,
          select: [
            "ID",
            "TITLE",
            "CONTACT_ID",
            "STAGE_ID",
            "OPPORTUNITY",
            "CURRENCY_ID",
            "UF_CRM_WG_BOOKING_REF",
          ],
          start: 0,
        }),
      });
      if (!Array.isArray(body.result) || body.next != null)
        throw new Error("native_lookup_incomplete");
      return body.result;
    };
    const records = [];
    for (const booking of rows) {
      const id = Number(booking.ro_order_id);
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error("ro_mapping_required");
      const orderResponse = await roRead(`/orders/${id}`);
      const order = orderResponse.data || orderResponse;
      if (Number(order.id) !== id) throw new Error("ro_identity_mismatch");
      const items = await roRead(`/orders/${id}/items`);
      const ref = `WG-${booking.id}`;
      const byRef = await nativeRead({ "=UF_CRM_WG_BOOKING_REF": ref });
      const byTitle = await nativeRead({ "%TITLE": ref });
      const candidates = [
        ...new Map(
          [
            ...byRef,
            ...byTitle.filter((deal) =>
              new RegExp(`^WG-${booking.id}(?:\\s|[·:–—-]|$)`).test(String(deal.TITLE || "")),
            ),
          ].map((deal) => [String(deal.ID), deal]),
        ).values(),
      ];
      records.push({
        booking,
        order,
        items,
        photos: photos.filter((photo) => photo.booking_id === booking.id),
        candidates,
      });
    }
    await file.writeFile(
      JSON.stringify({ readOnly: true, capturedAt: new Date().toISOString(), records }, null, 2) +
        "\n",
    );
    await file.sync();
    console.log(
      JSON.stringify({
        ok: true,
        readOnly: true,
        count: records.length,
        records: records.map(({ booking, order, items, photos: media, candidates }) => ({
          bookingId: booking.id,
          orderId: order.id,
          status: order.status?.name || null,
          sourceAmount: order.total,
          websiteAmountCents: booking.total_cents,
          itemCount: Array.isArray(items)
            ? items.length
            : Array.isArray(items.data)
              ? items.data.length
              : null,
          photos: media.length,
          nativeCandidates: candidates.map((candidate) => Number(candidate.ID)),
        })),
      }),
    );
  } finally {
    if (db) {
      await db.query("rollback").catch(() => {});
      db.release();
    }
    await pool.end();
    await file.close();
  }
}

main().catch(() => {
  console.error(
    "Legacy handoff inspection failed. No CRM or booking changes performed; details and credentials were not logged.",
  );
  process.exitCode = 1;
});
