import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  databaseTarget,
  expectedMigrations,
  inspectConfiguration,
  inspectProduction,
  inspectionFailure,
  inspectionSummary,
} from "./inspect-production.mjs";

const env = {
  DATABASE_URL:
    "postgresql://private-user:private-password@db.example.invalid/app?sslmode=require&application_name=private-query",
  BETTER_AUTH_SECRET: "private-auth-secret-".repeat(3),
  BETTER_AUTH_URL: "https://example.invalid",
  SUPABASE_URL: "https://storage.example.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "private-storage-key",
  RESEND_API_KEY: "private-resend-key",
  MAIL_FROM: "Fixture <private-sender@example.invalid>",
  OWNER_EMAIL: "private-owner@example.invalid",
  OWNER_USER_ID: "private-owner-id",
  REMINDER_CRON_SECRET: "private-cron-secret-".repeat(3),
  WHATSAPP_PROVIDER: "meta",
  WHATSAPP_ACCESS_TOKEN: "private-meta-token",
  WHATSAPP_PHONE_NUMBER_ID: "private-phone-id",
  WHATSAPP_BUSINESS_ACCOUNT_ID: "private-account-id",
  WHATSAPP_APP_SECRET: "private-app-secret",
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: "private-verify-token",
  WHATSAPP_API_VERSION: "v24.0",
  WHATSAPP_TEMPLATE_NAME: "private-template",
  WHATSAPP_TEMPLATE_LANGUAGE: "de",
  ADMIN_WHATSAPP_NUMBER: "+490000123456",
};

test("configuration reports only presence/validity and the explicitly allowed database target", () => {
  const report = inspectConfiguration(env);
  assert.deepEqual(report.database, {
    present: true,
    valid: true,
    protocol: "postgresql",
    host: "db.example.invalid",
    database: "app",
  });
  assert.equal(report.fields.WHATSAPP_ACCESS_TOKEN.present, true);
  assert.equal(report.whatsappConfigurationPresent, true);
  assert.deepEqual(report.issues, []);
  assert.doesNotMatch(JSON.stringify(report), /private-|490000123456|sslmode|application_name/);
  assert.deepEqual(databaseTarget("postgres://u:secret@host/app%2Fpassword%3Dsecret"), {
    present: true,
    valid: true,
    protocol: "postgres",
    host: "host",
    database: "[nonstandard database name omitted]",
  });
  for (const value of [
    "https://secret@example.invalid",
    "private-invalid-uri",
    "postgres://host/",
  ]) {
    assert.deepEqual(databaseTarget(value), { present: true, valid: false });
  }
  assert.deepEqual(databaseTarget(""), { present: false, valid: false });
});

test("missing provider settings and unsafe auth flags are visible without configuration values", () => {
  const report = inspectConfiguration({
    ...env,
    VITE_AUTH_ENABLED: "false",
    OPERATOR_ENFORCE: "0",
    WHATSAPP_ACCESS_TOKEN: "",
    REMINDER_CRON_SECRET: "private-short",
    OWNER_USER_ID: "dev-user",
  });
  for (const code of [
    "auth_disabled",
    "operator_enforcement_disabled",
    "whatsapp_configuration_incomplete",
    "scheduler_secret_missing_or_short",
    "owner_identity_invalid",
  ]) {
    assert.ok(report.issues.includes(code), code);
  }
  assert.equal(report.fields.WHATSAPP_ACCESS_TOKEN.present, false);
  assert.doesNotMatch(JSON.stringify(report), /private-|dev-user/);
});

test("expected root migrations include both 0006 files and match the current repository", async () => {
  const names = (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.deepEqual([...expectedMigrations].sort(), names);
});

test("terminal summary stays compact, reports Qonto presence and never prints credentials", () => {
  const configuration = inspectConfiguration({
    ...env,
    QONTO_LOGIN: "private-qonto-login",
    QONTO_SECRET_KEY: "private-qonto-secret",
    LEXWARE_API_KEY: "private-lexware-key",
  });
  assert.equal(configuration.fields.QONTO_LOGIN.present, true);
  assert.equal(configuration.fields.LEXWARE_API_KEY.present, true);
  const summary = inspectionSummary({
    completed: true,
    transactionReadOnly: true,
    configuration,
    issues: configuration.issues,
  });
  assert.ok(summary.split("\n").length <= 25);
  assert.match(summary, /Qonto presence: login=true; secret=true/);
  assert.match(summary, /Lexware presence: key=true/);
  assert.doesNotMatch(summary, /private-|490000123456/);
  const incomplete = inspectionSummary({
    completed: false,
    configuration: inspectConfiguration({}),
  });
  assert.ok(incomplete.split("\n").length <= 25);
  assert.match(incomplete, /database_configuration_invalid/);
});

test("standalone CLI refuses an invalid database target without loading pg or exposing input", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./inspect-production.mjs", import.meta.url)), "--summary"],
    {
      encoding: "utf8",
      timeout: 5000,
      env: { DATABASE_URL: "private-invalid-database-target" },
    },
  );
  assert.equal(result.status, 2);
  assert.match(result.stdout, /Database: missing\/invalid/);
  assert.doesNotMatch(result.stdout + result.stderr, /private-invalid/);
  assert.equal(result.stderr, "");
});

