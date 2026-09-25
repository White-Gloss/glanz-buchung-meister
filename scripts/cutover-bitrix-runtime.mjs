import * as fs from "node:fs/promises";
import { constants } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "./cutover-bitrix-production.mjs";
import { backupProduction } from "./backup-production.mjs";
import { checkReleaseSchema, releaseConfigurationProblems } from "./release-policy.mjs";
import {
  MAIN,
  CutoverError,
  requireCondition,
  sha256,
  validateEnvironmentPair,
} from "./cutover-bitrix-release.mjs";

const OPS = dirname(dirname(fileURLToPath(import.meta.url)));
const RELEASES = "/srv/white-gloss-releases";
const CURRENT = "/srv/white-gloss-current";
const ENVIRONMENT = "/etc/white-gloss/environment";
const CONTRACT = "white-gloss-booking-workflow=1\n";
const LOCK = "/run/white-gloss-deploy.lock";
const CHILD_ENV = { PATH: "/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C", LC_ALL: "C" };

export async function acquireDeployLock(path = LOCK, { io = fs, run = execFileSync } = {}) {
  const handle = await io.open(
    path,
    constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    const stat = await handle.stat();
    requireCondition(
      stat.uid === 0 && stat.isFile() && !(stat.mode & 0o022),
      "unprotected_deploy_lock",
    );
    // Linux flock belongs to the shared open file description. Parent keeps it
    // after the short child exits, until handle.close(). Never unlink it.
    // https://man7.org/linux/man-pages/man2/flock.2.html
    run("/usr/bin/flock", ["--exclusive", "--nonblock", "3"], {
      env: CHILD_ENV,
      stdio: ["ignore", "ignore", "ignore", handle.fd],
      timeout: 5000,
    });
  } catch {
    await handle.close();
    throw new CutoverError("cutover_lock_unavailable");
  }
  return () => handle.close();
}

// These immutable, additive SQL files were checked against the previous schema.
// A different pending migration requires a separate compatibility review; there
// is deliberately no --force option and no automatic database restore.
export const COMPATIBLE_MIGRATIONS = {
  "0015_zoho_ops.sql": "47b22d8a1621bc0acd433f2b8bb830616d3303867c30062ef49304139d04d6bc",
  "0016_bitrix_sync.sql": "d035e8627b45188c2f5e11570a92c907e9d407cd4c41bed518b0e74185ebf781",
  "0017_bitrix_agent.sql": "d07afdd47c5cfc75688d8fe654a86db8b12ef36b50e09c94b80777cbada5707a",
  "0018_bitrix_workshop_bridge.sql":
    "133ff05e0b423b2825fe1b9b7156dd58422bd6592acf3b1683a84483c6e6ba6b",
  "0021_bitrix_native_transfer.sql":
    "6e5bd1476656c432fc9f35302796cff316d18f3190808ccc3db715a621d34961",
};

