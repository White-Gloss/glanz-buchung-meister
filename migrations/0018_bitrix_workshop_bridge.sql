-- The native Bitrix workshop uses the website reservation and delivery ledger.
alter table bookings add column if not exists bitrix_workshop_managed boolean not null default false;
alter table bookings add column if not exists bitrix_final_rows jsonb;
alter table bookings add column if not exists bitrix_invoice_id integer;
create table if not exists bitrix_bridge_requests (
  shop_id text not null,
  request_id text not null,
  body_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key(shop_id,request_id)
);
alter table bitrix_bridge_requests enable row level security;
revoke all on bitrix_bridge_requests from public;
