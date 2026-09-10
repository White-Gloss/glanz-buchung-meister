#!/usr/bin/env node
/**
 * Production discovery only: no migrations, writes, provider calls or .env loading.
 * Supply the real service environment through systemd-run's EnvironmentFile property.
 * Run beside an installed pg package, or pass --pg-root /path/to/.output/server.
 * Exit 0: no detected blockers; 2: configuration/schema/data attention; 1: inspection failed.
 * This is an inventory, not proof that external providers or an owner login work.
 */
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const expectedMigrations = [
  "0001_auth.sql",
  "0002_shop.sql",
  "0003_ops.sql",
  "0004_settings.sql",
  "0005_booking_photos.sql",
  "0006_booking_upload_capability.sql",
  "0006_qonto_invoice.sql",
  "0007_booking_workflow.sql",
  "0008_notification_delivery.sql",
  "0009_whatsapp_receipts.sql",
  "0010_odoo_integration.sql",
  "0011_booking_pdf.sql",
  "0012_odoo_sync.sql",
  "0013_roapp_sync.sql",
  "0014_lexware_sync.sql",
];
const tables = [
  "_migrations",
  "user",
  "session",
  "account",
  "verification",
  "bookings",
  "customers",
  "inbox_messages",
  "documents",
  "agent_commands",
  "cms_items",
  "outbound_queue",
  "automation_events",
  "shop_settings",
  "booking_photos",
  "booking_events",
  "booking_workflow_locks",
  "booking_capacity_claims",
  "whatsapp_webhook_receipts",
  "odoo_sync_queue",
  "odoo_record_links",
  "odoo_sync_runner",
  "lexware_sync_queue",
  "lexware_sync_runner",
];
const requiredColumns = [
  ["outbound_queue", "attachments", "jsonb"],
  ["bookings", "id", "int4"],
  ["bookings", "shop_id", "text"],
  ["bookings", "phone", "text"],
  ["bookings", "total_cents", "int4"],
  ["bookings", "version", "int4"],
  ["bookings", "confirmed_at", "timestamptz"],
  ["bookings", "confirmed_by", "text"],
  ["bookings", "cancelled_at", "timestamptz"],
  ["bookings", "request_key_hash", "text"],
  ["bookings", "request_fingerprint", "text"],
  ["bookings", "upload_token_hash", "text"],
  ["bookings", "upload_token_expires_at", "timestamptz"],
  ["bookings", "qonto_invoice_id", "text"],
  ["customers", "id", "int4"],
  ["customers", "shop_id", "text"],
  ["customers", "phone", "text"],
  ["user", "id", "text"],
  ["user", "email", "text"],
  ["user", "emailVerified", "bool"],
  ["session", "userId", "text"],
  ["session", "token", "text"],
  ["session", "expiresAt", "timestamptz"],
  ["account", "id", "text"],
  ["account", "userId", "text"],
  ["account", "accountId", "text"],
  ["account", "providerId", "text"],
  ["account", "password", "text"],
  ["verification", "id", "text"],
  ["verification", "value", "text"],
  ["verification", "expiresAt", "timestamptz"],
  ["booking_photos", "booking_id", "int4"],
  ["booking_events", "after_data", "jsonb"],
  ["booking_events", "before_data", "jsonb"],
  ["booking_events", "version", "int4"],
  ["booking_capacity_claims", "resource", "int4"],
  ["booking_workflow_locks", "shop_id", "text"],
  ["outbound_queue", "event_key", "text"],
  ["outbound_queue", "event_type", "text"],
  ["outbound_queue", "attempt_count", "int4"],
  ["outbound_queue", "booking_version", "int4"],
  ["outbound_queue", "first_attempt_at", "timestamptz"],
  ["outbound_queue", "next_attempt_at", "timestamptz"],
  ["outbound_queue", "locked_until", "timestamptz"],
  ["outbound_queue", "lease_token", "text"],
  ["outbound_queue", "provider_message_id", "text"],
  ["outbound_queue", "delivery_status", "text"],
  ["outbound_queue", "last_error_code", "text"],
  ["outbound_queue", "legacy_status", "text"],
  ["shop_settings", "notification_worker_last_run_at", "timestamptz"],
  ["whatsapp_webhook_receipts", "event_hash", "text"],
];
const SHOP = "white-gloss";
const DEFAULT_OWNER_EMAIL = "info@white-gloss.de";
/** @param {unknown} value */
const isEmail = (value) =>
  typeof value === "string" && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
