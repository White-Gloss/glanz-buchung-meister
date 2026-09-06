// Shared by the read-only release check and the production request gate.
/** @param {Record<string, string | undefined>} env */
export function releaseConfigurationProblems(env) {
  /** @param {string} key */
  const value = (key) => env[key]?.trim() || "";
  const problems = [];
  const database = value("DATABASE_URL");
  if (!database) problems.push("DATABASE_URL fehlt (kein produktiver PGlite-Fallback).");
  else {
    try {
      const url = new URL(database);
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !url.hostname ||
        url.pathname.length < 2
      )
        throw new Error();
    } catch {
      problems.push("DATABASE_URL ist keine vollständige PostgreSQL-Verbindung.");
    }
  }
  if (value("BETTER_AUTH_SECRET").length < 32)
    problems.push("BETTER_AUTH_SECRET muss mindestens 32 Zeichen lang und dauerhaft gesetzt sein.");
  if (value("VITE_AUTH_ENABLED") === "false")
    problems.push("VITE_AUTH_ENABLED=false ist für den Produktivbetrieb nicht zulässig.");
  if (value("OPERATOR_ENFORCE") === "0")
    problems.push("OPERATOR_ENFORCE=0 ist für den Produktivbetrieb nicht zulässig.");
  for (const key of ["SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "MAIL_FROM"]) {
    if (!value(key)) problems.push(`${key} fehlt für den vollständigen Buchungsbetrieb.`);
  }
  const storageUrl = value("SUPABASE_URL") || value("VITE_SUPABASE_URL");
  try {
    const url = new URL(storageUrl);
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
  } catch {
    problems.push(
      "SUPABASE_URL (oder VITE_SUPABASE_URL) muss eine gültige HTTPS-Storage-URL sein.",
    );
  }
  // Never print values: PostgreSQL URLs and server keys contain credentials.
  return problems;
}

export const releaseColumnsQuery = `
  select table_name, column_name, udt_name from information_schema.columns
  where table_schema = current_schema()
    and table_name in (
      'bookings', 'customers', 'booking_photos', 'cms_items', 'inbox_messages',
      'outbound_queue', 'documents', 'agent_commands', 'automation_events',
      'shop_settings', 'user', 'session', 'account', 'verification'
    )`;

// ON CONFLICT(shop_id, phone) needs a usable, immediate, non-partial unique
// index over exactly these keys. The name and key order do not matter; INCLUDE
// columns are permitted. A matching name alone is not evidence of uniqueness.
// Every inferred valid arbiter must be immediate: a deferred constraint still
// breaks the upsert when another matching immediate index exists beside it.
export const customerConflictIndexQuery = `
  select coalesce(bool_and(i.indimmediate and i.indisready), false) as usable
  from pg_catalog.pg_index i
  join pg_catalog.pg_class t on t.oid = i.indrelid
  join pg_catalog.pg_namespace n on n.oid = t.relnamespace
  where n.nspname = current_schema() and t.relname = 'customers'
    and i.indisunique and i.indisvalid
    and i.indpred is null and i.indexprs is null and i.indnkeyatts = 2
    and (
      select array_agg(a.attname::text order by a.attname::text)
      from unnest(i.indkey) with ordinality as k(attnum, position)
      join pg_catalog.pg_attribute a
        on a.attrelid = t.oid and a.attnum = k.attnum
      where k.position <= i.indnkeyatts
    ) = array['phone', 'shop_id']::text[]`;

/** @typedef {{table_name: string, column_name: string, udt_name: string}} Column */
/** @param {Column[]} columns @param {{allowEmpty?: boolean}} [options] */
export function schemaCompatibilityProblems(columns, { allowEmpty = false } = {}) {
  /** @param {string} table @param {string} column */
  const find = (table, column) =>
    columns.find((c) => c.table_name === table && c.column_name === column);
  if (!columns.length)
    return allowEmpty
      ? []
      : [
          "Keine bestehende Anwendungsdatenbank erkannt; Datenbankziel vor einer Neuinitialisierung bestätigen.",
        ];
  const required = [
    ["bookings", "id", "int4"],
    ["bookings", "shop_id", "text"],
    ["bookings", "phone", "text"],
    ["bookings", "total_cents", "int4"],
    ["customers", "id", "int4"],
    ["customers", "shop_id", "text"],
    ["user", "id", "text"],
    ["session", "userId", "text"],
  ];
  return required
    .filter(([table, column, type]) => find(table, column)?.udt_name !== type)
    .map(
      ([table, column, type]) =>
        `Inkompatibles Schema: ${table}.${column} muss ${type} sein. Keine automatische Übernahme des UUID-Altmodells.`,
    );
}

/**
 * @param {(text: string) => Promise<{rows: any[]}>} query
 * @param {string[]} migrationNames
 */
export async function checkReleaseSchema(query, migrationNames) {
  const columns = await query(releaseColumnsQuery);
  const compatibility = schemaCompatibilityProblems(columns.rows);
  if (compatibility.length) return compatibility;
  const registry = await query("select to_regclass('_migrations') as registry");
  if (!registry.rows[0]?.registry)
    return ["Migrationshistorie _migrations fehlt; Datenbankstand zuerst prüfen."];
  const applied = new Set((await query("select name from _migrations")).rows.map((r) => r.name));
  const problems = migrationNames
    .filter((name) => !applied.has(name))
    .map((name) => `Migration ausstehend: ${name}`);
  for (const [table, column, type] of [
    ["bookings", "upload_token_hash", "text"],
    ["bookings", "upload_token_expires_at", "timestamptz"],
    ["bookings", "qonto_invoice_id", "text"],
    ["booking_photos", "booking_id", "int4"],
    ["customers", "phone", "text"],
    ["user", "email", "text"],
    ["session", "token", "text"],
    ["session", "expiresAt", "timestamptz"],
    ["account", "id", "text"],
    ["account", "accountId", "text"],
    ["account", "userId", "text"],
    ["account", "providerId", "text"],
    ["account", "password", "text"],
    ["verification", "id", "text"],
    ["verification", "identifier", "text"],
    ["verification", "value", "text"],
    ["verification", "expiresAt", "timestamptz"],
    ["cms_items", "id", "int4"],
    ["inbox_messages", "id", "int4"],
    ["outbound_queue", "id", "int4"],
    ["documents", "id", "int4"],
    ["agent_commands", "id", "int4"],
    ["automation_events", "id", "int4"],
    ["shop_settings", "shop_id", "text"],
  ]) {
    if (
      !columns.rows.some(
        (c) => c.table_name === table && c.column_name === column && c.udt_name === type,
      )
    ) {
      problems.push(`Erforderliche Release-Spalte fehlt: ${table}.${column}`);
    }
  }
  const index = await query(customerConflictIndexQuery);
  if (index.rows[0]?.usable !== true) {
    problems.push(
      "Erforderlicher gültiger, unmittelbarer UNIQUE-Index für customers(shop_id, phone) fehlt.",
    );
  }
  return problems;
}
