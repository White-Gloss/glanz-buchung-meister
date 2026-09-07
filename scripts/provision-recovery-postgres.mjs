#!/usr/bin/env node
/** Prepare a NEW local PG18+ recovery role/database, never the live application config.
 * Linux root: --name white_gloss_recovery_<suffix> --directory /var/backups/white-gloss/YYYYMMDDTHHMMSSZ --pg-root <readable installed dependencies>
 * The protected target.env is retained on failure: partial DDL is never dropped/retried.
 */
import * as fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const failureCodes = [
  "invalid_worker_input",
  "expected_local_pg18_admin",
  "recovery_target_already_exists",
  "recovery_provision_failed",
  "recovery_target_verification_failed",
  "postgres_child_unavailable",
  "postgres_child_timeout_partial_target_possible",
  "invalid_postgres_child_output",
  "postgres_child_failed",
];

export function validateOptions(options) {
  if (!/^white_gloss_recovery_[a-z0-9][a-z0-9_]{0,31}$/.test(options.name ?? ""))
    throw new Error("invalid_recovery_name");
  if (!/^\/var\/backups\/white-gloss\/\d{8}T\d{6}Z$/.test(options.directory ?? ""))
    throw new Error("invalid_recovery_directory");
  if (
    typeof options.pgRoot !== "string" ||
    !options.pgRoot.startsWith("/") ||
    options.pgRoot.includes("\0") ||
    options.pgRoot.split("/").includes("..")
  )
    throw new Error("invalid_pg_root");
  return options;
}

export function parseArguments(args) {
  if (
    args.length !== 6 ||
    args[0] !== "--name" ||
    args[2] !== "--directory" ||
    args[4] !== "--pg-root"
  )
    throw new Error("invalid_arguments");
  return validateOptions({ name: args[1], directory: args[3], pgRoot: args[5] });
}

// Self-contained for the fixed stdin program sent to the postgres OS account.
export async function provisionWithClient(client, name, password, crypto) {
  let stage = "connect";
  const created = { role: false, database: false };
  try {
    if (
      !/^white_gloss_recovery_[a-z0-9][a-z0-9_]{0,31}$/.test(name) ||
      !/^[0-9a-f]{64}$/.test(password)
    )
      return { ok: false, code: "invalid_worker_input", created };
    await client.connect();
    stage = "inspect";
    const context = (
      await client.query(
        "SELECT current_user AS username, inet_server_addr() IS NULL AS local_socket, current_setting('server_version_num')::int AS version, (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser",
      )
    ).rows[0];
    if (
      context?.username !== "postgres" ||
      context.local_socket !== true ||
      context.superuser !== true ||
      !Number.isInteger(context.version) ||
      context.version < 180000
    )
      return { ok: false, code: "expected_local_pg18_admin", created };
    const existing = (
      await client.query(
        "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1) AS role_exists, EXISTS(SELECT 1 FROM pg_database WHERE datname=$1) AS database_exists",
        [name],
      )
    ).rows[0];
    if (!existing || existing.role_exists !== false || existing.database_exists !== false)
      return { ok: false, code: "recovery_target_already_exists", created };
    // No plaintext password enters SQL; PostgreSQL accepts SCRAM verifiers as-is.
    // Also suppress statement/error-parameter logging for this administrative session.
    await client.query(
      "SELECT set_config('log_statement','none',false), set_config('log_min_duration_statement','-1',false), set_config('log_min_duration_sample','-1',false), set_config('log_min_error_statement','panic',false), set_config('log_parameter_max_length_on_error','0',false)",
    );
    const salt = crypto.randomBytes(16);
    const salted = crypto.pbkdf2Sync(password, salt, 4096, 32, "sha256");
    const clientKey = crypto.createHmac("sha256", salted).update("Client Key").digest();
    const storedKey = crypto.createHash("sha256").update(clientKey).digest("base64");
    const serverKey = crypto.createHmac("sha256", salted).update("Server Key").digest("base64");
    const verifier = `SCRAM-SHA-256$4096:${salt.toString("base64")}$${storedKey}:${serverKey}`;
    stage = "create_role";
    await client.query(
      `CREATE ROLE "${name}" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '${verifier}'`,
    );
    created.role = true;
    stage = "create_database";
    await client.query(
      `CREATE DATABASE "${name}" WITH OWNER "${name}" TEMPLATE template0 ENCODING 'UTF8'`,
    );
    created.database = true;
    await client.query(`REVOKE ALL ON DATABASE "${name}" FROM PUBLIC`);
    stage = "verify";
    const result = (
      await client.query(
        "SELECT r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolinherit AND NOT r.rolreplication AND NOT r.rolbypassrls AND d.datdba=r.oid AS valid FROM pg_roles r JOIN pg_database d ON d.datname=r.rolname WHERE r.rolname=$1",
        [name],
      )
    ).rows[0];
    if (result?.valid !== true)
      return { ok: false, code: "recovery_target_verification_failed", created };
    return { ok: true, major: Math.floor(context.version / 10000), created };
  } catch {
    return { ok: false, code: "recovery_provision_failed", stage, created };
  } finally {
    try {
      await client.end();
    } catch {
      /* Never expose driver diagnostics. */
    }
  }
}