/** @param {string} value */
function httpsUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

/** @param {string | undefined} value */
export function databaseTarget(value) {
  if (!value?.trim()) return { present: false, valid: false };
  try {
    const url = new URL(value.trim());
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2
    )
      throw new Error();
    const database = decodeURIComponent(url.pathname.slice(1));
    return {
      present: true,
      valid: true,
      protocol: url.protocol.slice(0, -1),
      host: url.hostname,
      database: /^[A-Za-z0-9_.-]{1,128}$/.test(database)
        ? database
        : "[nonstandard database name omitted]",
    };
  } catch {
    return { present: true, valid: false };
  }
}

/** @param {Record<string, string | undefined>} env */
export function inspectConfiguration(env) {
  /** @param {string} key */
  const value = (key) => env[key]?.trim() || "";
  /** @type {Record<string, {present: boolean, valid?: boolean}>} */
  const fields = {};
  /** @param {string} key @param {(input: string) => boolean} [validate] */
  const field = (key, validate) => {
    const input = value(key);
    fields[key] = { present: Boolean(input), ...(validate ? { valid: validate(input) } : {}) };
  };
  field("DATABASE_URL", (input) => databaseTarget(input).valid);
  field("BETTER_AUTH_SECRET", (input) => input.length >= 32);
  field("BETTER_AUTH_URL", httpsUrl);
  field("VITE_AUTH_ENABLED", (input) => input !== "false");
  field("OPERATOR_ENFORCE", (input) => input !== "0");
  field("OWNER_USER_ID", (input) => Boolean(input) && input !== "dev-user");
  field("OWNER_EMAIL", isEmail);
  field("SUPABASE_URL", httpsUrl);
  field("VITE_SUPABASE_URL", httpsUrl);
  field("SUPABASE_SERVICE_ROLE_KEY");
  field("RESEND_API_KEY");
  field("MAIL_FROM", (input) => isEmail(input.match(/<([^<>]+)>$/)?.[1] || input));
  field("GOOGLE_CLIENT_ID");
  field("GOOGLE_CLIENT_SECRET");
  field("REMINDER_CRON_SECRET", (input) => input.length >= 32);
  for (const key of [
    "WHATSAPP_PROVIDER",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    "WHATSAPP_API_VERSION",
    "WHATSAPP_TEMPLATE_NAME",
    "WHATSAPP_TEMPLATE_LANGUAGE",
    "ADMIN_WHATSAPP_NUMBER",
    "OWNER_WHATSAPP",
    "QONTO_LOGIN",
    "QONTO_SECRET_KEY",
    "QONTO_IBAN",
    "LEXWARE_API_KEY",
  ])
    field(key);
  const storageConfigured =
    httpsUrl(value("SUPABASE_URL") || value("VITE_SUPABASE_URL")) &&
    fields.SUPABASE_SERVICE_ROLE_KEY.present;
  const whatsappFields = [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    "WHATSAPP_API_VERSION",
    "WHATSAPP_TEMPLATE_NAME",
    "WHATSAPP_TEMPLATE_LANGUAGE",
  ];
  const whatsappComplete =
    value("WHATSAPP_PROVIDER") === "meta" &&
    whatsappFields.every((key) => fields[key].present) &&
    Boolean(value("ADMIN_WHATSAPP_NUMBER") || value("OWNER_WHATSAPP"));
  const blocking = [
    !fields.DATABASE_URL.valid && "database_configuration_invalid",
    !fields.BETTER_AUTH_SECRET.valid && "auth_secret_missing_or_short",
    !fields.VITE_AUTH_ENABLED.valid && "auth_disabled",
    !fields.OPERATOR_ENFORCE.valid && "operator_enforcement_disabled",
    !storageConfigured && "storage_configuration_incomplete",
    !(fields.RESEND_API_KEY.present && fields.MAIL_FROM.valid) && "email_configuration_incomplete",
    !fields.REMINDER_CRON_SECRET.valid && "scheduler_secret_missing_or_short",
    !whatsappComplete && "whatsapp_configuration_incomplete",
    fields.OWNER_USER_ID.present && !fields.OWNER_USER_ID.valid && "owner_identity_invalid",
    !fields.OWNER_USER_ID.present &&
      fields.OWNER_EMAIL.present &&
      !fields.OWNER_EMAIL.valid &&
      "owner_email_invalid",
  ].filter(Boolean);
  return {
    fields,
    database: databaseTarget(value("DATABASE_URL")),
    storageConfigured,
    whatsappConfigurationPresent: whatsappComplete,
    googleCredentialsPaired: fields.GOOGLE_CLIENT_ID.present && fields.GOOGLE_CLIENT_SECRET.present,
    ownerSelector: fields.OWNER_USER_ID.present
      ? "configured_user_id"
      : fields.OWNER_EMAIL.present
        ? "configured_email"
        : "application_default_email",
    issues: blocking,
  };
}

