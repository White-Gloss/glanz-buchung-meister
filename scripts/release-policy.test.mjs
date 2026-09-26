import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { migrationFailureMessage, runMigrations } from "./migrate.mjs";
import {
  checkReleaseSchema,
  releaseConfigurationProblems,
  schemaCompatibilityProblems,
} from "./release-policy.mjs";

test("missing or unsafe runtime settings are rejected without leaking their values", () => {
  const valid = {
    DATABASE_URL: "postgres://user:private-password@localhost/app",
    BETTER_AUTH_SECRET: "a".repeat(32),
    SUPABASE_SERVICE_ROLE_KEY: "private-key",
    SUPABASE_URL: "https://storage.example.invalid",
    RESEND_API_KEY: "private-mail-key",
    MAIL_FROM: "test@example.invalid",
  };
  assert.deepEqual(releaseConfigurationProblems(valid), []);
  for (const key of Object.keys(valid))
    assert.ok(releaseConfigurationProblems({ ...valid, [key]: " " }).length, key);
  assert.ok(releaseConfigurationProblems({ ...valid, DATABASE_URL: "https://private-url" }).length);
  assert.ok(releaseConfigurationProblems({ ...valid, VITE_AUTH_ENABLED: "false" }).length);
  assert.ok(releaseConfigurationProblems({ ...valid, OPERATOR_ENFORCE: "0" }).length);
  assert.deepEqual(
    releaseConfigurationProblems({
      ...valid,
      SUPABASE_URL: " ",
      VITE_SUPABASE_URL: "https://storage.example.invalid/",
    }),
    [],
  );
  for (const SUPABASE_URL of [
    "http://storage.example.invalid",
    "not-a-url",
    "https://user:private-storage-password@storage.example.invalid",
    "https://storage.example.invalid?token=private-storage-token",
  ]) {
    const issues = releaseConfigurationProblems({ ...valid, SUPABASE_URL });
    assert.ok(issues.some((issue) => issue.includes("HTTPS-Storage-URL")));
    assert.doesNotMatch(issues.join(""), /private-storage-password|private-storage-token/);
  }
  assert.doesNotMatch(
    releaseConfigurationProblems({ ...valid, BETTER_AUTH_SECRET: "private-short" }).join(""),
    /private-short|private-password|private-key/,
  );
});

async function withCompleteSchema(check) {
  const db = new PGlite();
  try {
    const dir = new URL("../migrations/", import.meta.url);
    const names = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
    await db.exec("create table _migrations(name text primary key)");
    for (const name of names) {
      await db.exec(await readFile(new URL(name, dir), "utf8"));
      await db.query("insert into _migrations values ($1)", [name]);
    }
    const inspect = () =>
      checkReleaseSchema((sql) => {
        assert.match(sql.trim(), /^select\b/i, "readiness must perform only SELECTs");
        return db.query(sql);
      }, names);
    await check(db, inspect);
  } finally {
    await db.close();
  }
}

test("recorded migrations cannot hide missing auth or booking tables", async () => {
  await withCompleteSchema(async (db, inspect) => {
    for (const table of ["account", "verification", "inbox_messages", "cms_items"]) {
      await db.exec("begin");
      try {
        await db.exec(`drop table ${table}`);
        assert.ok(
          (await inspect()).some((issue) => issue.includes(`${table}.`)),
          table,
        );
      } finally {
        await db.exec("rollback");
      }
    }
  });
});

test("customer upsert requires the actual usable unique key, not an index name", async () => {
  await withCompleteSchema(async (db, inspect) => {
    await db.exec("drop index customers_shop_phone_idx");
    const hasProblem = async () =>
      (await inspect()).some((issue) => issue.includes("UNIQUE-Index"));
    assert.equal(await hasProblem(), true, "missing index");

    for (const definition of [
      "create index customers_shop_phone_idx on customers(shop_id, phone)",
      "create unique index customers_shop_phone_idx on customers(shop_id, phone) where phone <> ''",
      "create unique index customers_shop_phone_idx on customers(shop_id, lower(phone))",
      "create unique index customers_shop_phone_idx on customers(shop_id, phone, name)",
    ]) {
      await db.exec(definition);
      assert.equal(await hasProblem(), true, definition);
      await db.exec("drop index customers_shop_phone_idx");
    }

    await db.exec(
      "alter table customers add constraint deferred_customer_key unique(shop_id, phone) deferrable initially immediate",
    );
    assert.equal(
      await hasProblem(),
      true,
      "deferred unique constraints cannot arbitrate ON CONFLICT",
    );
    await db.exec("create unique index immediate_customer_key on customers(shop_id, phone)");
    assert.equal(
      await hasProblem(),
      true,
      "a second immediate index cannot hide the deferred arbiter",
    );
    await assert.rejects(
      db.query(
        "insert into customers(shop_id, name, phone) values ('test', 'test', 'test') on conflict(shop_id, phone) do update set name = excluded.name",
      ),
      (error) => error.code === "55000",
    );
    await db.exec("drop index immediate_customer_key");
    await db.exec("alter table customers drop constraint deferred_customer_key");

    await db.exec(
      "create unique index alternate_customer_key on customers(phone, shop_id) include (id)",
    );
    assert.equal(
      await hasProblem(),
      false,
      "key order, index name and INCLUDE columns are immaterial",
    );
    await db.exec(
      "update pg_catalog.pg_index set indisvalid = false where indexrelid = 'alternate_customer_key'::regclass",
    );
    assert.equal(await hasProblem(), true, "invalid indexes cannot arbitrate ON CONFLICT");
  });
});

