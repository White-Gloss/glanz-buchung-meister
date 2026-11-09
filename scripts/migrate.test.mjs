import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { migrationFailureMessage, parseMigrationArguments, runMigrations } from "./migrate.mjs";
import { releaseColumnsQuery } from "./release-policy.mjs";

const lateMigrations = [
  "0023_roapp_invoices.sql",
  "0024_qonto_webhook.sql",
  "0025_website_studio.sql",
];

test("migration CLI accepts a read-only plan and a fully reviewed targeted selection", () => {
  assert.deepEqual(parseMigrationArguments(["--dry-run"]), { initialize: false, dryRun: true });
  assert.deepEqual(parseMigrationArguments([
    `--expect-pending=${lateMigrations.join(",")}`,
    "--only=0025_website_studio.sql",
  ]), {
    initialize: false,
    dryRun: false,
    expectedPending: lateMigrations,
    only: ["0025_website_studio.sql"],
  });
  assert.deepEqual(parseMigrationArguments(["--expect-pending="]).expectedPending, []);
});

test("migration CLI rejects misspelled, duplicate, unsafe and incomplete options", () => {
  for (const args of [
    ["--dryrun"], ["--dry-run=true"], ["--dry-run", "--dry-run"],
    ["--initialize", "--initialize"], ["--only=0025_website_studio.sql"],
    ["--only=", "--expect-pending="],
    ["--only=../../private.sql", "--expect-pending="],
    ["--expect-pending=0025_website_studio.sql,0025_website_studio.sql"],
    ["--expect-pending=0025_website_studio.sql", "--expect-pending="],
    ["--expect-pending=private-password"],
  ]) {
    assert.throws(() => parseMigrationArguments(args), (error) => {
      assert.doesNotMatch(migrationFailureMessage(error), /private-password/);
      return true;
    }, JSON.stringify(args));
  }
});

function fakePool({ registry = true, applied = [] } = {}) {
  const queries = [];
  let released = 0;
  let ended = 0;
  const pool = {
    async connect() {
      return {
        async query(sql) {
          queries.push(sql);
          if (sql === releaseColumnsQuery) return { rows: [] }; // explicit --initialize in this fixture
          if (sql.includes("to_regclass")) return { rows: [{ registry: registry ? "_migrations" : null }] };
          if (sql === "SELECT name FROM _migrations") return { rows: applied.map((name) => ({ name })) };
          return { rows: [] };
        },
        release() { released += 1; },
      };
    },
    async end() { ended += 1; },
  };
  return { pool, queries, closed: () => ({ released, ended }) };
}

test("dry-run never creates a missing registry or acquires an advisory lock", async () => {
  const fixture = fakePool({ registry: false });
  const plan = await runMigrations(fixture.pool, lateMigrations, true, { dryRun: true });
  assert.deepEqual(plan.pending, lateMigrations);
  assert.deepEqual(plan.selected, lateMigrations);
  assert.deepEqual(plan.deferred, []);
  assert.equal(plan.dryRun, true);
  assert.ok(fixture.queries.every((sql) => /^select\b/i.test(sql.trim())));
  assert.ok(fixture.queries.every((sql) => !sql.includes("advisory")));
  assert.deepEqual(fixture.closed(), { released: 1, ended: 1 });
});

test("unexpected pending changes abort before any DDL, while releasing the migration lock", async () => {
  for (const applied of [[], ["0025_website_studio.sql"]]) {
    const fixture = fakePool({ applied });
    await assert.rejects(runMigrations(fixture.pool, lateMigrations, true, {
      only: ["0025_website_studio.sql"],
      expectedPending: ["0025_website_studio.sql"],
    }), /weichen von --expect-pending ab/);
    assert.ok(fixture.queries.every((sql) => /^select\b/i.test(sql.trim())));
    const lock = fixture.queries.indexOf("select pg_advisory_lock(814702061)");
    const history = fixture.queries.indexOf("SELECT name FROM _migrations");
    assert.ok(lock >= 0 && lock < history, "compare the registry after acquiring the migration lock");
    assert.equal(fixture.queries.at(-1), "select pg_advisory_unlock(814702061)");
    assert.deepEqual(fixture.closed(), { released: 1, ended: 1 });
  }
});