/** @param {unknown} error */
export function inspectionFailure(error) {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return {
    code: "inspection_failed",
    ...(typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? { sqlstate: code } : {}),
  };
}

/**
 * All inspection queries share one read-only snapshot. Even a programming mistake
 * cannot write ordinary application tables through this transaction.
 * @param {{connect: () => Promise<any>, end: () => Promise<unknown>}} pool
 * @param {Record<string, string | undefined>} env
 */
export async function inspectProduction(pool, env = process.env) {
  const configuration = inspectConfiguration(env);
  /** @type {Record<string, any>} */
  const report = { mode: "read_only", configuration, issues: [...configuration.issues] };
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("SET LOCAL lock_timeout = '1s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '15s'");
    const context = (
      await client.query(
        "select current_schema() as schema, current_setting('transaction_read_only') = 'on' as read_only",
      )
    ).rows[0];
    if (!context?.read_only) throw new Error("read_only_unavailable");
    report.transactionReadOnly = true;
    report.schema = context.schema;
    const columns = (
      await client.query(
        `select table_name,column_name,udt_name
      from information_schema.columns where table_schema=current_schema()
      and table_name=any($1::text[]) order by table_name,ordinal_position`,
        [tables],
      )
    ).rows;
    /** @param {string} table @param {string} column @param {string} [type] */
    const has = (table, column, type) =>
      columns.some(
        (c) => c.table_name === table && c.column_name === column && (!type || c.udt_name === type),
      );
    /** @param {string} name */
    const identifier = (name) => `"${name.replaceAll('"', '""')}"`;
    /** @param {string} name */
    const tableName = (name) => `${identifier(context.schema)}.${identifier(name)}`;
    report.tables = tables.map((name) => ({
      name,
      present: columns.some((c) => c.table_name === name),
      columns: columns
        .filter((c) => c.table_name === name)
        .map((c) => ({ name: c.column_name, type: c.udt_name })),
    }));
    report.missingOrIncompatibleColumns = requiredColumns
      .filter(([table, column, type]) => !has(table, column, type))
      .map(([table, column, type]) => ({ table, column, expectedType: type }));
    if (report.tables.some((table) => !table.present) || report.missingOrIncompatibleColumns.length)
      report.issues.push("application_schema_incomplete_or_incompatible");
    report.applicationModelCompatible =
      has("bookings", "id", "int4") &&
      has("bookings", "shop_id", "text") &&
      has("customers", "id", "int4") &&
      has("user", "id", "text") &&
      has("session", "userId", "text");
    report.migrations = {
      registryPresent: has("_migrations", "name", "text"),
      expected: expectedMigrations.map((name) => ({ name, applied: false })),
    };
    if (report.migrations.registryPresent) {
      const applied = (
        await client.query(
          `select distinct name from ${tableName("_migrations")} where name=any($1::text[])`,
          [expectedMigrations],
        )
      ).rows;
      report.migrations.expected = expectedMigrations.map((name) => ({
        name,
        applied: applied.some((row) => row.name === name),
      }));
      report.migrations.unrecognizedEntries = Number(
        (
          await client.query(
            `select count(*)::text as count from ${tableName("_migrations")} where not(name=any($1::text[]))`,
            [expectedMigrations],
          )
        ).rows[0].count,
      );
    }
    if (report.migrations.expected.some((entry) => !entry.applied))
      report.issues.push("migration_history_incomplete");
    // Exact counts only. No customer, message body, token, email or account IDs leave the database.
    report.counts = {};
    for (const table of report.tables.filter((entry) => entry.present)) {
      report.counts[table.name] = Number(
        (await client.query(`select count(*)::text as count from ${tableName(table.name)}`)).rows[0]
          .count,
      );
    }
    if (
      report.applicationModelCompatible &&
      ["status", "preferred_date", "preferred_slot", "package_id"].every((column) =>
        has("bookings", column),
      )
    ) {
      const bookings = tableName("bookings");
      report.bookings = (
        await client.query(
          `select
        count(*) filter(where status='neu')::int as pending,
        count(*) filter(where status='bestaetigt')::int as confirmed,
        count(*) filter(where status='abgelehnt')::int as rejected,
        count(*) filter(where status='storniert')::int as cancelled,
        count(*) filter(where status='erledigt')::int as completed,
        count(*) filter(where status='nicht_erschienen')::int as no_show,
        count(*) filter(where status not in ('neu','bestaetigt','abgelehnt','storniert','erledigt','nicht_erschienen'))::int as other_status
        from ${bookings} where shop_id=$1`,
          [SHOP],
        )
      ).rows[0];
      report.capacity = (
        await client.query(
          `with active as (
        select preferred_date,preferred_slot,package_id from ${bookings}
        where shop_id=$1 and status in ('bestaetigt','erledigt','nicht_erschienen')
      ), days as (
        select preferred_date,count(*) as bookings,bool_or(package_id='keramik' or preferred_slot is null) as full_day
        from active where preferred_date is not null group by preferred_date
      ), slots as (
        select preferred_date,preferred_slot,count(*) from active
        where preferred_date is not null and preferred_slot is not null group by preferred_date,preferred_slot having count(*)>1
      ) select
        (select count(*)::int from days where bookings>2 or (full_day and bookings>1)) as conflicting_days,
        (select count(*)::int from slots) as duplicate_dropoff_slots,
        (select count(*)::int from active where preferred_date is null or (preferred_slot is not null and preferred_slot not in ('09:00','11:00','13:00','15:00'))) as invalid_active_appointments`,
          [SHOP],
        )
      ).rows[0];
      if (Object.values(report.capacity).some((value) => Number(value) > 0))
        report.issues.push("booking_capacity_attention");
      if (report.bookings.other_status > 0) report.issues.push("unknown_booking_status");
    }
    if (
      has("user", "id", "text") &&
      has("user", "email", "text") &&
      has("user", "emailVerified", "bool")
    ) {
      const ownerId = env.OWNER_USER_ID?.trim() || "";
      const ownerEmail = env.OWNER_EMAIL?.trim() || DEFAULT_OWNER_EMAIL;
      const owner = (
        await client.query(
          `select count(*)::int as matches,
        count(*) filter(where "emailVerified"=true)::int as verified
        from ${tableName("user")} where id <> 'dev-user' and
        (case when $1 <> '' then id=$1 else lower(trim(email))=lower($2) end)`,
          [ownerId, ownerEmail],
        )
      ).rows[0];
      report.owner = {
        selector: configuration.ownerSelector,
        exists: owner.matches > 0,
        emailVerified: owner.verified > 0,
        canConfirmByIdentity: owner.matches === 1 && (Boolean(ownerId) || owner.verified === 1),
      };
      if (!report.owner.canConfirmByIdentity) report.issues.push("owner_identity_not_ready");
    } else report.owner = { checked: false, reason: "compatible_auth_table_missing" };
    if (has("bookings", "id", "int4")) {
      report.workflowGuardEnabled = (
        await client.query(
          `select exists(select 1 from pg_catalog.pg_trigger
        where tgrelid=to_regclass($1) and tgname='booking_workflow_guard' and tgenabled in ('O','A')) as enabled`,
          [tableName("bookings")],
        )
      ).rows[0].enabled;
      if (!report.workflowGuardEnabled) report.issues.push("booking_workflow_guard_missing");
    }
    if (has("shop_settings", "notification_worker_last_run_at", "timestamptz")) {
      const [worker] = (
        await client.query(
          `select notification_worker_last_run_at::text as last_run
        from ${tableName("shop_settings")} where shop_id=$1`,
          [SHOP],
        )
      ).rows;
      report.notificationWorker = { lastSuccessfulRun: worker?.last_run ?? null };
    }
    report.completed = true;
  } catch (error) {
    report.failure = inspectionFailure(error);
    report.completed = false;
  } finally {
    try {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* No raw driver output, even during cleanup. */
        }
        client.release();
      }
    } finally {
      try {
        await pool.end();
      } catch {
        report.cleanupFailed = true;
      }
    }
  }
  return report;
}

