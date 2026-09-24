#!/usr/bin/env node
// Owner-approved switch of production from BOOKING_OPERATIONS=roapp to =bitrix.
// Run as root from the release directory while the prior RO-capable release is active:
//   node cutover-bitrix-production.mjs --list-open        open RO orders, read-only
//   node cutover-bitrix-production.mjs                    dry run, read-only
//   node cutover-bitrix-production.mjs --apply --open-ro=<n>
// --apply stops the services, rechecks the confirmed count, the RO queue and the
// unchanged environment file, writes a verified database backup plus a copy of the
// environment file, sets BOOKING_OPERATIONS=bitrix, starts the services and reports
// success only after the local healthcheck; otherwise the old file is restored.
// No database rows are changed. Output never contains secret values.
// After deploying the Bitrix-only release, rollback also requires restoring the
// prior release: changing the environment alone cannot restore retired adapters.
import { createRequire } from "node:module";
import { readFile, writeFile, rename, chmod } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ENV_FILE = "/etc/white-gloss/environment";
const SHOP = "white-gloss";
const FINAL_STATUSES = ["abgelehnt", "storniert", "erledigt", "nicht_erschienen"];
const WEBHOOK_RE =
  /^https:\/\/([a-z0-9-]+)\.bitrix24\.(de|com|eu|ru)\/rest\/(\d+)\/([A-Za-z0-9]+)\/?$/i;

/** systemd EnvironmentFile subset: KEY=VALUE, optional quotes, # comments. */
export function parseEnvironment(text) {
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at <= 0) continue;
    let value = line.slice(at + 1).trim();
    if (value.length >= 2 && /^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    values[line.slice(0, at).trim()] = value;
  }
  return values;
}

/** Replaces every BOOKING_OPERATIONS line with one entry; all other lines stay byte-identical. */
export function withBookingOperations(text, mode) {
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  const kept = lines.filter((line) => line.split("=")[0].trim() !== "BOOKING_OPERATIONS");
  kept.push(`BOOKING_OPERATIONS=${mode}`);
  return kept.join("\n") + "\n";
}

/** Describes a Bitrix credential without revealing it. */
export function describeKey(value) {
  const key = (value || "").trim();
  if (!key) return { present: false };
  if (WEBHOOK_RE.test(key)) return { present: true, kind: "rest_webhook" };
  return {
    present: true,
    kind: key.startsWith("vibe_api_") ? "vibecode" : "unknown",
    length: key.length,
  };
}

/** Read-only native REST probes; no proxy or app credentials are accepted. */
async function probeRest(key, method, params, fetchImpl) {
  if (!WEBHOOK_RE.test((key || "").trim())) return { ok: false, code: "rest_webhook_required" };
  try {
    const response = await fetchImpl(key.trim().replace(/\/?$/, "/") + method + ".json", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15_000),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || json?.error != null || json?.error_description)
      return { ok: false, httpStatus: response.status, code: "access_failed" };
    if (!Array.isArray(json?.result) || (json.next != null && method === "calendar.event.get"))
      return { ok: false, httpStatus: response.status, code: "invalid_response" };
    return { ok: true, httpStatus: response.status };
  } catch {
    return { ok: false, code: "unreachable" };
  }
}
export async function probeBitrix(key, _base, fetchImpl = fetch) {
  return probeRest(key, "crm.deal.list", { start: 0, select: ["ID"] }, fetchImpl);
}
export async function probeCalendar(key, _base, fetchImpl = fetch) {
  return probeRest(
    key,
    "calendar.event.get",
    {
      type: "user",
      ownerId: 1,
      section: [2],
      from: new Date().toISOString().slice(0, 10),
      to: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    },
    fetchImpl,
  );
}

