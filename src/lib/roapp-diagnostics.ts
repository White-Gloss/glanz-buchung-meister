import type { Sql } from "./db.ts";
import { extras, packages, pickupPricing, vehicleClasses } from "../data/site.ts";
import { bookingBackend, roappAccountScope, roappCutoverAt } from "./booking-backend.ts";
import { journalStep } from "./roapp-write-journal.ts";
import {
  createRoappClient,
  roappCredentialsFromEnv,
  RoappError,
  type RoappCredentials,
  type RoappRequest,
} from "./roapp.ts";

const SHOP = "white-gloss";

// Names only; values never leave the process.
const RO_ENV_KEYS = [
  "ROAPP_API_KEY",
  "ROAPP_EXPECTED_COMPANY_CREATED_AT",
  "ROAPP_ACCOUNT_SCOPE",
  "ROAPP_CUTOVER_AT",
  "ROAPP_BRANCH_ID",
  "ROAPP_ASSIGNEE_ID",
  "ROAPP_ORDER_TYPE_ID",
  "ROAPP_ENTITY_MAP",
  "ROAPP_WEBHOOK_SECRET",
  "ROAPP_REVIEW_STATUS_ID",
  "ROAPP_APPROVED_STATUS_ID",
  "ROAPP_FIRM_STATUS_ID",
  "ROAPP_CONFIRMED_STATUS_IDS",
  "ROAPP_COMPLETED_STATUS_IDS",
];

const LOOPBACK_IP = /^(?:127(?:\.\d{1,3}){3}|::1|::ffff:127(?:\.\d{1,3}){3})$/;
const LOOPBACK_HOST = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?$/i;
// Caddy always adds X-Forwarded-For, so a proxied public request never qualifies.
const PROXY_HEADERS = [
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "forwarded",
  "x-real-ip",
  "via",
];

/** Only a direct request on the server itself (e.g. the read-only inspect job via SSH). */
export function isLocalDiagnosticsRequest(ip: string | undefined, headers: Headers): boolean {
  if (!ip || !LOOPBACK_IP.test(ip)) return false;
  if (!LOOPBACK_HOST.test(headers.get("host") || "")) return false;
  return PROXY_HEADERS.every((name) => !headers.has(name));
}

/** Catalog positions of the website that have no RO entity in ROAPP_ENTITY_MAP. */
export function unmappedCatalog(entityMap: Record<string, number>): string[] {
  const missing: string[] = [];
  for (const item of [...packages, ...extras])
    for (const klass of vehicleClasses)
      if (!entityMap[`${item.id}:${klass.id}`] && !entityMap[item.id])
        missing.push(`${item.id}:${klass.id}`);
  for (const tier of pickupPricing.tiers)
    if (tier.amount > 0 && !entityMap[`pickup:${tier.id}`]) missing.push(`pickup:${tier.id}`);
  return missing;
}

function attempt<T>(fn: () => T): { value?: T; error?: string } {
  try {
    return { value: fn() };
  } catch (error) {
    return { error: error instanceof RoappError ? error.code : (error as Error).message };
  }
}

// Whole hours since an event; null when there is none.
const hoursSince = (column: string) => `floor(extract(epoch from (now()-${column}))/3600)::int`;

/** Aggregated state of the website → RO transfer: switches, configuration shape,
 * counts and error codes. The inspect log is public, so no booking numbers, exact
 * times, names, contacts, prices or secrets. Details stay in the operating panel. */
