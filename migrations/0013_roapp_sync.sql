alter table shop_settings add column if not exists roapp_sync_enabled boolean not null default false;

create table if not exists roapp_sync_queue (
  booking_id integer primary key references bookings(id),
  shop_id text not null default 'white-gloss',
  requested_version integer not null,
  synced_version integer not null default 0,
  status text not null default 'pending' check(status in ('pending','synced','failed','review')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  ro_contact_id integer,
  ro_booking_id integer,
  ro_order_id integer,
  booking_items_done boolean not null default false,
  order_items_done boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists roapp_sync_due_idx on roapp_sync_queue(status,next_attempt_at);

create table if not exists roapp_sync_runner (
  shop_id text primary key,
  lease_token text,
  locked_until timestamptz
);
insert into roapp_sync_runner(shop_id) values('white-gloss') on conflict do nothing;