export function blockersFor(report) {
  const blockers = [];
  if (!report.root) blockers.push("root_required");
  if (report.mode === "bitrix") blockers.push("already_bitrix");
  else if (report.mode !== "roapp") blockers.push("unexpected_current_mode");
  if (!report.databaseUrl) blockers.push("database_url_missing");
  if (!report.vibeKey.present) blockers.push("bitrix_webhook_missing_in_environment_file");
  else if (report.vibeKey.kind !== "rest_webhook") blockers.push("rest_webhook_required");
  else if (!report.bitrixProbe?.ok) blockers.push("bitrix_probe_failed");
  if (!report.calendarProbe?.ok) blockers.push("bitrix_calendar_probe_failed");
  if (!report.database || report.database.error) blockers.push("database_unreachable");
  else {
    if (report.database.bitrixCalendarEnabled !== true) blockers.push("bitrix_calendar_disabled");
    if (report.database.openBookingsWithoutBitrix !== 0)
      blockers.push("open_bookings_without_bitrix");
    if (report.database.bitrixQueueUnfinished !== 0) blockers.push("bitrix_queue_unfinished");
  }
  // The Bitrix-only cron never drains RO rows again; they must be settled first.
  if (report.database?.roQueueUnfinished > 0) blockers.push("roapp_queue_unfinished");
  return blockers;
}

function loadPg() {
  return createRequire(`${process.cwd()}/package.json`)("pg");
}

async function openOrders(db) {
  const hasState = (await db.query("select to_regclass('roapp_order_state') as r")).rows[0].r;
  return (
    await db.query(
      `select b.id, b.status, b.preferred_date::text as date, b.preferred_slot as slot,
         q.ro_order_id, q.status as sync_status${hasState ? ", s.status_name as ro_status" : ""}
       from bookings b
       left join roapp_sync_queue q on q.booking_id=b.id
       ${hasState ? "left join roapp_order_state s on s.booking_id=b.id" : ""}
       where b.shop_id=$1 and b.status <> all($2::text[])
       order by b.preferred_date nulls last, b.id`,
      [SHOP, FINAL_STATUSES],
    )
  ).rows;
}

async function inspect(env, db, connectError) {
  const report = {
    root: process.getuid?.() === 0,
    mode: env.BOOKING_OPERATIONS || null,
    databaseUrl: Boolean(env.DATABASE_URL),
    vibeKey: describeKey(env.BITRIX_WEBHOOK_URL || env.VIBE_API_KEY),
  };
  if (report.vibeKey.present)
    report.bitrixProbe = await probeBitrix(env.BITRIX_WEBHOOK_URL || env.VIBE_API_KEY, undefined);
  if (report.bitrixProbe?.ok && report.vibeKey.kind !== "rest_webhook")
    report.calendarProbe = await probeCalendar(
      env.BITRIX_WEBHOOK_URL || env.VIBE_API_KEY,
      undefined,
    );
  try {
    if (!db) throw Object.assign(new Error("connect_failed"), { code: connectError });
    const settings = (
      await db
        .query(
          `select (vibe_api_key is not null and vibe_api_key<>'') as panel_key,
           coalesce(to_jsonb(s)->>'bitrix_calendar_enabled','false')::boolean as calendar,
           roapp_sync_enabled from shop_settings s where shop_id=$1`,
          [SHOP],
        )
        .catch(
          async () =>
            await db.query("select roapp_sync_enabled from shop_settings where shop_id=$1", [SHOP]),
        )
    ).rows[0];
    const count = async (table, where = "true") =>
      (await db.query("select to_regclass($1) as r", [table])).rows[0].r
        ? Number(
            (await db.query(`select count(*) from ${table} where shop_id=$1 and ${where}`, [SHOP]))
              .rows[0].count,
          )
        : null;
    report.database = {
      openBookings: (await openOrders(db)).length,
      openBookingsWithoutBitrix: (await db.query("select to_regclass('bitrix_sync_queue') as r"))
        .rows[0].r
        ? Number(
            (
              await db.query(
                `select count(*) from bookings b where b.shop_id=$1 and b.status <> all($2::text[])
             and not exists (select 1 from bitrix_sync_queue q where q.shop_id=b.shop_id
               and q.booking_id=b.id and q.bitrix_deal_id > 0 and q.status='synced')`,
                [SHOP, FINAL_STATUSES],
              )
            ).rows[0].count,
          )
        : (await openOrders(db)).length,
      roQueueUnfinished: await count("roapp_sync_queue", "status<>'synced'"),
      bitrixQueue: await count("bitrix_sync_queue"),
      bitrixQueueUnfinished: await count("bitrix_sync_queue", "status<>'synced'"),
      panelKeyStored: settings?.panel_key ?? null,
      bitrixCalendarEnabled: settings?.calendar ?? null,
      roappSyncEnabled: settings?.roapp_sync_enabled ?? null,
    };
  } catch (error) {
    report.database = { error: error.code || "query_failed" };
  }
  report.blockers = blockersFor(report);
  return report;
}

