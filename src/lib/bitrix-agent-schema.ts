import type { Sql } from "./db.ts";

export const BOOKING_AGENT_SCHEMA =
  "-- Advisory AI only. The application connects with its server database role.\n-- No browser/Data API access to prompts, results or credentials.\nalter table shop_settings add column if not exists vibe_ai_api_key text;\ncreate table if not exists booking_agent_runs (\n  request_id uuid primary key,\n  shop_id text not null,\n  user_id text not null,\n  booking_id integer references bookings(id),\n  booking_version integer,\n  fingerprint text not null,\n  status text not null check(status in ('processing','done','failed')),\n  answer jsonb,\n  error text,\n  created_at timestamptz not null default now(),\n  finished_at timestamptz\n);\nalter table booking_agent_runs enable row level security;\nrevoke all on booking_agent_runs from public;\ncreate index if not exists booking_agent_runs_owner_idx on booking_agent_runs(shop_id,user_id,created_at desc);\n";

const pending = new WeakMap<Sql, Promise<void>>();

/** Apply the additive private AI log schema atomically on existing VPS releases. */
export async function ensureBookingAgentSchema(sql: Sql) {
  let task = pending.get(sql);
  if (!task) {
    task = sql
      .transaction(async (tx) => {
        // This migration contains only simple DDL statements, no function bodies.
        // Both pg and PGlite use the prepared-query interface here.
        for (const statement of BOOKING_AGENT_SCHEMA.split(";").filter((part) => part.trim())) {
          await tx.query(statement);
        }
      })
      .catch((error) => {
        pending.delete(sql);
        throw error;
      });
    pending.set(sql, task);
  }
  await task;
}