export async function roappDiagnostics(
  sql: Sql,
  options: { probe?: boolean; request?: RoappRequest } = {},
) {
  const backend = attempt(bookingBackend);
  const scope = attempt(roappAccountScope);
  const cutover = attempt(roappCutoverAt);
  const creds = attempt<RoappCredentials | null>(roappCredentialsFromEnv);
  const missingEnv = RO_ENV_KEYS.filter((key) => !process.env[key]?.trim());
  const [settings] = await sql<{ roapp_sync_enabled: boolean }>`
    select roapp_sync_enabled from shop_settings where shop_id=${SHOP}`;
  const [bookings] = await sql.query<{ last7d: number; latest_hours: number | null }>(
    `select count(*) filter (where created_at>now()-interval '7 days')::int as last7d,
       ${hoursSince("max(created_at)")} as latest_hours from bookings where shop_id=$1`,
    [SHOP],
  );
  const report: Record<string, unknown> = {
    ok: true,
    backend: backend.value ?? `invalid:${backend.error}`,
    syncEnabled: Boolean(settings?.roapp_sync_enabled),
    config: {
      accountScope: scope.error ? scope.error : "ok",
      cutoverAt: cutover.value ?? cutover.error,
      credentials: creds.error ? creds.error : creds.value ? "ok" : "missing",
      missingEnv,
      unmappedCatalog: creds.value ? unmappedCatalog(creds.value.entityMap) : null,
    },
    bookings: { last7d: bookings?.last7d ?? 0, hoursSinceLatest: bookings?.latest_hours ?? null },
  };
  if (scope.value && cutover.value) {
    const [since] = await sql<{ total: number; unqueued: number }>`
      select count(*)::int as total,
        count(*) filter (where not exists (select 1 from roapp_sync_queue q
          where q.booking_id=b.id and q.account_scope=${scope.value}))::int as unqueued
      from bookings b where b.shop_id=${SHOP} and b.created_at>=${cutover.value}::timestamptz`;
    const queue = await sql.query<{ status: string; count: number }>(
      `select status,count(*)::int as count from roapp_sync_queue
       where shop_id=$1 and account_scope=$2 group by status order by status`,
      [SHOP, scope.value],
    );
    const [other] = await sql<{ count: number }>`select count(*)::int as count
      from roapp_sync_queue where shop_id=${SHOP} and account_scope<>${scope.value}`;
    // Only the part before "|" (code, HTTP status, step); RO's detail stays private.
    const problems = await sql.query<{ problem: string; count: number }>(
      `select status||':'||coalesce(split_part(last_error,'|',1),'-') as problem,
         count(*)::int as count
       from roapp_sync_queue where shop_id=$1 and account_scope=$2 and status<>'synced'
       group by 1 order by 1`,
      [SHOP, scope.value],
    );
    const [progress] = await sql.query<{ contact: number; order: number }>(
      `select count(*) filter (where ro_contact_id is not null)::int as contact,
         count(*) filter (where ro_order_id is not null)::int as "order"
       from roapp_sync_queue where shop_id=$1 and account_scope=$2 and status<>'synced'`,
      [SHOP, scope.value],
    );
    const journal = await sql.query<{ operation: string; state: string }>(
      `select j.operation,j.state from roapp_write_journal j
       join roapp_sync_queue q on q.booking_id=j.booking_id
       where q.shop_id=$1 and q.account_scope=$2 and q.status<>'synced'
         and j.operation like $3`,
      [SHOP, scope.value, `${scope.value}:%`],
    );
    const writes: Record<string, number> = {};
    for (const row of journal) {
      const key = `${row.state}:${journalStep(row.operation)}`;
      writes[key] = (writes[key] || 0) + 1;
    }
    const [times] = await sql.query<{
      synced_hours: number | null;
      pending_hours: number | null;
    }>(
      `select ${hoursSince("max(updated_at) filter (where status='synced')")} as synced_hours,
         ${hoursSince("min(requested_at) filter (where status='pending')")} as pending_hours
       from roapp_sync_queue where shop_id=$1 and account_scope=$2`,
      [SHOP, scope.value],
    );
    const [runner] = await sql.query<{ locked: boolean }>(
      `select coalesce(locked_until>now(),false) as locked from roapp_sync_runner where shop_id=$1`,
      [SHOP],
    );
    Object.assign(report, {
      sinceCutover: { bookings: since?.total ?? 0, unqueued: since?.unqueued ?? 0 },
      queue: Object.fromEntries(queue.map((row) => [row.status, row.count])),
      otherAccountScopes: other?.count ?? 0,
      problems: Object.fromEntries(problems.map((row) => [row.problem, row.count])),
      openProgress: { contactKnown: progress?.contact ?? 0, orderKnown: progress?.order ?? 0 },
      openWrites: writes,
      hoursSinceLastTransfer: times?.synced_hours ?? null,
      hoursOldestWaiting: times?.pending_hours ?? null,
      runner: runner ? (runner.locked ? "running" : "idle") : "missing",
    });
  }
  if (options.probe) report.probe = await probeRoapp(creds.value ?? null, options.request);
  return report;
}

/** Read-only account check: GET /company including the account fingerprint. */
async function probeRoapp(creds: RoappCredentials | null, request?: RoappRequest) {
  if (!creds && !request) return "roapp_not_configured";
  try {
    await (request || createRoappClient(creds!, { maxRetries: 1 }))("GET", "/company");
    return "ok";
  } catch (error) {
    if (error instanceof RoappError)
      return error.status ? `${error.code}:${error.status}` : error.code;
    return "probe_failed";
  }
}