export function childProgram() {
  return `import { createRequire } from 'node:module';
import * as crypto from 'node:crypto';
try {
  const pg = createRequire(process.env.RESCUE_PG_ROOT + '/package.json')('pg');
  const client = new pg.Client({host:'/var/run/postgresql',port:5432,user:'postgres',database:'postgres',password:undefined,connectionTimeoutMillis:5000,statement_timeout:10000,lock_timeout:3000,query_timeout:12000,application_name:'white-gloss-recovery-provision'});
  client.on('error', () => {});
  const result = await (${provisionWithClient.toString()})(client, process.env.RESCUE_DB_NAME, process.env.RESCUE_DB_PASSWORD, crypto);
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
} catch { console.log(JSON.stringify({ok:false,code:'postgres_child_unavailable'})); process.exitCode=1; }
`;
}

export function runPostgresChild(options, password, spawnProcess = spawn) {
  return new Promise((accept) => {
    let stdout = "";
    let settled = false;
    const child = spawnProcess(
      "/usr/sbin/runuser",
      ["-u", "postgres", "--", "/usr/bin/node", "--input-type=module", "-"],
      {
        cwd: "/",
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          PATH: "/usr/bin:/bin",
          LANG: "C",
          RESCUE_PG_ROOT: options.pgRoot,
          RESCUE_DB_NAME: options.name,
          RESCUE_DB_PASSWORD: password,
        },
      },
    );
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      accept(result);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ ok: false, code: "postgres_child_timeout_partial_target_possible" });
    }, 45000);
    child.stdout.on("data", (data) => {
      stdout += data;
      if (stdout.length > 4096) {
        child.kill("SIGKILL");
        finish({ ok: false, code: "invalid_postgres_child_output" });
      }
    });
    child.stderr.on("data", () => {});
    child.stdin.on("error", () => {});
    child.on("error", () => finish({ ok: false, code: "postgres_child_unavailable" }));
    child.on("close", (code) => {
      try {
        const result = JSON.parse(stdout);
        if (code !== 0 || result.ok !== true)
          return finish({
            ok: false,
            code: failureCodes.includes(result.code) ? result.code : "postgres_child_failed",
          });
        if (
          !Number.isInteger(result.major) ||
          result.major < 18 ||
          result.created?.role !== true ||
          result.created?.database !== true
        )
          throw new Error();
        finish({ ok: true, major: result.major });
      } catch {
        finish({ ok: false, code: "invalid_postgres_child_output" });
      }
    });
    child.stdin.end(childProgram());
  });
}

async function secureDirectory(directory, io) {
  let cursor = "";
  for (const part of directory.split("/").filter(Boolean)) {
    cursor += `/${part}`;
    let stat;
    try {
      stat = await io.lstat(cursor);
    } catch (error) {
      if (error.code !== "ENOENT" || !cursor.startsWith("/var/backups/white-gloss"))
        throw new Error("backup_directory_unavailable");
      await io.mkdir(cursor, { mode: 0o700 });
      stat = await io.lstat(cursor);
    }
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== 0 ||
      stat.mode & 0o022 ||
      (cursor.startsWith("/var/backups/white-gloss") && (stat.mode & 0o777) !== 0o700)
    )
      throw new Error("backup_directory_not_private");
  }
}

export async function provisionRecovery(options, deps = {}) {
  let credentialFile;
  try {
    validateOptions(options);
    if ((deps.platform ?? process.platform) !== "linux" || (deps.uid ?? process.getuid?.()) !== 0)
      throw new Error("linux_root_required");
    const io = deps.io ?? fs;
    await secureDirectory(options.directory, io);
    const password = (deps.randomBytes ?? randomBytes)(32).toString("hex");
    if (!/^[0-9a-f]{64}$/.test(password)) throw new Error("password_generation_failed");
    const filename = `${options.directory}/target.env`;
    const handle = await io.open(filename, "wx", 0o600);
    try {
      await handle.chmod(0o600);
      await handle.writeFile(
        `RESCUE_TARGET_DATABASE_URL=postgresql://${options.name}:${password}@127.0.0.1:5432/${options.name}\n`,
        "utf8",
      );
      await handle.sync();
    } finally {
      await handle.close();
    }
    const directoryHandle = await io.open(options.directory, "r");
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
    credentialFile = filename;
    const result = await (deps.run ?? runPostgresChild)(options, password);
    return {
      ok: result.ok === true,
      ...(result.ok
        ? { major: result.major }
        : {
            code: failureCodes.includes(result.code)
              ? result.code
              : "provision_incomplete_inspect_before_retry",
          }),
      credentialFile,
    };
  } catch {
    return {
      ok: false,
      code: "provision_not_completed",
      ...(credentialFile ? { credentialFile } : {}),
    };
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await provisionRecovery(parseArguments(process.argv.slice(2)));
    console.log(JSON.stringify(result));
    process.exitCode = result.ok ? 0 : 1;
  } catch {
    console.error(JSON.stringify({ ok: false, code: "invalid_arguments" }));
    process.exitCode = 1;
  }
}
