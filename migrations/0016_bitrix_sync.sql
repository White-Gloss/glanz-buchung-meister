-- Bitrix24 / VibeCode: Website-Buchungen als CRM-Deals. Postgres bleibt die Buchungsquelle.

alter table bookings add column if not exists bitrix_contact_id integer;
alter table bookings add column if not exists bitrix_deal_id integer;
alter table bookings add column if not exists bitrix_event_id integer;
alter table bookings add column if not exists bitrix_last_error text;

create table if not exists bitrix_sync_queue (
  booking_id integer primary key references bookings(id),
  shop_id text not null default 'white-gloss',
  requested_version integer not null,
  synced_version integer not null default 0,
  status text not null default 'pending' check(status in ('pending','synced','failed','review')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  bitrix_contact_id integer,
  bitrix_deal_id integer,
  bitrix_event_id integer,
  photos_done boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists bitrix_sync_due_idx on bitrix_sync_queue(status,next_attempt_at);

create table if not exists bitrix_sync_runner (
  shop_id text primary key,
  lease_token text,
  locked_until timestamptz
);
insert into bitrix_sync_runner(shop_id) values('white-gloss') on conflict do nothing;
