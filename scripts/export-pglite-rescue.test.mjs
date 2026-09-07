import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseArguments, inventoryDatabase, compareInventories, loadExportTools,
  exportSnapshot, readBundle, targetConnection, verifyTarget } from "./export-pglite-rescue.mjs";

// Standalone recovery tools stay outside application dependencies. Provision the
// exact documented versions and set this variable when running outside the checkout.
const toolsRoot = process.env.PGLITE_RESCUE_TOOLS_ROOT || path.resolve("../pglite-rescue-tools");
const tools = loadExportTools(toolsRoot);
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hash = value => createHash("sha256").update(value).digest("hex");
const database = "white_gloss_recovery_test";

test("CLI requires sealed snapshot hash or an explicit recovery database and rejects extra options", () => {
  assert.equal(parseArguments(["export", "--snapshot", "file", "--sha256", "a".repeat(64), "--output-dir", "dir", "--tools-root", "tools"]).mode, "export");
  assert.throws(() => parseArguments(["import"]), /invalid_arguments/);
  assert.throws(() => parseArguments(["verify", "--bundle", "dir", "--expected-database", "production", "--pg-root", "root"]), /invalid_recovery_database_name/);
});

test("native target requires a separate local recovery URL and cannot fall back to production settings", () => {
  const valid = `postgresql://rescue_role:private-password@127.0.0.1:5432/${database}`;
  assert.equal(targetConnection(valid, database), valid);
  for (const value of [undefined, "", valid.replace("127.0.0.1", "external.example"),
    valid.replace(database, "production"), `${valid}?host=external.example`, `${valid}#ignored`]) {
    assert.throws(() => targetConnection(value, database), /explicit_local_recovery_target_required/);
  }
});

function poolFor(pg, { version, databaseName = database } = {}) {
  const queries = [];
  return { queries, connect: async () => ({
    async query(sql, values) {
      queries.push(sql);
      const result = await pg.query(sql, values);
      if (sql.includes("current_database() AS database")) {
        result.rows[0].database = databaseName;
        if (version) result.rows[0].version = version;
      }
      return result;
    }, release() {},
  }) };
}

test("empty-target guard rejects isolated custom schemas, enums, domains and routines without mutating the target", async () => {
  const pg = await tools.PGlite.create();
  const manifest = { nativePostgresMinimumMajor: 18 };
  try {
    assert.equal((await verifyTarget(poolFor(pg), manifest, database, "check-target")).empty, true);
    for (const [create, drop] of [
      ["CREATE SCHEMA rescue_empty", "DROP SCHEMA rescue_empty"],
      ["CREATE SCHEMA pgx_custom", "DROP SCHEMA pgx_custom"],
      ["CREATE TYPE public.rescue_choice AS ENUM ('pending')", "DROP TYPE public.rescue_choice"],
      ["CREATE DOMAIN public.rescue_text AS text", "DROP DOMAIN public.rescue_text"],
      ["CREATE FUNCTION public.rescue_constant() RETURNS integer LANGUAGE sql AS 'SELECT 1'", "DROP FUNCTION public.rescue_constant()"],
    ]) {
      await pg.exec(create);
      const pool = poolFor(pg);
      await assert.rejects(verifyTarget(pool, manifest, database, "check-target"), /recovery_target_not_empty/);
      assert.ok(pool.queries.includes("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"));
      assert.equal(pool.queries.at(-1), "ROLLBACK");
      assert.ok(pool.queries.every(query => !/^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(query)));
      await pg.exec(drop);
      assert.equal((await verifyTarget(poolFor(pg), manifest, database, "check-target")).empty, true);
    }
  } finally { await pg.close(); }
});

