alter table shop_settings add column if not exists lexware_sync_enabled boolean not null default false;

create table if not exists lexware_sync_queue (
  booking_id integer primary key references bookings(id),
  shop_id text not null default 'white-gloss',
  requested_version integer not null,
  synced_version integer not null default 0,
  status text not null default 'pending' check(status in ('pending','synced','failed','review')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  lex_contact_id text,
  lex_invoice_id text,
  updated_at timestamptz not null default now()
);
create index if not exists lexware_sync_due_idx on lexware_sync_queue(status,next_attempt_at);

create table if not exists lexware_sync_runner (
  shop_id text primary key,
  lease_token text,
  locked_until timestamptz
);
insert into lexware_sync_runner(shop_id) values('white-gloss') on conflict do nothing;
