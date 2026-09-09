alter table shop_settings add column if not exists odoo_sync_enabled boolean not null default false;

create table if not exists odoo_sync_queue (
  booking_id integer primary key references bookings(id),
  shop_id text not null default 'white-gloss',
  requested_version integer not null,
  synced_version integer not null default 0,
  status text not null default 'pending' check(status in ('pending','synced','failed','review')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  odoo_order_id integer,
  updated_at timestamptz not null default now()
);
create index if not exists odoo_sync_due_idx on odoo_sync_queue(status,next_attempt_at);

-- A durable marker is committed BEFORE each remote create. An uncertain result
-- can only be reconciled by external ID; it must never blindly create again.
create table if not exists odoo_record_links (
  model text not null,
  external_id text not null,
  remote_id integer,
  create_attempted boolean not null default false,
  primary key(model,external_id)
);
create table if not exists odoo_sync_runner (
  shop_id text primary key,
  lease_token text,
  locked_until timestamptz
);
insert into odoo_sync_runner(shop_id) values('white-gloss') on conflict do nothing;

-- Existing requests are queued, but no remote write occurs until enabled.
insert into odoo_sync_queue(booking_id,shop_id,requested_version)
select id,shop_id,version from bookings where shop_id='white-gloss'
on conflict(booking_id) do nothing;