async function database(beforeWorkflow = false) {
  const pg = new PGlite();
  await pg.exec("create table _migrations(name text primary key)");
  for (const name of expectedMigrations) {
    if (beforeWorkflow && name.startsWith("0007")) break;
    await pg.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
    await pg.query("insert into _migrations(name) values($1)", [name]);
  }
  const statements = [];
  let released = false;
  let ended = false;
  const client = {
    async query(sql, args) {
      statements.push(sql);
      assert.match(
        sql.trim(),
        /^(?:BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY|SET LOCAL (?:statement_timeout|lock_timeout|idle_in_transaction_session_timeout)|select\b|with active as|ROLLBACK)/i,
      );
      return pg.query(sql, args);
    },
    release() {
      released = true;
    },
  };
  const pool = {
    async connect() {
      return client;
    },
    async end() {
      ended = true;
    },
  };
  return { pg, pool, statements, closed: () => released && ended };
}

test("complete schema inspection uses a read-only snapshot and returns counts without personal data", async () => {
  const { pg, pool, statements, closed } = await database();
  try {
    await pg.query('insert into "user"(id,name,email,"emailVerified") values($1,$2,$3,true)', [
      env.OWNER_USER_ID,
      "private-owner-name",
      env.OWNER_EMAIL,
    ]);
    await pg.query(
      "insert into bookings(customer_name,phone,email,package_id,class_id,note) values($1,$2,$3,'basis','kompakt',$4)",
      ["private-customer", "+490000123456", "private-customer@example.invalid", "private-note"],
    );
    await pg.query("insert into _migrations(name) values('private-unknown-history')");
    const report = await inspectProduction(pool, env);
    assert.equal(report.completed, true);
    assert.equal(report.transactionReadOnly, true);
    assert.equal(report.applicationModelCompatible, true);
    assert.equal(report.workflowGuardEnabled, true);
    assert.equal(report.counts.bookings, 1);
    assert.equal(report.bookings.pending, 1);
    assert.equal(report.owner.exists, true);
    assert.equal(report.owner.canConfirmByIdentity, true);
    assert.ok(report.migrations.expected.every((entry) => entry.applied));
    assert.equal(report.migrations.unrecognizedEntries, 1);
    assert.doesNotMatch(JSON.stringify(report), /private-|490000123456/);
    assert.equal(statements[0], "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    assert.equal(statements.at(-1), "ROLLBACK");
    assert.equal(closed(), true);
    assert.equal((await pg.query("select count(*)::int as n from bookings")).rows[0].n, 1);
  } finally {
    await pg.close();
  }
});

test("legacy capacity conflicts are reported as counts before workflow migration, without booking dates or identities", async () => {
  const { pg, pool } = await database(true);
  try {
    for (let n = 0; n < 3; n++)
      await pg.query(
        "insert into bookings(status,customer_name,phone,package_id,class_id,preferred_date,preferred_slot) values('bestaetigt',$1,$2,'basis','kompakt','2999-04-01','09:00')",
        [`private-customer-${n}`, `private-phone-${n}`],
      );
    const report = await inspectProduction(pool, env);
    assert.equal(report.completed, true);
    assert.equal(report.capacity.conflicting_days, 1);
    assert.equal(report.capacity.duplicate_dropoff_slots, 1);
    assert.ok(report.issues.includes("booking_capacity_attention"));
    assert.ok(report.issues.includes("migration_history_incomplete"));
    assert.ok(report.issues.includes("owner_identity_not_ready"));
    assert.doesNotMatch(JSON.stringify(report), /private-|2999-04-01/);
  } finally {
    await pg.close();
  }
});

test("UUID legacy schema is identified and incompatible business queries are skipped", async () => {
  const pg = new PGlite();
  try {
    await pg.exec("create table bookings(id uuid primary key, customer_name text)");
    const statements = [];
    const pool = {
      async connect() {
        return {
          query(sql, args) {
            statements.push(sql);
            return pg.query(sql, args);
          },
          release() {},
        };
      },
      async end() {},
    };
    const report = await inspectProduction(pool, env);
    assert.equal(report.completed, true);
    assert.equal(report.applicationModelCompatible, false);
    assert.equal(report.counts.bookings, 0);
    assert.equal(report.capacity, undefined);
    assert.equal(report.owner.checked, false);
    assert.ok(report.issues.includes("application_schema_incomplete_or_incompatible"));
    assert.equal(
      statements.some((sql) => sql.includes("where shop_id=$1")),
      false,
    );
  } finally {
    await pg.close();
  }
});

test("connection and query failures are sanitized and always release pool resources", async () => {
  const raw = {
    code: "42501",
    message: "postgres://private-user:private-password@host/app",
    detail: "private-customer",
    hint: "private-token",
  };
  assert.deepEqual(inspectionFailure(raw), { code: "inspection_failed", sqlstate: "42501" });
  assert.deepEqual(inspectionFailure({ ...raw, code: "private-code" }), {
    code: "inspection_failed",
  });
  for (const connectionFailure of [true, false]) {
    let released = false;
    let ended = false;
    const pool = {
      async connect() {
        if (connectionFailure) throw raw;
        return {
          async query() {
            throw raw;
          },
          release() {
            released = true;
          },
        };
      },
      async end() {
        ended = true;
      },
    };
    const report = await inspectProduction(pool, env);
    assert.equal(report.completed, false);
    assert.equal(report.failure.sqlstate, "42501");
    assert.doesNotMatch(JSON.stringify(report), /private-|490000123456/);
    assert.equal(ended, true);
    assert.equal(released, !connectionFailure);
  }
});