function command(program, args, timeout = 90_000) {
  try {
    return execFileSync(program, args, {
      env: CHILD_ENV,
      encoding: "utf8",
      timeout,
      maxBuffer: 2 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new CutoverError("system_command_failed");
  }
}
export function protectedAncestor(stat, ancestor) {
  return (
    !stat.isSymbolicLink() &&
    stat.uid === 0 &&
    (!(stat.mode & 0o022) || (ancestor && stat.isDirectory() && Boolean(stat.mode & 0o1000)))
  );
}
async function securePath(path, { directory = false, privateFile = false } = {}) {
  // Validate every parent, including /srv or /etc; only root may replace an
  // ancestor between lstat and use. A root operator must still serialize deploys.
  let at = "/";
  const pieces = path.split("/").filter(Boolean);
  for (let i = 0; i < pieces.length; i++) {
    at = join(at, pieces[i]);
    const stat = await fs.lstat(at);
    // A root-owned child beneath root-owned sticky /var/tmp cannot be replaced
    // by another user. The leaf itself must remain non-writable to other users.
    requireCondition(protectedAncestor(stat, i < pieces.length - 1), "unprotected_path");
    if (i < pieces.length - 1 || directory)
      requireCondition(stat.isDirectory(), "invalid_directory");
    else {
      requireCondition(stat.isFile(), "invalid_file");
      if (privateFile)
        requireCondition((stat.mode & 0o777) === 0o600, "environment_requires_mode_0600");
    }
  }
}

/** Portable digest for the reviewed build: relative names, sizes and file bytes. */
export async function outputDigest(path, { protectedFiles = false } = {}) {
  const digest = createHash("sha256");
  async function visit(directory, relative) {
    const entries = (await fs.readdir(directory)).sort();
    for (const entry of entries) {
      const name = relative ? `${relative}/${entry}` : entry;
      requireCondition(!/[\r\n\0\\]/.test(name), "invalid_output_path");
      const full = join(directory, entry);
      const stat = await fs.lstat(full);
      requireCondition(!stat.isSymbolicLink(), "output_symlink_forbidden");
      if (protectedFiles)
        requireCondition(stat.uid === 0 && !(stat.mode & 0o022), "unprotected_output");
      if (stat.isDirectory()) await visit(full, name);
      else {
        requireCondition(stat.isFile(), "unsupported_output_entry");
        requireCondition(
          !/(^|\/)(\.env(?:\..*)?|runtime-vibe\.env)$/.test(name),
          "output_contains_environment_file",
        );
        digest.update(`${Buffer.byteLength(name)}:${name}:${stat.size}:`);
        const file = await fs.open(full, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          for await (const bytes of file.createReadStream({ autoClose: false }))
            digest.update(bytes);
        } finally {
          await file.close();
        }
      }
    }
  }
  const root = await fs.lstat(path);
  requireCondition(root.isDirectory() && !root.isSymbolicLink(), "invalid_output_directory");
  if (protectedFiles)
    requireCondition(root.uid === 0 && !(root.mode & 0o022), "unprotected_output");
  await visit(path, "");
  return digest.digest("hex");
}

async function releaseDigest(sha) {
  requireCondition(/^[0-9a-f]{40}$/.test(sha), "invalid_release_id");
  const root = join(RELEASES, sha);
  await securePath(root, { directory: true });
  await securePath(join(root, ".output/server/index.mjs"));
  requireCondition(
    (await fs.readFile(join(root, ".output/booking-workflow.contract"), "utf8")) === CONTRACT,
    "incompatible_release_contract",
  );
  return outputDigest(join(root, ".output"), { protectedFiles: true });
}
async function currentRelease() {
  await securePath("/srv", { directory: true });
  const stat = await fs.lstat(CURRENT);
  requireCondition(stat.isSymbolicLink() && stat.uid === 0, "invalid_current_link");
  const path = await fs.realpath(CURRENT);
  requireCondition(
    path.startsWith(`${RELEASES}/`) && /^[a-f0-9]{40}$/.test(path.slice(RELEASES.length + 1)),
    "invalid_current_release",
  );
  return path.slice(RELEASES.length + 1);
}
function state(unit) {
  return command("/usr/bin/systemctl", ["show", unit, "--property=ActiveState", "--value"]);
}
function unitNames(text) {
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => line.trim().split(/\s+/)[0]);
}

export function cronMatches(text) {
  return text
    .split(/\r?\n/)
    .some(
      (line) =>
        !/^\s*(#|$)/.test(line) &&
        /white[-_]gloss|automation-cron|run-notifications|(?:127\.0\.0\.1|localhost):3000/i.test(
          line,
        ),
    );
}
async function writerInventory(writers) {
  const installed = unitNames(
    command("/usr/bin/systemctl", ["list-unit-files", "--no-legend", "--plain", "white-gloss*"]),
  );
  const loaded = unitNames(
    command("/usr/bin/systemctl", [
      "list-units",
      "--all",
      "--no-legend",
      "--plain",
      "white-gloss*",
    ]),
  );
  const units = [...new Set([...installed, ...loaded])]
    .filter((u) => /\.(service|timer)$/.test(u))
    .sort();
  requireCondition(
    units.every((u) => writers.includes(u)),
    "unmanaged_website_unit",
  );
  const cronFiles = [];
  for (const folder of [
    "/etc/cron.d",
    "/var/spool/cron/crontabs",
    "/etc/cron.hourly",
    "/etc/cron.daily",
    "/etc/cron.weekly",
    "/etc/cron.monthly",
  ]) {
    for (const entry of await fs.readdir(folder).catch((e) => {
      if (e.code === "ENOENT") return [];
      throw e;
    }))
      cronFiles.push(join(folder, entry));
  }
  cronFiles.push("/etc/crontab");
  const fingerprint = [];
  for (const path of cronFiles.sort()) {
    const stat = await fs.lstat(path).catch((e) => {
      if (e.code === "ENOENT") return null;
      throw e;
    });
    if (!stat) continue;
    requireCondition(stat.isFile() || stat.isSymbolicLink(), "uninspectable_cron_entry");
    const text = await fs.readFile(path, "utf8");
    requireCondition(!cronMatches(text), "unmanaged_website_cron");
    fingerprint.push([path, sha256(text)]);
  }
  const states = Object.fromEntries(
    writers.map((u) => [u, units.includes(u) ? state(u) : "absent"]),
  );
  requireCondition(
    Object.values(states).every((s) => ["active", "inactive", "failed", "absent"].includes(s)),
    "writer_transition_in_progress",
  );
  return { states, units, fingerprint: sha256(JSON.stringify([units, fingerprint])) };
}

async function syncDirectory(path) {
  const handle = await fs.open(path, constants.O_RDONLY | constants.O_DIRECTORY);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
export async function writePrivateVerified(path, text, io = fs) {
  const handle = await io.open(path, "wx", 0o600);
  try {
    await handle.writeFile(text);
    await handle.sync();
  } finally {
    await handle.close();
  }
  requireCondition((await io.readFile(path, "utf8")) === text, "private_backup_not_verified");
}

async function database(env, operation) {
  const { Pool } = createRequire(import.meta.url)("pg");
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    return await operation(client);
  } finally {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
    await pool.end();
  }
}

export function validateMigrationPlan(entries, applied) {
  const pending = Object.keys(entries)
    .filter((name) => !applied.includes(name))
    .sort();
  requireCondition(
    Object.hasOwn(entries, "0021_bitrix_native_transfer.sql"),
    "native_migration_missing",
  );
  for (const name of pending)
    requireCondition(COMPATIBLE_MIGRATIONS[name] === entries[name], "unreviewed_pending_migration");
  return pending;
}

export async function verifyNativeMappings(webhook, rows, fetchImpl = fetch) {
  requireCondition(rows.length <= 100, "native_mapping_inventory_too_large");
  const identities = [];
  for (const row of rows) {
    requireCondition(
      [row.id, row.bitrix_deal_id, row.bitrix_contact_id].every(
        (v) => Number.isSafeInteger(Number(v)) && Number(v) > 0,
      ),
      "invalid_native_mapping_id",
    );
    let body;
    try {
      const response = await fetchImpl(webhook.replace(/\/?$/, "/") + "crm.deal.get.json", {
        method: "POST",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.bitrix_deal_id }),
        signal: AbortSignal.timeout(15000),
      });
      requireCondition(response.ok, "native_mapping_probe_failed");
      body = await response.json();
    } catch {
      throw new CutoverError("native_mapping_probe_failed");
    }
    const deal = body?.result;
    requireCondition(
      !body?.error &&
        !body?.error_description &&
        deal &&
        Number(deal.ID) === Number(row.bitrix_deal_id) &&
        Number(deal.CONTACT_ID) === Number(row.bitrix_contact_id) &&
        deal.UF_CRM_WG_BOOKING_REF === `WG-${row.id}`,
      "native_booking_mapping_mismatch",
    );
    identities.push([
      Number(row.id),
      Number(deal.ID),
      Number(deal.CONTACT_ID),
      deal.UF_CRM_WG_BOOKING_REF,
    ]);
  }
  return sha256(JSON.stringify(identities));
}