test("unknown/already-applied selection and omitted expectation cannot mutate the database", async () => {
  for (const options of [
    { only: ["0025_website_studio.sql"] },
    { only: ["0026_missing.sql"], expectedPending: lateMigrations },
    { only: ["0025_website_studio.sql", "0025_website_studio.sql"], expectedPending: lateMigrations },
    { only: ["../0025_website_studio.sql"], expectedPending: lateMigrations },
  ]) {
    const fixture = fakePool({ registry: false });
    await assert.rejects(runMigrations(fixture.pool, lateMigrations, true, options));
    assert.ok(fixture.queries.every((sql) => /^select\b/i.test(sql.trim())));
  }
});

test("an unreadable later file aborts before an earlier migration or registry is written", async () => {
  const fixture = fakePool({ registry: false });
  const entries = ["0025_website_studio.sql", "9999_missing_reviewed_file.sql"];
  await assert.rejects(runMigrations(fixture.pool, entries, true, {
    expectedPending: entries,
  }), { code: "ENOENT" });
  assert.ok(fixture.queries.every((sql) => /^select\b/i.test(sql.trim())));
  assert.deepEqual(fixture.closed(), { released: 1, ended: 1 });
});

async function withLegacyDatabase(check, { failRecord = false } = {}) {
  const db = new PGlite();
  const queries = [];
  const directory = new URL("../migrations/", import.meta.url);
  const entries = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  try {
    await db.exec("create table _migrations(name text primary key)");
    for (const name of entries.filter((name) => !lateMigrations.includes(name))) {
      await db.exec(await readFile(new URL(name, directory), "utf8"));
      await db.query("insert into _migrations values ($1)", [name]);
    }
    const pool = {
      async connect() {
        return {
          async query(sql, parameters) {
            queries.push(sql);
            // PGlite has no competing connection; only PostgreSQL's session
            // advisory lock is adapted. All DDL and transactions execute.
            if (sql.includes("pg_advisory_")) return { rows: [] };
            if (failRecord && sql.startsWith("INSERT INTO _migrations")) {
              throw Object.assign(new Error("synthetic registry failure"), { code: "23505" });
            }
            if (parameters || /^select\b/i.test(sql.trim())) return db.query(sql, parameters);
            await db.exec(sql);
            return { rows: [] };
          },
          release() {},
        };
      },
      async end() {},
    };
    await check({ db, pool, entries, queries });
  } finally {
    await db.close();
  }
}

test("targeted Studio migration leaves both unrelated pending migrations and legacy data untouched", async () => {
  await withLegacyDatabase(async ({ db, pool, entries }) => {
    await db.query("insert into cms_items(kind, title, body) values ('faq', 'Preserved question', 'Preserved answer')");
    const before = (await db.query("select id, kind, title, body from cms_items")).rows;
    const plan = await runMigrations(pool, entries, false, {
      only: ["0025_website_studio.sql"], expectedPending: lateMigrations,
    });
    assert.deepEqual(plan.selected, ["0025_website_studio.sql"]);
    assert.deepEqual(plan.deferred, lateMigrations.slice(0, 2));
    assert.deepEqual((await db.query("select id, kind, title, body from cms_items")).rows, before);
    assert.equal((await db.query("select to_regclass('cms_revisions') as name")).rows[0].name, "cms_revisions");
    const registry = (await db.query("select name from _migrations")).rows.map(({ name }) => name);
    assert.equal(registry.includes(lateMigrations[0]), false);
    assert.equal(registry.includes(lateMigrations[1]), false);
    assert.equal(registry.includes(lateMigrations[2]), true);
  });
});

test("a registry failure rolls back the whole selected migration", async () => {
  await withLegacyDatabase(async ({ db, pool, entries, queries }) => {
    await assert.rejects(runMigrations(pool, entries, false, {
      only: ["0025_website_studio.sql"], expectedPending: lateMigrations,
    }), { code: "23505" });
    assert.ok(queries.includes("ROLLBACK"));
    assert.equal((await db.query("select to_regclass('cms_revisions') as name")).rows[0].name, null);
    assert.equal((await db.query("select count(*)::int as count from _migrations where name = $1", [lateMigrations[2]])).rows[0].count, 0);
    assert.equal((await db.query("select count(*)::int as count from information_schema.columns where table_name = 'cms_items' and column_name = 'studio_key'")).rows[0].count, 0);
  }, { failRecord: true });
});