/** A short terminal view; default JSON retains the full metadata inventory.
 * @param {Record<string, any>} report
 */
export function inspectionSummary(report) {
  const config = report.configuration;
  const db = config?.database;
  const expected = report.migrations?.expected ?? [];
  const absent = expected.filter((entry) => !entry.applied);
  const counts = report.counts ?? {};
  const owner = report.owner ?? {};
  const fields = config?.fields ?? {};
  const lines = [
    `Inspection: ${report.completed ? "complete" : "incomplete"}; read-only=${report.transactionReadOnly === true}`,
    `Database: ${db?.valid ? `${db.protocol} | ${db.host} | ${db.database}` : "missing/invalid"}`,
    `Schema: ${report.schema ?? "not checked"}; compatible=${report.applicationModelCompatible === true}`,
    `Migrations: ${expected.length - absent.length}/${expected.length} expected applied; unknown=${report.migrations?.unrecognizedEntries ?? "not checked"}`,
    `Tables: ${report.tables?.filter((entry) => entry.present).length ?? 0}/${tables.length}; missing/incompatible columns=${report.missingOrIncompatibleColumns?.length ?? "not checked"}`,
    `Rows: bookings=${counts.bookings ?? "?"}; customers=${counts.customers ?? "?"}; photos=${counts.booking_photos ?? "?"}`,
    `Rows: events=${counts.booking_events ?? "?"}; outbox=${counts.outbound_queue ?? "?"}; users=${counts.user ?? "?"}`,
    `Bookings: ${report.bookings ? `pending=${report.bookings.pending}; confirmed=${report.bookings.confirmed}; completed=${report.bookings.completed}; cancelled=${report.bookings.cancelled}; rejected=${report.bookings.rejected}; no-show=${report.bookings.no_show}` : "not checked"}`,
    `Capacity: ${report.capacity ? `conflicting days=${report.capacity.conflicting_days}; duplicate slots=${report.capacity.duplicate_dropoff_slots}; invalid=${report.capacity.invalid_active_appointments}` : "not checked"}`,
    `Owner: ${owner.selector ?? "not checked"}; exists=${owner.exists === true}; verified=${owner.emailVerified === true}; may-confirm=${owner.canConfirmByIdentity === true}`,
    `Providers: storage=${config?.storageConfigured === true}; mail=${fields.RESEND_API_KEY?.present && fields.MAIL_FROM?.valid ? "configured" : "incomplete"}; WhatsApp fields=${config?.whatsappConfigurationPresent === true}`,
    `Qonto presence: login=${fields.QONTO_LOGIN?.present === true}; secret=${fields.QONTO_SECRET_KEY?.present === true}; IBAN=${fields.QONTO_IBAN?.present === true}`,
    `Lexware presence: key=${fields.LEXWARE_API_KEY?.present === true}`,
    `Worker: last successful run=${report.notificationWorker?.lastSuccessfulRun ?? "not recorded"}`,
  ];
  if (report.failure)
    lines.push(
      `Failure: ${report.failure.code}; SQLSTATE=${report.failure.sqlstate ?? "unavailable"}`,
    );
  for (const issue of report.issues ?? config?.issues ?? []) lines.push(`Attention: ${issue}`);
  return lines.join("\n");
}

/** @param {string[]} [args] */
export async function main(args = process.argv.slice(2)) {
  /** @param {Record<string, any>} report */
  const output = (report) =>
    console.log(
      args.includes("--summary") ? inspectionSummary(report) : JSON.stringify(report, null, 2),
    );
  try {
    const configuration = inspectConfiguration(process.env);
    if (!configuration.database.valid) {
      output({ mode: "read_only", configuration, completed: false });
      process.exitCode = 2;
      return;
    }
    const rootIndex = args.indexOf("--pg-root");
    const pg =
      rootIndex >= 0 && args[rootIndex + 1]
        ? createRequire(resolve(args[rootIndex + 1], "package.json"))("pg")
        : (await import("pg")).default;
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL?.trim(),
      max: 1,
      connectionTimeoutMillis: 5000,
      statement_timeout: 5000,
      application_name: "white-gloss-readonly-inspection",
    });
    // Pool errors can contain server names and credentials; never let Node print them raw.
    pool.on("error", () => {});
    const report = await inspectProduction(pool);
    output(report);
    process.exitCode = report.completed ? (report.issues.length ? 2 : 0) : 1;
  } catch (error) {
    output({ mode: "read_only", completed: false, failure: inspectionFailure(error) });
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
