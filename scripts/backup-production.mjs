#!/usr/bin/env node
// Run as root with systemd EnvironmentFile=/etc/white-gloss/environment and UMask=0077.
// Usage: node backup-production.mjs /var/backups/white-gloss/20260907T120000Z/database.dump
// Also accepts /root/wg-backup-20260907T120000Z/database.dump. No restore is performed.
// pg_dump's documented PGDATABASE fallback is a database name, not a reliable URI input:
// https://www.postgresql.org/docs/current/app-pgdump.html
// https://www.postgresql.org/docs/current/libpq-envars.html
import * as fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

class BackupError extends Error {}
/** @param {string} output */
export function validBackupPath(output) {
  return /^(?:\/var\/backups\/white-gloss\/\d{8}T\d{6}Z|\/root\/wg-backup-\d{8}T\d{6}Z)\/database\.dump$/.test(
    output,
  );
}

/** Only child environment variables carry connection values; never command arguments.
 * @param {string | undefined} raw
 */
export function postgresEnvironment(raw) {
  try {
    const url = new URL(raw?.trim() || "");
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      url.pathname.length < 2 ||
      url.hash
    )
      throw new Error();
    const queryKeys = {
      sslmode: "PGSSLMODE",
      sslrootcert: "PGSSLROOTCERT",
      sslcert: "PGSSLCERT",
      sslkey: "PGSSLKEY",
      options: "PGOPTIONS",
      channel_binding: "PGCHANNELBINDING",
      connect_timeout: "PGCONNECT_TIMEOUT",
      application_name: "PGAPPNAME",
    };
    const environment = {
      PATH: "/usr/bin:/bin",
      LANG: "C",
      PGCONNECT_TIMEOUT: "10",
      PGPASSFILE: "/dev/null",
      PGHOST: url.hostname.replace(/^\[|\]$/g, ""),
      PGPORT: url.port || "5432",
      PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
    };
    for (const [key, value] of url.searchParams) {
      if (!Object.hasOwn(queryKeys, key) || url.searchParams.getAll(key).length !== 1)
        throw new Error();
      environment[queryKeys[key]] = value;
    }
    if (Object.values(environment).some((value) => /[\0\r\n]/.test(value))) throw new Error();
    return environment;
  } catch {
    throw new BackupError("database_configuration_invalid_or_unsupported_option");
  }
}

/** @param {string} command @param {string[]} args @param {any} options @param {typeof spawn} [spawnProcess] */
export function runBackupTool(command, args, options, spawnProcess = spawn) {
  return new Promise((resolveRun, reject) => {
    if (options.timeoutMs <= 0) return reject(new BackupError("backup_timeout"));
    const child = spawnProcess(command, args, {
      env: options.env,
      stdio: ["ignore", options.stdout ?? "ignore", "pipe"],
      shell: false,
    });
    let warnings = false;
    child.stderr?.on("data", () => {
      warnings = true;
    }); // Drain, never print provider/DB diagnostics.
    const timer = setTimeout(
      () => {
        child.kill("SIGKILL");
        reject(new BackupError("backup_timeout"));
      },
      Math.max(1, options.timeoutMs),
    );
    child.once("error", () => {
      clearTimeout(timer);
      reject(new BackupError("backup_tool_unavailable"));
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolveRun({ warnings });
      else reject(new BackupError("backup_tool_failed"));
    });
  });
}

/** @param {string} output @param {any} io */
async function secureDirectory(output, io) {
  const directory = posix.dirname(output);
  let cursor = "";
  for (const component of directory.split("/").filter(Boolean)) {
    cursor += `/${component}`;
    let stat;
    try {
      stat = await io.lstat(cursor);
    } catch (error) {
      if (
        error.code !== "ENOENT" ||
        !(cursor.startsWith("/var/backups/white-gloss") || cursor.startsWith("/root/wg-backup-"))
      )
        throw new BackupError("backup_directory_unavailable");
      await io.mkdir(cursor, { mode: 0o700 });
      stat = await io.lstat(cursor);
    }
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== 0 ||
      stat.mode & 0o022 ||
      (cursor === directory && stat.mode & 0o077)
    )
      throw new BackupError("backup_directory_not_private");
  }
}

/** @param {string} output @param {{env?: NodeJS.ProcessEnv, io?: any, run?: typeof runBackupTool, uid?: number}} [options] */
export async function backupProduction(
  output,
  { env = process.env, io = fs, run = runBackupTool, uid = process.getuid?.() } = {},
) {
  if (uid !== 0 || !validBackupPath(output))
    throw new BackupError("backup_requires_root_and_approved_output_path");
  const environment = postgresEnvironment(env.DATABASE_URL);
  await secureDirectory(output, io);
  let file;
  try {
    file = await io.open(output, "wx+", 0o600);
  } catch (error) {
    throw new BackupError(
      error.code === "EEXIST" ? "backup_already_exists" : "backup_file_unavailable",
    );
  }
  const deadline = Date.now() + 120_000;
  try {
    const dump = await run(
      "/usr/bin/pg_dump",
      ["-Fc", "--no-password", "--lock-wait-timeout=10000"],
      { env: environment, stdout: file.fd, timeoutMs: deadline - Date.now() },
    );
    await file.sync();
    const stat = await file.stat();
    if (!stat.isFile() || stat.size <= 0 || stat.mode & 0o077)
      throw new BackupError("backup_file_invalid");
    const listing = await run("/usr/bin/pg_restore", ["--list", output], {
      env: { PATH: "/usr/bin:/bin", LANG: "C" },
      timeoutMs: deadline - Date.now(),
    });
    const hash = createHash("sha256");
    for await (const chunk of file.createReadStream({ start: 0, autoClose: false })) {
      if (Date.now() >= deadline) throw new BackupError("backup_timeout");
      hash.update(chunk);
    }
    return {
      ok: true,
      output,
      bytes: stat.size,
      sha256: hash.digest("hex"),
      archiveListValid: true,
      warnings: dump.warnings || listing.warnings,
    };
  } finally {
    await file.close();
  } // A failed partial file stays private and is never overwritten.
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  try {
    if (process.argv.length !== 3) throw new BackupError("one_explicit_output_path_required");
    console.log(JSON.stringify(await backupProduction(process.argv[2])));
  } catch (error) {
    console.error(
      JSON.stringify({
        ok: false,
        code: error instanceof BackupError ? error.message : "backup_failed",
        partialBackupMayExist: true,
      }),
    );
    process.exitCode = 1;
  }
}
