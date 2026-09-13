import type { Sql } from "./db.ts";
export const BITRIX_WORKSHOP_SCHEMA =
  "-- The native Bitrix workshop uses the website reservation and delivery ledger.\nalter table bookings add column if not exists bitrix_workshop_managed boolean not null default false;\nalter table bookings add column if not exists bitrix_final_rows jsonb;\nalter table bookings add column if not exists bitrix_invoice_id integer;\ncreate table if not exists bitrix_bridge_requests (\n  shop_id text not null,\n  request_id text not null,\n  body_hash text not null,\n  response jsonb not null,\n  created_at timestamptz not null default now(),\n  primary key(shop_id,request_id)\n);\nalter table bitrix_bridge_requests enable row level security;\nrevoke all on bitrix_bridge_requests from public;\n";
const pending = new WeakMap<Sql, Promise<void>>();
export async function ensureBitrixWorkshopSchema(sql: Sql) {
  let task = pending.get(sql);
  if (!task) {
    task = sql
      .transaction(async (tx) => {
        for (const statement of BITRIX_WORKSHOP_SCHEMA.split(";").filter((part) => part.trim()))
          await tx.query(statement);
      })
      .catch((error) => {
        pending.delete(sql);
        throw error;
      });
    pending.set(sql, task);
  }
  await task;
}
