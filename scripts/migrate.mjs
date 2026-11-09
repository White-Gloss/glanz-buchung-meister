#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * Run explicitly with `npm run db:migrate` against a confirmed DATABASE_URL,
 * separately from builds and read-only readiness checks. --dry-run reports
 * pending files without DDL. A targeted --only selection requires the complete
 * reviewed --expect-pending list; drift aborts before DDL. Each selected file is
 * applied and recorded in one transaction.
 *
 * The read is non-recursive, so the opt-in auth schema under migrations/auth/
 * is not applied to an app that never asked for sign-in.
 *
 * Missing configuration or an incompatible schema fails before any DDL. A new
 * empty application schema needs the explicit --initialize option. Local PGlite
 * previews apply their own isolated migrations (see src/lib/db.ts).
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import pg from "pg";
import { pendingMigrations } from "./migration-plan.mjs";
import { releaseColumnsQuery, schemaCompatibilityProblems } from "./release-policy.mjs";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/** Only messages created by our preflight may be shown verbatim. */
class MigrationPreflightError extends Error {}

/** @typedef {{dryRun?: boolean, only?: string[], expectedPending?: string[]}} MigrationOptions */

/** @param {string[]} names @param {boolean} allowEmpty */
function validateNames(names, allowEmpty) {
  if ((!allowEmpty && names.length === 0) || new Set(names).size !== names.length ||
      names.some((name) => !/^\d{4}_[a-zA-Z0-9_-]+\.sql$/.test(name))) {
    throw new MigrationPreflightError("Migrationslisten müssen eindeutige SQL-Dateinamen ohne Pfade enthalten.");
  }
}

/** @param {string[]} args */
export function parseMigrationArguments(args) {
  /** @type {MigrationOptions & {initialize: boolean}} */
  const options = { initialize: false, dryRun: false };
  const seen = new Set();
  for (const argument of args) {
    const [flag] = argument.split("=");
    if (seen.has(flag)) throw new MigrationPreflightError("Migrationsoptionen dürfen nicht mehrfach angegeben werden.");
    seen.add(flag);
    if (argument === "--initialize") options.initialize = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument.startsWith("--only=")) {
      options.only = argument.slice("--only=".length).split(",");
      validateNames(options.only, false);
    } else if (argument.startsWith("--expect-pending=")) {
      const value = argument.slice("--expect-pending=".length);
      options.expectedPending = value ? value.split(",") : [];
      validateNames(options.expectedPending, true);
    } else throw new MigrationPreflightError("Unbekannte Migrationsoption; erlaubt: --dry-run, --initialize, --only=Dateien, --expect-pending=Dateien.");
  }
  if (options.only && !options.expectedPending) {
    throw new MigrationPreflightError("--only benötigt --expect-pending mit der vollständig geprüften Liste aus --dry-run.");
  }
  return options;
}

/** @param {string[]} pending @param {MigrationOptions} options */
function selectMigrations(pending, options) {
  if (options.expectedPending) {
    validateNames(options.expectedPending, true);
    const expected = new Set(options.expectedPending);
    if (pending.length !== expected.size || pending.some((name) => !expected.has(name))) {
      throw new MigrationPreflightError("Ausstehende Migrationen weichen von --expect-pending ab; keine Migration ausgeführt. --dry-run erneut prüfen.");
    }
  }
  if (options.only) {
    validateNames(options.only, false);
    if (!options.expectedPending) {
      throw new MigrationPreflightError("Gezielte Migration benötigt die vollständig geprüfte Liste expectedPending.");
    }
    if (options.only.some((name) => !pending.includes(name))) {
      throw new MigrationPreflightError("Eine ausgewählte Migration fehlt oder wurde bereits angewendet; keine Migration ausgeführt.");
    }
    return pending.filter((name) => options.only?.includes(name));
  }
  return pending;
}

