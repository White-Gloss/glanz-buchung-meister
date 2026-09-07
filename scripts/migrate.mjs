#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * Run explicitly with `npm run db:migrate` against a confirmed DATABASE_URL,
 * separately from builds and read-only readiness checks. Each pending file in
 * ../migrations is applied and recorded in one transaction.
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
 */
export async function runMigrations(pool, entries, initialize = false) {
  let client;
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
    await client.query("select pg_advisory_lock(814702061)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const applied = (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name);

    let count = 0;
    for (const { name } of pendingMigrations(entries, applied)) {
      const text = await readFile(join(migrationsDir, name), "utf8");
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
  } finally {
    try {
      if (client) {
        await client.query("select pg_advisory_unlock(814702061)").catch(() => {});
        client.release();
      }
    } finally {
      // A rejected pool.connect() still leaves a pool that must be closed.
      await pool.end();
    }
  }
}

async function main() {
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
  await runMigrations(pool, entries, process.argv.includes("--initialize"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[migrate] ${migrationFailureMessage(error)}`);
    process.exitCode = 1;
  });
}
