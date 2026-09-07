#!/usr/bin/env node
/**
 * OFFLINE conversion only. Never imports app code, opens its live database,
 * applies migrations, imports into native PG, or sends provider requests.
 *
 * export --snapshot <file> --sha256 <sealed SHA256> --output-dir <NEW directory> --tools-root <directory>
 * check-target|verify --bundle <directory> --expected-database white_gloss_recovery_<suffix> --pg-root <directory>
 * Native target: RESCUE_TARGET_DATABASE_URL only, local TCP, explicit new DB name.
 * check-target and verify are READ ONLY. Import is a separate reviewed psql action.
 * Tested tools: @electric-sql/pglite@0.5.8 + @electric-sql/pglite-tools@0.4.8.
 */
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const LIMIT = 512 * 1024 * 1024;
const TOOL_VERSIONS = { pglite: "0.5.8", pgliteTools: "0.4.8" };
const quote = (value) => `"${value.replaceAll('"', '""')}"`;
const qualified = (schema, name) => `${quote(schema)}.${quote(name)}`;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export class RescueExportError extends Error {
  constructor(code) { super(code); this.code = code; }
}

export function parseArguments(args) {
  const mode = args[0];
  const allowed = mode === "export" ? ["snapshot", "sha256", "output-dir", "tools-root"]
    : ["check-target", "verify"].includes(mode) ? ["bundle", "expected-database", "pg-root"] : [];
  if (!allowed.length || args.length !== allowed.length * 2 + 1) throw new RescueExportError("invalid_arguments");
  const options = { mode };
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    if (args[i] !== `--${key}` || !allowed.includes(key) || Object.hasOwn(options, key) || !args[i + 1]) {
      throw new RescueExportError("invalid_arguments");
    }
    options[key] = args[i + 1];
  }
  if (mode === "export" && !/^[a-f0-9]{64}$/.test(options.sha256)) throw new RescueExportError("invalid_snapshot_hash");
  if (mode !== "export" && !/^white_gloss_recovery_[a-z0-9_]{1,40}$/.test(options["expected-database"])) {
    throw new RescueExportError("invalid_recovery_database_name");
  }
  return options;
}

async function readPrivateFile(path, limit = LIMIT) {
  const stat = await fs.lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > limit ||
      (process.platform !== "win32" && (stat.mode & 0o077))) throw new RescueExportError("input_file_not_private_regular_or_bounded");
  return fs.readFile(path);
}