/** @param {unknown} error */
export function migrationFailureMessage(error) {
  if (error instanceof MigrationPreflightError) return error.message;
  if (error && typeof error === "object" && "code" in error) {
    const code = error.code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
      return `Datenbankoperation fehlgeschlagen (SQLSTATE ${code}).`;
    }
  }
  return "Migration fehlgeschlagen; Verbindung, Berechtigungen und Migrationsdateien prüfen. Keine Verbindungsdetails protokolliert.";
}

/**
 * @param {Pick<pg.Pool, 'connect' | 'end'>} pool
 * @param {string[]} entries
 * @param {boolean} initialize
 * @param {MigrationOptions} options
 */
export async function runMigrations(pool, entries, initialize = false, options = {}) {
  let client;
  let locked = false;
  try {
    client = await pool.connect();
    // Inspect the target before any DDL. The historical Supabase UUID schema is
    // a different application model and must never be partially migrated here.
    const columns = await client.query(releaseColumnsQuery);
    const problems = schemaCompatibilityProblems(columns.rows, {
      allowEmpty: initialize,
    });
    if (problems.length) throw new MigrationPreflightError(problems.join(" "));
    // Serialize concurrent deployments; release also occurs on disconnection.
    if (!options.dryRun) {
      await client.query("select pg_advisory_lock(814702061)");
      locked = true;
    }
    const registry = await client.query("select to_regclass('_migrations') as registry");
    const applied = registry.rows[0]?.registry
      ? (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name)
      : [];
    const pending = pendingMigrations(entries, applied).map(({ name }) => name);
    const selected = selectMigrations(pending, options);
    const plan = {
      dryRun: Boolean(options.dryRun),
      pending,
      selected,
      deferred: pending.filter((name) => !selected.includes(name)),
    };
    console.log(`[migrate] plan ${JSON.stringify(plan)}`);
    if (options.dryRun) return plan;
    // Read every selected file before the first write. A missing/unreadable
    // later file must not leave an earlier migration applied.
    const files = await Promise.all(selected.map(async (name) => ({
      name, text: await readFile(join(migrationsDir, name), "utf8"),
    })));
    if (files.length && !registry.rows[0]?.registry) {
      await client.query(
        "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
      );
    }

    let count = 0;
    for (const { name, text } of files) {
      try {
        await client.query("BEGIN");
        // pg's simple-query protocol runs a whole multi-statement file at once.
        await client.query(text);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (err) {
        console.error(`[migrate] error applying ${name}`);
        try {
          await client.query("ROLLBACK");
        } catch {
          // ROLLBACK fails when the connection died — keep the original error.
        }
        throw err;
      }
      console.log(`[migrate] applied ${name}`);
      count += 1;
    }
    console.log(
      count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.",
    );
    return plan;
  } finally {
    try {
      if (client) {
        if (locked) await client.query("select pg_advisory_unlock(814702061)").catch(() => {});
        client.release();
      }
    } finally {
      // A rejected pool.connect() still leaves a pool that must be closed.
      await pool.end();
    }
  }
}

async function main() {
  // Reject typos before opening a connection; silently ignoring --dryrun could
  // otherwise execute a production migration that was intended as an inspection.
  const options = parseMigrationArguments(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new MigrationPreflightError("DATABASE_URL fehlt; keine Migration ausgeführt.");
  }
  let entries;
  try {
    entries = await readdir(migrationsDir);
  } catch {
    throw new MigrationPreflightError(
      "Migrationsverzeichnis fehlt oder ist nicht lesbar; keine Migration ausgeführt.",
    );
  }
  if (pendingMigrations(entries, []).length === 0) {
    throw new MigrationPreflightError(
      "Keine Migrationsdateien gefunden; keine Migration ausgeführt.",
    );
  }
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 5000,
    statement_timeout: 30000,
  });
  await runMigrations(pool, entries, options.initialize, options);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[migrate] ${migrationFailureMessage(error)}`);
    process.exitCode = 1;
  });
}
