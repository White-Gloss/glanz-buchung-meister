#!/usr/bin/env node
/** Import one verified offline bundle into its explicit NEW local recovery DB.
 * Linux root: --bundle <private backup bundle> --expected-database white_gloss_recovery_<suffix>
 * --target-env /var/backups/white-gloss/YYYYMMDDTHHMMSSZ/target.env --pg-root <dependencies>
 * Never reads the live EnvironmentFile, starts the app, migrates, retries or drops anything.
 * An exclusive private log remains after every attempted import, including failure.
 */
import * as fs from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBundle, targetConnection, verifyTarget } from "./export-pglite-rescue.mjs";
import { parseTargetEnvironment } from "./stage-recovery-environment.mjs";
import { validateOptions as validateProvisionOptions } from "./provision-recovery-postgres.mjs";

class ImportError extends Error {}
function fail(code) {
  throw new ImportError(code);
}

export function validateOptions(options) {
  if (!/^\/var\/backups\/white-gloss\/\d{8}T\d{6}Z\/target\.env$/.test(options.targetEnv ?? ""))
    fail("invalid_target_environment_path");
  validateProvisionOptions({
    name: options.expectedDatabase,
    directory: posix.dirname(options.targetEnv),
    pgRoot: options.pgRoot,
  });
  if (
    typeof options.bundle !== "string" ||
    !/^\/var\/backups\/white-gloss\/\d{8}T\d{6}Z\//.test(options.bundle) ||
    options.bundle
      .split("/")
      .some(
        (part, index) =>
          index && (!/^[A-Za-z0-9_.-]+$/.test(part) || part === "." || part === ".."),
      )
  )
    fail("invalid_bundle_path");
  return options;
}

export function parseArguments(args) {
  if (
    args.length !== 8 ||
    args[0] !== "--bundle" ||
    args[2] !== "--expected-database" ||
    args[4] !== "--target-env" ||
    args[6] !== "--pg-root"
  )
    fail("invalid_arguments");
  return validateOptions({
    bundle: args[1],
    expectedDatabase: args[3],
    targetEnv: args[5],
    pgRoot: args[7],
  });
}

async function privateDirectory(path, io) {
  let cursor = "";
  for (const part of path.split("/").filter(Boolean)) {
    cursor += `/${part}`;
    const stat = await io.lstat(cursor);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== 0 ||
      stat.mode & 0o022 ||
      (cursor.startsWith("/var/backups/white-gloss") && (stat.mode & 0o777) !== 0o700)
    )
      fail("backup_directory_not_private");
  }
}

async function privateFile(path, limit, io) {
  const stat = await io.lstat(path);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1 ||
    stat.uid !== 0 ||
    (stat.mode & 0o777) !== 0o600 ||
    stat.size < 1 ||
    stat.size > limit
  )
    fail("backup_file_not_private_or_bounded");
  return stat;
}

async function readTargetEnvironment(path, io) {
  const before = await privateFile(path, 4096, io);
  const handle = await io.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (opened.dev !== before.dev || opened.ino !== before.ino) fail("target_environment_changed");
    const bytes = Buffer.alloc(4097);
    let used = 0;
    while (used < bytes.length) {
      const { bytesRead } = await handle.read(bytes, used, bytes.length - used, used);
      if (!bytesRead) break;
      used += bytesRead;
    }
    const after = await handle.stat();
    if (
      used !== before.size ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs
    )
      fail("target_environment_changed");
    return parseTargetEnvironment(bytes.subarray(0, used));
  } finally {
    await handle.close();
  }
}

export function psqlInvocation(connectionString, expectedDatabase, sqlFile, logFd) {
  // Reuse the same strict canonical target format as environment staging.
  const raw = parseTargetEnvironment(
    Buffer.from(`RESCUE_TARGET_DATABASE_URL=${connectionString}\n`),
  );
  const url = new URL(targetConnection(raw, expectedDatabase));
  return {
    command: "/usr/lib/postgresql/18/bin/psql",
    args: [
      "-X",
      "--no-password",
      "--single-transaction",
      "--set",
      "ON_ERROR_STOP=1",
      "--file",
      sqlFile,
    ],
    options: {
      cwd: "/",
      shell: false,
      stdio: ["ignore", logFd, logFd],
      env: {
        PATH: "/usr/bin:/bin",
        LANG: "C",
        PGHOST: url.hostname,
        PGPORT: url.port,
        PGDATABASE: expectedDatabase,
        PGUSER: url.username,
        PGPASSWORD: url.password,
        PGCONNECT_TIMEOUT: "5",
        PGSSLMODE: "disable",
        PGAPPNAME: "white-gloss-recovery-import",
      },
    },
  };
}