async function writePrivateFile(path, bytes) {
  const handle = await fs.open(path, "wx", 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
}

async function newPrivateDirectory(path) {
  const absolute = resolve(path);
  const parent = await fs.realpath(dirname(absolute));
  if (join(parent, basename(absolute)) !== absolute) throw new RescueExportError("output_directory_has_symlink_parent");
  await fs.mkdir(absolute, { mode: 0o700 }); // Never reuses/overwrites a previous run.
  return absolute;
}

export async function inventoryDatabase(pg) {
  // Align rendering of dates, names, floats and JSON between both database engines.
  await pg.query("SET timezone = 'UTC'");
  await pg.query("SET datestyle = 'ISO, YMD'");
  await pg.query("SET extra_float_digits = 3");
  await pg.query("SET search_path = pg_catalog, public");
  const version = Number((await pg.query("SHOW server_version_num")).rows[0].server_version_num);
  if (!Number.isInteger(version) || version < 100000) throw new RescueExportError("invalid_source_version");
  const tables = (await pg.query(`SELECT table_schema AS schema, table_name AS name
    FROM information_schema.tables WHERE table_type='BASE TABLE'
    AND table_schema NOT IN ('pg_catalog','information_schema') AND table_schema NOT LIKE 'pg_%'
    ORDER BY table_schema COLLATE "C", table_name COLLATE "C"`)).rows;
  if (tables.length > 200) throw new RescueExportError("unexpected_table_count");
  const inventory = { version, major: Math.floor(version / 10000), tables: [], sequences: [] };
  for (const table of tables) {
    const columns = (await pg.query(`SELECT column_name AS name, udt_schema AS type_schema,
      udt_name AS type, is_nullable AS nullable, column_default AS default, is_identity AS identity,
      is_generated AS generated, generation_expression AS generation
      FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position`,
    [table.schema, table.name])).rows;
    const rows = (await pg.query(`SELECT to_jsonb(r)::text AS value FROM ${qualified(table.schema, table.name)} AS r
      ORDER BY (to_jsonb(r)::text) COLLATE "C" LIMIT 1000001`)).rows;
    if (rows.length > 1_000_000) throw new RescueExportError("table_too_large_for_bounded_verification");
    const digest = createHash("sha256");
    let bytes = 0;
    for (const row of rows) {
      if (typeof row.value !== "string") throw new RescueExportError("invalid_row_representation");
      const length = Buffer.byteLength(row.value);
      bytes += length;
      if (bytes > LIMIT) throw new RescueExportError("table_too_large_for_bounded_verification");
      digest.update(`${length}:`); digest.update(row.value);
    }
    const constraints = (await pg.query(`SELECT c.conname AS name, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname=$1 AND t.relname=$2 ORDER BY c.conname COLLATE "C"`, [table.schema, table.name])).rows;
    const indexes = (await pg.query(`SELECT indexname AS name, indexdef AS definition FROM pg_indexes
      WHERE schemaname=$1 AND tablename=$2 ORDER BY indexname COLLATE "C"`, [table.schema, table.name])).rows;
    inventory.tables.push({ ...table, count: rows.length, sha256: digest.digest("hex"), columns, constraints, indexes });
  }
  const sequences = (await pg.query(`SELECT n.nspname AS schema, c.relname AS name,
    s.seqstart::text AS start, s.seqincrement::text AS increment, s.seqmin::text AS min,
    s.seqmax::text AS max, s.seqcache::text AS cache, s.seqcycle AS cycle,
    tn.nspname AS owned_schema, t.relname AS owned_table, a.attname AS owned_column
    FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_depend d ON d.classid='pg_class'::regclass AND d.objid=c.oid
      AND d.refclassid='pg_class'::regclass AND d.deptype IN ('a','i')
    LEFT JOIN pg_class t ON t.oid=d.refobjid LEFT JOIN pg_namespace tn ON tn.oid=t.relnamespace
    LEFT JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid
    WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%'
    ORDER BY n.nspname COLLATE "C", c.relname COLLATE "C"`)).rows;
  for (const sequence of sequences) {
    const state = (await pg.query(`SELECT last_value::text AS last_value, is_called FROM ${qualified(sequence.schema, sequence.name)}`)).rows[0];
    inventory.sequences.push({ ...sequence, ...state });
  }
  return inventory;
}

export function compareInventories(expected, actual) {
  // Version may move forward; object structure and data may not silently change.
  if (actual.major < expected.major) throw new RescueExportError("target_postgres_major_too_old");
  if (JSON.stringify(expected.tables) !== JSON.stringify(actual.tables)) throw new RescueExportError("table_schema_or_data_mismatch");
  if (JSON.stringify(expected.sequences) !== JSON.stringify(actual.sequences)) throw new RescueExportError("sequence_state_or_ownership_mismatch");
  return { matched: true, tables: actual.tables.length, rows: actual.tables.reduce((n, t) => n + t.count, 0), sequences: actual.sequences.length };
}

function packageVersion(require, name) {
  // Package exports may hide package.json. Walk from the resolved trusted entry.
  let directory = dirname(require.resolve(name));
  for (let i = 0; i < 5; i++, directory = dirname(directory)) {
    try { const data = require(join(directory, "package.json")); if (data.name === name) return data.version; }
    catch { /* Entry directory may not have a package.json. */ }
  }
  throw new RescueExportError("tool_package_version_unavailable");
}

export function loadExportTools(root) {
  const require = createRequire(resolve(root, "package.json"));
  const versions = { pglite: packageVersion(require, "@electric-sql/pglite"),
    pgliteTools: packageVersion(require, "@electric-sql/pglite-tools") };
  if (JSON.stringify(versions) !== JSON.stringify(TOOL_VERSIONS)) throw new RescueExportError("unverified_export_tool_versions");
  return { PGlite: require("@electric-sql/pglite").PGlite,
    pgDump: require("@electric-sql/pglite-tools/pg_dump").pgDump, versions };
}

export async function exportSnapshot(options, tools = loadExportTools(options["tools-root"])) {
  const bytes = await readPrivateFile(resolve(options.snapshot));
  if (sha256(bytes) !== options.sha256) throw new RescueExportError("snapshot_hash_mismatch");
  // PGlite gets a Blob copy, never a live instance or a writable source dataDir.
  const source = await tools.PGlite.create({ loadDataDir: new Blob([bytes]) });
  let restored;
  try {
    const inventory = await inventoryDatabase(source);
    if (!inventory.tables.some((t) => t.schema === "public" && t.name === "bookings") ||
        !inventory.tables.some((t) => t.schema === "public" && t.name === "_migrations")) {
      throw new RescueExportError("not_a_white_gloss_snapshot");
    }
    const sql = await (await tools.pgDump({ pg: source, args: ["--no-owner", "--no-acl"], fileName: "database.sql" })).text();
    if (Buffer.byteLength(sql) > LIMIT || !sql.includes("PostgreSQL database dump complete")) throw new RescueExportError("invalid_sql_export");
    restored = await tools.PGlite.create();
    await restored.exec(sql);
    const verification = compareInventories(inventory, await inventoryDatabase(restored));
    const manifest = { format: "white-gloss-pglite-rescue-v1", tools: tools.versions,
      snapshotSha256: options.sha256, sqlSha256: sha256(sql), sqlBytes: Buffer.byteLength(sql),
      nativePostgresMinimumMajor: inventory.major, inventory, offlineRoundtrip: verification };
    const output = await newPrivateDirectory(options["output-dir"]);
    await writePrivateFile(join(output, "database.sql"), sql);
    await writePrivateFile(join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    return { ok: true, output, sqlSha256: manifest.sqlSha256, sqlBytes: manifest.sqlBytes,
      sourceVersion: inventory.version, nativePostgresMinimumMajor: inventory.major, ...verification };
  } finally { await restored?.close(); await source.close(); }
}

export async function readBundle(directory) {
  const manifest = JSON.parse(await readPrivateFile(join(resolve(directory), "manifest.json"), 4 * 1024 * 1024));
  const sql = await readPrivateFile(join(resolve(directory), "database.sql"));
  if (manifest.format !== "white-gloss-pglite-rescue-v1" || !manifest.offlineRoundtrip?.matched ||
      manifest.sqlBytes !== sql.length || manifest.sqlSha256 !== sha256(sql) ||
      !Number.isSafeInteger(manifest.inventory?.major) || manifest.nativePostgresMinimumMajor !== manifest.inventory.major ||
      !Array.isArray(manifest.inventory.tables) || !Array.isArray(manifest.inventory.sequences)) {
    throw new RescueExportError("invalid_or_modified_rescue_bundle");
  }
  return manifest;
}

export function targetConnection(raw, expectedDatabase) {
  if (!/^white_gloss_recovery_[a-z0-9_]{1,40}$/.test(expectedDatabase ?? "")) throw new RescueExportError("invalid_recovery_database_name");
  try {
    const url = new URL(raw ?? "");
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
        !url.username || url.hash || url.search || decodeURIComponent(url.pathname.slice(1)) !== expectedDatabase) throw new Error();
    return url.toString();
  } catch { throw new RescueExportError("explicit_local_recovery_target_required"); }
}

export async function verifyTarget(pool, manifest, expectedDatabase, mode) {
  if (!["check-target", "verify"].includes(mode)) throw new RescueExportError("invalid_verification_mode");
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL lock_timeout = '2s'");
    const identity = (await client.query(`SELECT current_database() AS database,
      current_setting('server_version_num')::int AS version,
      current_setting('transaction_read_only') = 'on' AS read_only`)).rows[0];
    if (identity.database !== expectedDatabase || !identity.read_only) throw new RescueExportError("recovery_target_identity_mismatch");
    if (Math.floor(identity.version / 10000) < manifest.nativePostgresMinimumMajor) throw new RescueExportError("target_postgres_major_too_old");
    let result;
    if (mode === "check-target") {
      const count = Number((await client.query(`SELECT count(*)::text AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%'`)).rows[0].count);
      const routines = Number((await client.query(`SELECT count(*)::text AS count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%'`)).rows[0].count);
      const schemas = Number((await client.query(`SELECT count(*)::text AS count FROM pg_namespace
        WHERE nspname NOT IN ('pg_catalog','information_schema','public') AND nspname !~ '^pg_'`)).rows[0].count);
      const types = Number((await client.query(`SELECT count(*)::text AS count FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_'`)).rows[0].count);
      if (count !== 0 || routines !== 0 || schemas !== 0 || types !== 0) throw new RescueExportError("recovery_target_not_empty");
      result = { ok: true, empty: true, targetVersion: identity.version };
    } else result = { ok: true, ...compareInventories(manifest.inventory, await inventoryDatabase(client)) };
    await client.query("ROLLBACK");
    return result;
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client.release(); }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  process.umask(0o077);
  if (options.mode === "export") return exportSnapshot(options);
  const manifest = await readBundle(options.bundle);
  const connectionString = targetConnection(process.env.RESCUE_TARGET_DATABASE_URL, options["expected-database"]);
  const require = createRequire(resolve(options["pg-root"], "package.json"));
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 });
  try { return await verifyTarget(pool, manifest, options["expected-database"], options.mode); }
  finally { await pool.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await main())); }
  catch (error) {
    // Never print raw pg_dump/SQL/Postgres diagnostics: they may contain row data.
    console.error(JSON.stringify({ ok: false, code: error instanceof RescueExportError ? error.code : "offline_rescue_failed" }));
    process.exitCode = 1;
  }
}