async function connect(env) {
  const { Pool } = loadPg();
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
  try {
    return { pool, db: await pool.connect() };
  } catch (error) {
    await pool.end().catch(() => {});
    return { error: error.code || "connect_failed" };
  }
}

async function inspectFresh(env) {
  const { pool, db, error } = await connect(env);
  try {
    return await inspect(env, db, error);
  } finally {
    db?.release();
    await pool?.end();
  }
}

const SERVICES = ["white-gloss.service", "white-gloss-reminder.timer"];

async function startAndCheck(healthUrl) {
  execFileSync("systemctl", ["start", ...SERVICES]);
  for (let attempt = 0; attempt < 30; attempt++) {
    const ok = await fetch(healthUrl, { signal: AbortSignal.timeout(3_000) })
      .then((response) => response.ok)
      .catch(() => false);
    if (ok) return true;
    await new Promise((done) => setTimeout(done, 1_000));
  }
  return false;
}

async function apply(args, envText, env) {
  const confirmed = Number(args.find((arg) => arg.startsWith("--open-ro="))?.slice(10));
  const before = await inspectFresh(env);
  if (before.blockers.length) throw new Error(`blocked:${before.blockers.join(",")}`);
  if (confirmed !== before.database.openBookings) throw new Error("open_ro_count_not_confirmed");
  const { backupProduction } = await import(new URL("./backup-production.mjs", import.meta.url));
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const dir = `/var/backups/white-gloss/${stamp}`;
  const healthUrl = env.CUTOVER_HEALTHCHECK_URL || "http://127.0.0.1:3000/";
  let switched = false;
  try {
    execFileSync("systemctl", [
      "stop",
      "white-gloss-reminder.timer",
      "white-gloss-reminder.service",
      "white-gloss.service",
    ]);
    // Writers are stopped: recheck counts and the environment file on a stable state.
    const stable = await inspectFresh(env);
    if (stable.blockers.length) throw new Error(`blocked:${stable.blockers.join(",")}`);
    if (confirmed !== stable.database.openBookings) throw new Error("open_ro_count_changed");
    if ((await readFile(ENV_FILE, "utf8")) !== envText) throw new Error("environment_changed");
    const backup = await backupProduction(`${dir}/database.dump`, { env });
    if (!backup.ok || !backup.archiveListValid) throw new Error("backup_not_verified");
    await writeFile(`${dir}/environment`, envText, { mode: 0o600, flag: "wx" });
    await chmod(`${dir}/environment`, 0o600);
    await writeFile(`${ENV_FILE}.bitrix`, withBookingOperations(envText, "bitrix"), {
      mode: 0o600,
    });
    await rename(`${ENV_FILE}.bitrix`, ENV_FILE);
    switched = true;
    if (!(await startAndCheck(healthUrl))) {
      await writeFile(`${ENV_FILE}.roapp`, envText, { mode: 0o600 });
      await rename(`${ENV_FILE}.roapp`, ENV_FILE);
      execFileSync("systemctl", ["restart", ...SERVICES]);
      throw new Error("healthcheck_failed_environment_restored");
    }
    return {
      mode: "bitrix",
      healthcheck: "ok",
      backup: dir,
      backupBytes: backup.bytes,
      backupSha256: backup.sha256,
      rollback: `install -m 600 ${dir}/environment ${ENV_FILE} && systemctl restart ${SERVICES.join(" ")}`,
    };
  } finally {
    if (!switched) execFileSync("systemctl", ["start", ...SERVICES]);
  }
}

async function main(args) {
  try {
    const envText = await readFile(ENV_FILE, "utf8");
    const env = parseEnvironment(envText);
    if (args.includes("--list-open")) {
      const { pool, db, error } = await connect(env);
      if (!db) throw new Error(`database_unreachable:${error}`);
      try {
        console.log(JSON.stringify({ openRoOrders: await openOrders(db) }, null, 2));
      } finally {
        db.release();
        await pool.end();
      }
    } else if (args.includes("--apply")) {
      console.log(JSON.stringify(await apply(args, envText, env), null, 2));
    } else {
      console.log(JSON.stringify({ dryRun: true, ...(await inspectFresh(env)) }, null, 2));
    }
  } catch (error) {
    console.error("cutover_failed", { code: error.code || error.message });
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  await main(process.argv.slice(2));
}