export function runPsql(invocation, spawnProcess = spawn) {
  return new Promise((accept) => {
    let child;
    try {
      child = spawnProcess(invocation.command, invocation.args, invocation.options);
    } catch {
      accept({ ok: false });
      return;
    }
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, 180000);
    child.on("error", () => {
      clearTimeout(timer);
      accept({ ok: false });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      accept({ ok: !timedOut && code === 0 });
    });
  });
}

function createPool(pgRoot, connectionString) {
  const { Pool } = createRequire(resolve(pgRoot, "package.json"))("pg");
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000,
    ssl: false,
    options: "",
    application_name: "white-gloss-recovery-verify",
  });
  // Idle socket errors must not print raw driver diagnostics or leave an unhandled event.
  pool.on("error", () => {});
  return pool;
}

export async function importRecovery(options, deps = {}) {
  const io = deps.io ?? fs;
  let stage = "preflight",
    pool,
    log,
    logFile;
  try {
    validateOptions(options);
    if ((deps.platform ?? process.platform) !== "linux" || (deps.uid ?? process.getuid?.()) !== 0)
      fail("linux_root_required");
    await privateDirectory(options.bundle, io);
    await privateDirectory(posix.dirname(options.targetEnv), io);
    await privateFile(`${options.bundle}/manifest.json`, 4 * 1024 * 1024, io);
    await privateFile(`${options.bundle}/database.sql`, 512 * 1024 * 1024, io);
    const connectionString = targetConnection(
      await readTargetEnvironment(options.targetEnv, io),
      options.expectedDatabase,
    );
    const manifest = await (deps.readBundle ?? readBundle)(options.bundle);
    pool = (deps.createPool ?? createPool)(options.pgRoot, connectionString);
    stage = "check_target";
    const check = await (deps.verifyTarget ?? verifyTarget)(
      pool,
      manifest,
      options.expectedDatabase,
      "check-target",
    );
    if (
      check.ok !== true ||
      check.empty !== true ||
      !Number.isInteger(check.targetVersion) ||
      check.targetVersion < 180000
    )
      fail("empty_pg18_target_required");
    stage = "prepare_log";
    const path = `${options.bundle}/import-postgres.log`;
    log = await io.open(path, "wx", 0o600); // Existing/partial logs prohibit a repeated import.
    logFile = path;
    await log.chmod(0o600);
    await log.sync();
    const directory = await io.open(
      options.bundle,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
    stage = "import";
    const result = await (deps.runPsql ?? runPsql)(
      psqlInvocation(
        connectionString,
        options.expectedDatabase,
        `${options.bundle}/database.sql`,
        log.fd,
      ),
    );
    await log.sync();
    if (result.ok !== true) fail("import_failed_inspect_private_log_before_retry");
    stage = "verify";
    const verification = await (deps.verifyTarget ?? verifyTarget)(
      pool,
      manifest,
      options.expectedDatabase,
      "verify",
    );
    if (verification.ok !== true || verification.matched !== true)
      fail("import_verification_failed");
    return {
      ok: true,
      verified: true,
      logFile,
      database: options.expectedDatabase,
      tables: verification.tables,
      rows: verification.rows,
      sequences: verification.sequences,
    };
  } catch (error) {
    return {
      ok: false,
      stage,
      code: error instanceof ImportError ? error.message : "recovery_import_not_completed",
      ...(logFile ? { logFile } : {}),
    };
  } finally {
    // Preserve target and log on every failure. No second import or cleanup DDL.
    if (log) {
      try {
        await log.sync();
      } catch {}
      try {
        await log.close();
      } catch {}
    }
    if (pool) {
      try {
        await pool.end();
      } catch {}
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let result;
  try {
    process.umask(0o077);
    result = await importRecovery(parseArguments(process.argv.slice(2)));
  } catch {
    result = { ok: false, code: "invalid_arguments" };
  }
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
}