export function createSystemRuntime(checkInterrupted = () => {}) {
  const runtime = {
    checkInterrupted,
    async readPlan(options, stopped) {
      requireCondition(
        process.platform === "linux" && process.getuid() === 0,
        "linux_root_required",
      );
      for (const folder of [join(OPS, "scripts"), join(OPS, "migrations")])
        await securePath(folder, { directory: true });
      await securePath(ENVIRONMENT, { privateFile: true });
      await securePath(options.preparedEnv, { privateFile: true });
      const oldText = await fs.readFile(ENVIRONMENT, "utf8");
      const targetText = await fs.readFile(options.preparedEnv, "utf8");
      const environments = validateEnvironmentPair(oldText, targetText);
      requireCondition(
        releaseConfigurationProblems(environments.target).length === 0,
        "target_configuration_incomplete",
      );
      const previous = await currentRelease();
      requireCondition(previous !== options.target, "target_already_current");
      const oldHash = await releaseDigest(previous);
      const newHash = await releaseDigest(options.target);
      requireCondition(newHash === options.outputHash, "target_output_digest_mismatch");
      await securePath("/etc/systemd/system/white-gloss.service");
      requireCondition(
        sha256(await fs.readFile("/etc/systemd/system/white-gloss.service")) ===
          sha256(await fs.readFile(join(OPS, "ops/white-gloss.service"))),
        "main_service_contract_changed",
      );
      for (const [property, expected] of [
        ["DropInPaths", ""],
        ["NeedDaemonReload", "no"],
        ["EnvironmentFiles", "/etc/white-gloss/environment (ignore_errors=no)"],
      ]) {
        requireCondition(
          command("/usr/bin/systemctl", ["show", MAIN, `--property=${property}`, "--value"]) ===
            expected,
          "main_service_overrides_unreviewed",
        );
      }
      const writers = await writerInventory(options.writers);
      if (stopped)
        requireCondition(
          Object.values(writers.states).every((s) => s !== "active"),
          "writers_not_stopped",
        );
      else requireCondition(writers.states[MAIN] === "active", "previous_website_not_running");
      if (!stopped) await runtime.health(previous);
      const entries = {};
      for (const name of (await fs.readdir(join(OPS, "migrations")))
        .filter((n) => n.endsWith(".sql"))
        .sort()) {
        await securePath(join(OPS, "migrations", name));
        entries[name] = sha256(await fs.readFile(join(OPS, "migrations", name)));
      }
      const data = await database(environments.previous, async (client) => {
        const applied = (await client.query("SELECT name FROM _migrations ORDER BY name")).rows.map(
          (r) => r.name,
        );
        const pending = validateMigrationPlan(entries, applied);
        requireCondition(
          (await checkReleaseSchema((q) => client.query(q), applied)).length === 0,
          "previous_schema_incompatible",
        );
        // Probe prepared native credentials against the unchanged current database.
        const readiness = await inspect(
          { ...environments.target, BOOKING_OPERATIONS: "roapp" },
          client,
        );
        requireCondition(
          readiness.blockers.length === 0,
          `readiness_${readiness.blockers[0] || "failed"}`,
        );
        const mismatches = await client.query(`SELECT count(*) AS count FROM bookings b
          JOIN bitrix_sync_queue q ON q.booking_id=b.id AND q.shop_id=b.shop_id
          WHERE b.shop_id='white-gloss' AND b.status NOT IN ('abgelehnt','storniert','erledigt','nicht_erschienen')
          AND (b.bitrix_deal_id IS DISTINCT FROM q.bitrix_deal_id OR b.bitrix_contact_id IS DISTINCT FROM q.bitrix_contact_id OR q.bitrix_contact_id IS NULL
            OR q.synced_version < q.requested_version)`);
        const duplicates = await client.query(`SELECT bitrix_deal_id FROM bitrix_sync_queue
          WHERE shop_id='white-gloss' AND bitrix_deal_id IS NOT NULL
          GROUP BY bitrix_deal_id HAVING count(*)>1`);
        requireCondition(
          Number(mismatches.rows[0].count) === 0 && duplicates.rows.length === 0,
          "unresolved_bitrix_mapping",
        );
        const mapped = await client.query(`SELECT b.id, q.bitrix_deal_id, q.bitrix_contact_id
          FROM bookings b JOIN bitrix_sync_queue q ON q.booking_id=b.id AND q.shop_id=b.shop_id
          WHERE b.shop_id='white-gloss' AND b.status NOT IN ('abgelehnt','storniert','erledigt','nicht_erschienen') ORDER BY b.id`);
        const nativeMappingFingerprint = await verifyNativeMappings(
          environments.target.BITRIX_WEBHOOK_URL,
          mapped.rows,
        );
        const tables = (
          await client.query(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
          )
        ).rows;
        const digest = createHash("sha256");
        const tableInventory = {};
        for (const { tablename } of tables) {
          requireCondition(/^[a-z_][a-z0-9_]*$/.test(tablename), "unsupported_table_name");
          const rows = (
            await client.query(
              `SELECT to_jsonb(t)::text AS value FROM public."${tablename}" t ORDER BY to_jsonb(t)::text LIMIT 100001`,
            )
          ).rows;
          requireCondition(rows.length <= 100000, "inventory_too_large");
          digest.update(`${tablename}\n`);
          const tableDigest = createHash("sha256");
          for (const row of rows) {
            const value = `${Buffer.byteLength(row.value)}:${row.value}`;
            digest.update(value);
            tableDigest.update(value);
          }
          tableInventory[tablename] = { count: rows.length, hash: tableDigest.digest("hex") };
        }
        return {
          openCount: readiness.database.openBookings,
          dataFingerprint: digest.digest("hex"),
          tableInventory,
          appliedMigrations: applied,
          pendingMigrations: pending,
          nativeMappingFingerprint,
        };
      });
      return {
        currentRelease: previous,
        targetRelease: options.target,
        currentOutputHash: oldHash,
        targetOutputHash: newHash,
        oldText,
        targetText,
        environments,
        ...data,
        writerFingerprint: writers.fingerprint,
        writerStates: writers.states,
        writers: writers.units,
        migrationFingerprint: sha256(JSON.stringify(entries)),
        migrationEntries: entries,
      };
    },
    async lock() {
      return acquireDeployLock();
    },
    async stop(writers) {
      for (const units of [
        writers.filter((u) => u.endsWith(".timer")),
        writers.filter((u) => u !== MAIN && u.endsWith(".service")),
        [MAIN],
      ]) {
        for (const unit of units) {
          // Missing optional units are not started or installed by this helper.
          if (["active", "activating", "deactivating", "reloading"].includes(state(unit)))
            command("/usr/bin/systemctl", ["stop", unit]);
        }
      }
      requireCondition(
        writers.every((u) => ["inactive", "failed"].includes(state(u))),
        "writers_not_stopped",
      );
    },
    async backup(plan) {
      const stamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
      const path = `/var/backups/white-gloss/${stamp}`;
      const result = await backupProduction(`${path}/database.dump`, {
        env: plan.environments.previous,
      });
      requireCondition(result.ok && result.archiveListValid, "database_backup_not_verified");
      for (const [name, text] of [
        ["environment", plan.oldText],
        ["target-environment", plan.targetText],
      ]) {
        await writePrivateVerified(`${path}/${name}`, text);
        await securePath(`${path}/${name}`, { privateFile: true });
        requireCondition(
          (await fs.readFile(`${path}/${name}`, "utf8")) === text,
          "environment_backup_not_verified",
        );
      }
      const metadata = {
        previousRelease: plan.currentRelease,
        targetRelease: plan.targetRelease,
        previousOutputHash: plan.currentOutputHash,
        targetOutputHash: plan.targetOutputHash,
        writerStates: plan.writerStates,
        pendingMigrations: plan.pendingMigrations,
        databaseSha256: result.sha256,
        databaseBytes: result.bytes,
      };
      await writePrivateVerified(
        `${path}/release-and-services.json`,
        JSON.stringify(metadata, null, 2),
      );
      await securePath(`${path}/release-and-services.json`, { privateFile: true });
      await syncDirectory(path);
      await syncDirectory(dirname(path));
      return { path, verified: true };
    },
    async journal(backup, phase) {
      const path = `${backup.path}/cutover-state.json`;
      await writePrivateVerified(
        `${path}.next`,
        JSON.stringify({ phase, time: new Date().toISOString() }),
      );
      await fs.rename(`${path}.next`, path);
      await syncDirectory(backup.path);
    },
    async migrate(plan) {
      for (const name of plan.pendingMigrations)
        requireCondition(
          sha256(await fs.readFile(join(OPS, "migrations", name))) === COMPATIBLE_MIGRATIONS[name],
          "migration_changed",
        );
      const { runMigrations } = await import("./migrate.mjs");
      const { Pool } = createRequire(import.meta.url)("pg");
      // runMigrations locks the migration registry and applies each missing file
      // transactionally. It receives only the explicitly reviewed pending names.
      const pool = new Pool({
        connectionString: plan.environments.target.DATABASE_URL,
        max: 1,
        connectionTimeoutMillis: 5000,
        statement_timeout: 30000,
      });
      await runMigrations(pool, plan.pendingMigrations, false);
    },
    async verifySchema(plan, target) {
      const names = target ? Object.keys(plan.migrationEntries) : plan.appliedMigrations;
      await database(
        target ? plan.environments.target : plan.environments.previous,
        async (client) => {
          requireCondition(
            (await checkReleaseSchema((q) => client.query(q), names)).length === 0,
            "release_schema_check_failed",
          );
        },
      );
    },
    async verifyOriginal(plan) {
      requireCondition(
        (await fs.readFile(ENVIRONMENT, "utf8")) === plan.oldText &&
          (await currentRelease()) === plan.currentRelease,
        "original_pair_changed",
      );
      requireCondition(
        (await releaseDigest(plan.targetRelease)) === plan.targetOutputHash,
        "target_output_changed",
      );
    },
    async guardRecovery(plan) {
      const env = await fs.readFile(ENVIRONMENT, "utf8");
      const release = await currentRelease();
      requireCondition(
        [plan.oldText, plan.targetText].includes(env) &&
          [plan.currentRelease, plan.targetRelease].includes(release),
        "concurrent_change_recovery_blocked",
      );
      requireCondition(
        (await releaseDigest(plan.currentRelease)) === plan.currentOutputHash,
        "previous_release_changed",
      );
    },
    async swapEnvironment(text) {
      const next = `${ENVIRONMENT}.cutover-${process.pid}`;
      let created = false;
      try {
        const handle = await fs.open(next, "wx", 0o600);
        created = true;
        try {
          await handle.writeFile(text);
          await handle.sync();
        } finally {
          await handle.close();
        }
        requireCondition(
          (await fs.readFile(next, "utf8")) === text,
          "staged_environment_verification_failed",
        );
        await fs.rename(next, ENVIRONMENT);
        await syncDirectory(dirname(ENVIRONMENT));
      } finally {
        if (created)
          await fs.unlink(next).catch((e) => {
            if (e.code !== "ENOENT") throw e;
          });
      }
    },
    async swapRelease(release) {
      requireCondition(/^[0-9a-f]{40}$/.test(release), "invalid_release_id");
      const next = `${CURRENT}.cutover-${process.pid}`;
      let created = false;
      try {
        await fs.symlink(join(RELEASES, release), next);
        created = true;
        await fs.rename(next, CURRENT);
        await syncDirectory(dirname(CURRENT));
      } finally {
        if (created)
          await fs.unlink(next).catch((e) => {
            if (e.code !== "ENOENT") throw e;
          });
      }
    },
    async verifyPair(plan, target) {
      await securePath(ENVIRONMENT, { privateFile: true });
      const release = target ? plan.targetRelease : plan.currentRelease;
      requireCondition(
        (await fs.readFile(ENVIRONMENT, "utf8")) === (target ? plan.targetText : plan.oldText) &&
          (await currentRelease()) === release,
        "pair_verification_failed",
      );
      requireCondition(
        (await releaseDigest(release)) ===
          (target ? plan.targetOutputHash : plan.currentOutputHash),
        "release_output_changed",
      );
    },
    async startMain() {
      command("/usr/bin/systemctl", ["start", MAIN]);
    },
    async health(release) {
      let healthy = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        healthy = await fetch("http://127.0.0.1:3000/", {
          redirect: "error",
          signal: AbortSignal.timeout(2000),
        })
          .then((r) => r.ok)
          .catch(() => false);
        if (healthy) break;
        await new Promise((done) => setTimeout(done, 500));
      }
      requireCondition(healthy && state(MAIN) === "active", "website_healthcheck_failed");
      const pid = command("/usr/bin/systemctl", ["show", MAIN, "--property=MainPID", "--value"]);
      requireCondition(
        /^[1-9][0-9]*$/.test(pid) &&
          (await fs.realpath(`/proc/${pid}/cwd`)) === join(RELEASES, release),
        "wrong_running_release",
      );
    },
    async assertWorkersStopped(writers) {
      requireCondition(
        writers.filter((u) => u !== MAIN).every((u) => ["inactive", "failed"].includes(state(u))),
        "worker_started_before_acceptance",
      );
    },
    async startPrevious(plan) {
      if (plan.writerStates[MAIN] === "active") {
        await runtime.startMain();
        await runtime.health(plan.currentRelease);
      }
      for (const unit of plan.writers.filter(
        (u) => u !== MAIN && plan.writerStates[u] === "active",
      ))
        command("/usr/bin/systemctl", ["start", unit]);
    },
  };
  return runtime;
}