test("real legacy schema/auth/Qonto snapshot exports and restores with all row hashes and nine sequence states intact", { timeout: 35_000 }, async () => {
  const sandbox = await fs.mkdtemp(path.join(tmpdir(), "white-gloss-offline-rescue-"));
  const source = await tools.PGlite.create();
  let sqlRestored;
  try {
    await source.exec("CREATE TABLE _migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const migrationNames = (await fs.readdir(path.join(repository, "migrations"))).filter(name => /^000[1-6].*\.sql$/.test(name)).sort();
    for (const name of migrationNames) {
      await source.exec(await fs.readFile(path.join(repository, "migrations", name), "utf8"));
      await source.query("INSERT INTO _migrations(name) VALUES($1)", [name]);
    }
    await source.exec(`
      INSERT INTO "user"(id,name,email,"emailVerified") VALUES('auth-id','Private test name','private@example.invalid',true);
      INSERT INTO "session"(id,"expiresAt",token,"updatedAt","userId") VALUES('session-id','2030-01-01','private-session-token',now(),'auth-id');
      INSERT INTO "account"(id,"accountId","providerId","userId",password,"updatedAt") VALUES('account-id','auth-id','credential','auth-id','private-password-hash',now());
      INSERT INTO "verification"(id,identifier,value,"expiresAt","updatedAt") VALUES('verification-id','private-identifier','private-value','2030-01-01',now());
      INSERT INTO bookings(customer_name,phone,package_id,class_id,preferred_date,note,qonto_client_id,qonto_invoice_id,qonto_invoice_number,qonto_sent_at,upload_token_hash)
        VALUES('Private test name','private-phone','p','c','2026-09-10','Ää ß quotation '' and newline\nline2','qonto-customer-ref','qonto-invoice-ref','invoice-number','2026-09-07T10:12:13.123456Z','private-upload-hash');
      INSERT INTO customers(name,phone) VALUES('Private test name','private-phone');
      INSERT INTO documents(booking_id,customer_id,kind,title,body) VALUES(1,1,'invoice','Private document','private-body');
      INSERT INTO inbox_messages(channel,body,booking_id) VALUES('email','private-inbox',1);
      INSERT INTO outbound_queue(channel,body,booking_id) VALUES('email','private-outbound',1);
      INSERT INTO booking_photos(booking_id,storage_path,mime,size_bytes,original_name) VALUES(1,'private/storage/object','image/jpeg',123,'private-file.jpg');
      SELECT setval('bookings_id_seq',40,true);
      SELECT setval('cms_items_id_seq',7,false);
    `);
    const originalInventory = await inventoryDatabase(source);
    const tar = Buffer.from(await (await source.dumpDataDir("none")).arrayBuffer());
    const snapshot = path.join(sandbox, "database.tar");
    await fs.writeFile(snapshot, tar, { mode: 0o600, flag: "wx" });
    const output = path.join(sandbox, "bundle");
    const options = { snapshot, sha256: hash(tar), "output-dir": output, "tools-root": toolsRoot };
    const result = await exportSnapshot(options, tools);
    assert.equal(result.matched, true);
    assert.equal(result.sourceVersion, 180003);
    assert.equal(result.nativePostgresMinimumMajor, 18);
    assert.equal(result.sequences, 9);
    assert.doesNotMatch(JSON.stringify(result), /Private test name|private-phone|private-password|qonto-invoice-ref/);
    const manifest = await readBundle(output);
    assert.equal(manifest.snapshotSha256, hash(tar));
    assert.deepEqual(manifest.inventory.tables, originalInventory.tables);
    for (const original of originalInventory.sequences) {
      const recovered = manifest.inventory.sequences.find(s => s.schema === original.schema && s.name === original.name);
      // Postgres crash recovery may skip WAL-preallocated sequence values. Never
      // lower recovered values to MAX(id); the SQL roundtrip must keep this baseline.
      assert.ok(BigInt(recovered.last_value) >= BigInt(original.last_value));
      assert.deepEqual({ ...recovered, last_value: original.last_value }, original);
    }
    assert.doesNotMatch(JSON.stringify(manifest), /private-session-token|private-password-hash|qonto-invoice-ref|private-inbox/);
    assert.equal(hash(await fs.readFile(snapshot)), hash(tar), "sealed source remains unchanged");
    const sql = await fs.readFile(path.join(output, "database.sql"), "utf8");
    assert.match(sql, /SET transaction_timeout = 0;/, "actual exporter contains an unsupported PostgreSQL16 setting");
    assert.match(sql, /qonto-invoice-ref/);
    sqlRestored = await tools.PGlite.create();
    const emptyPool = poolFor(sqlRestored);
    assert.equal((await verifyTarget(emptyPool, manifest, database, "check-target")).empty, true);
    assert.ok(emptyPool.queries.includes("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"));
    await assert.rejects(verifyTarget(poolFor(sqlRestored, { version: 160000 }), manifest, database, "check-target"), /target_postgres_major_too_old/);
    await sqlRestored.exec(sql);
    assert.equal((await verifyTarget(poolFor(sqlRestored), manifest, database, "verify")).matched, true);
    await assert.rejects(verifyTarget(poolFor(sqlRestored), manifest, database, "check-target"), /recovery_target_not_empty/);
    const bookingSequence = manifest.inventory.sequences.find(s => s.name === "bookings_id_seq");
    assert.equal(bookingSequence.last_value, "40"); assert.equal(bookingSequence.is_called, true);
    const cmsSequence = manifest.inventory.sequences.find(s => s.name === "cms_items_id_seq");
    assert.equal(cmsSequence.last_value, "7"); assert.equal(cmsSequence.is_called, false);
    await sqlRestored.query("UPDATE public.bookings SET qonto_invoice_id='changed-reference' WHERE id=1");
    await assert.rejects(verifyTarget(poolFor(sqlRestored), manifest, database, "verify"), /table_schema_or_data_mismatch/);
    const changedSequence = structuredClone(manifest.inventory);
    changedSequence.sequences[0].last_value = "999";
    assert.throws(() => compareInventories(manifest.inventory, changedSequence), /sequence_state_or_ownership_mismatch/);
    await assert.rejects(exportSnapshot({ ...options, sha256: "f".repeat(64) }, tools), /snapshot_hash_mismatch/);
    await fs.appendFile(path.join(output, "database.sql"), "\n-- changed\n");
    await assert.rejects(readBundle(output), /invalid_or_modified_rescue_bundle/);
  } finally {
    await sqlRestored?.close(); await source.close();
    const checked = path.resolve(sandbox);
    assert.ok(checked.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(checked).startsWith("white-gloss-offline-rescue-"));
    await fs.rm(checked, { recursive: true, force: true });
  }
});