test("migration errors expose only SQLSTATE, never raw driver messages or row values", () => {
  const error = {
    message: "password=private-password",
    code: "23505",
    detail: "Key (phone)=(private-phone) is duplicated",
    hint: "private-hint",
    where: "private-context",
  };
  assert.match(migrationFailureMessage(error), /SQLSTATE 23505/);
  for (const value of [
    error,
    { ...error, code: "private-code" },
    new Error("private-password"),
    "private-password",
  ]) {
    assert.doesNotMatch(migrationFailureMessage(value), /private-/);
  }
});

test("migration closes the pool when obtaining a connection fails", async () => {
  const failure = new Error("synthetic connection failure");
  let ended = 0;
  await assert.rejects(
    runMigrations(
      {
        connect: async () => {
          throw failure;
        },
        end: async () => {
          ended += 1;
        },
      },
      ["0001_auth.sql"],
    ),
    (error) => error === failure,
  );
  assert.equal(ended, 1);
});

test("migration rejects a UUID target before any DDL and reports only its own compatibility message", async () => {
  const queries = [];
  let released = false;
  let ended = false;
  let caught;
  try {
    await runMigrations(
      {
        connect: async () => ({
          query: async (sql) => {
            queries.push(sql);
            return { rows: [{ table_name: "bookings", column_name: "id", udt_name: "uuid" }] };
          },
          release: () => {
            released = true;
          },
        }),
        end: async () => {
          ended = true;
        },
      },
      ["0001_auth.sql"],
      true,
    );
  } catch (error) {
    caught = error;
  }
  assert.ok(caught);
  assert.match(migrationFailureMessage(caught), /Inkompatibles Schema: bookings.id muss int4 sein/);
  assert.ok(queries.length);
  assert.ok(queries.every((sql) => /^select\b/i.test(sql.trim())));
  assert.equal(released, true);
  assert.equal(ended, true);
});

test("legacy UUID and unconfirmed empty targets are rejected before migration", () => {
  assert.ok(
    schemaCompatibilityProblems([{ table_name: "bookings", column_name: "id", udt_name: "uuid" }])
      .length,
  );
  assert.ok(schemaCompatibilityProblems([]).length);
  assert.deepEqual(schemaCompatibilityProblems([], { allowEmpty: true }), []);
});

test("real schema detects pending migrations and drift, then passes the complete release", async () => {
  const db = new PGlite();
  try {
    const dir = new URL("../migrations/", import.meta.url);
    const names = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
    await db.exec("create table _migrations(name text primary key)");
    for (const name of names.filter((name) => !name.startsWith("0006_"))) {
      await db.exec(await readFile(new URL(name, dir), "utf8"));
      await db.query("insert into _migrations values ($1)", [name]);
    }
    const before = await checkReleaseSchema((sql) => db.query(sql), names);
    assert.ok(before.some((p) => p.includes("0006_booking_upload_capability.sql")));
    assert.ok(before.some((p) => p.includes("0006_qonto_invoice.sql")));
    for (const name of names.filter((name) => name.startsWith("0006_"))) {
      await db.exec(await readFile(new URL(name, dir), "utf8"));
      await db.query("insert into _migrations values ($1)", [name]);
    }
    assert.deepEqual(await checkReleaseSchema((sql) => db.query(sql), names), []);
    await db.exec("alter table bookings drop column upload_token_hash");
    assert.ok(
      (await checkReleaseSchema((sql) => db.query(sql), names)).some((p) =>
        p.includes("upload_token_hash"),
      ),
    );
  } finally {
    await db.close();
  }
});
