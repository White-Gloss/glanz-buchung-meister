#!/usr/bin/env node
// Owner-approved switch of production from BOOKING_OPERATIONS=roapp to =bitrix.
// Run as root from the release directory (same as cutover-roapp-production.mjs):
//   node cutover-bitrix-production.mjs --list-open        open RO orders, read-only
//   node cutover-bitrix-production.mjs                    dry run, read-only
//   node cutover-bitrix-production.mjs --apply --open-ro=<n>
// --apply stops the services, writes a verified database backup plus a copy of the
// environment file, sets BOOKING_OPERATIONS=bitrix and starts the services again.
// No database rows are changed. Output never contains secret values.
import { createRequire } from "node:module";
import { readFile, writeFile, rename, copyFile, chmod } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ENV_FILE = "/etc/white-gloss/environment";
const SHOP = "white-gloss";
const FINAL_STATUSES = ["abgelehnt", "storniert", "erledigt", "nicht_erschienen"];
const WEBHOOK_RE =
  /^https:\/\/([a-z0-9-]+)\.bitrix24\.([a-z.]{2,10})\/rest\/(\d+)\/([A-Za-z0-9]+)\/?$/i;

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

/** Read-only request: one deal ID. Returns a code, never the response body. */
export async function probeBitrix(value, base, fetchImpl = fetch) {
  const key = (value || "").trim();
  const webhook = WEBHOOK_RE.test(key) ? key.replace(/\/?$/, "/") : null;
  try {
    const response = webhook
      ? await fetchImpl(`${webhook}crm.deal.list.json`, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ start: 0, select: ["ID"] }),
          signal: AbortSignal.timeout(15_000),
        })
      : await fetchImpl(
          `${(base || "https://vibecode.bitrix24.com/v1").replace(/\/$/, "")}/deals?limit=1`,
          {
            headers: { "X-Api-Key": key, Accept: "application/json" },
            signal: AbortSignal.timeout(15_000),
          },
        );
    let json = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    const code = json?.error?.code || (typeof json?.error === "string" ? json.error : "");
    if (!response.ok || json?.success === false || code)
      return {
        ok: false,
        httpStatus: response.status,
        code: String(code || "http_error").slice(0, 40),
      };
    return { ok: true, httpStatus: response.status };
  } catch {
    return { ok: false, code: "unreachable" };
  }
}

export function blockersFor(report) {
  const blockers = [];
  if (!report.root) blockers.push("root_required");
  if (report.mode === "bitrix") blockers.push("already_bitrix");
  else if (report.mode !== "roapp") blockers.push("unexpected_current_mode");
  if (!report.databaseUrl) blockers.push("database_url_missing");
  if (!report.vibeKey.present) blockers.push("vibe_api_key_missing_in_environment_file");
  if (report.vibeKey.present && !report.bitrixProbe?.ok) blockers.push("bitrix_probe_failed");
  if (report.database?.error) blockers.push("database_unreachable");
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

async function inspect(env, db) {
  const report = {
    root: process.getuid?.() === 0,
    mode: env.BOOKING_OPERATIONS || null,
    databaseUrl: Boolean(env.DATABASE_URL),
    vibeKey: describeKey(env.VIBE_API_KEY),
  };
  if (report.vibeKey.present)
    report.bitrixProbe = await probeBitrix(env.VIBE_API_KEY, env.VIBE_API_BASE);
  try {
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

async function main(args) {
  const envText = await readFile(ENV_FILE, "utf8");
  const env = parseEnvironment(envText);
  const { Pool } = loadPg();
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
  const db = await pool.connect();
  let stopped = false;
  try {
    if (args.includes("--list-open")) {
      console.log(JSON.stringify({ openRoOrders: await openOrders(db) }, null, 2));
      return;
    }
    const report = await inspect(env, db);
    if (!args.includes("--apply")) {
      console.log(JSON.stringify({ dryRun: true, ...report }, null, 2));
      return;
    }
    const confirmed = Number(args.find((arg) => arg.startsWith("--open-ro="))?.slice(10));
    if (report.blockers.length) throw new Error(`blocked:${report.blockers.join(",")}`);
    if (confirmed !== report.database.openBookings) throw new Error("open_ro_count_not_confirmed");
    const { backupProduction } = await import(new URL("./backup-production.mjs", import.meta.url));
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
    const dir = `/var/backups/white-gloss/${stamp}`;
    db.release();
    await pool.end();
    stopped = true;
    execFileSync("systemctl", [
      "stop",
      "white-gloss-reminder.timer",
      "white-gloss-reminder.service",
      "white-gloss.service",
    ]);
    const backup = await backupProduction(`${dir}/database.dump`, { env });
    if (!backup.ok || !backup.archiveListValid) throw new Error("backup_not_verified");
    await copyFile(ENV_FILE, `${dir}/environment`);
    await chmod(`${dir}/environment`, 0o600);
    await writeFile(`${ENV_FILE}.bitrix`, withBookingOperations(envText, "bitrix"), {
      mode: 0o600,
    });
    await rename(`${ENV_FILE}.bitrix`, ENV_FILE);
    console.log(
      JSON.stringify(
        {
          mode: "bitrix",
          backup: dir,
          backupBytes: backup.bytes,
          backupSha256: backup.sha256,
          rollback: `install -m 600 ${dir}/environment ${ENV_FILE} && systemctl restart white-gloss.service white-gloss-reminder.timer`,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("cutover_failed", { code: error.code || error.message });
    process.exitCode = 1;
  } finally {
    if (!stopped) {
      db.release();
      await pool.end();
    } else
      execFileSync("systemctl", ["start", "white-gloss.service", "white-gloss-reminder.timer"]);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  await main(process.argv.slice(2));
}
