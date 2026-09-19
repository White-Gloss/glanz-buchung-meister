alter table roapp_sync_queue add column if not exists requested_at timestamptz not null default clock_timestamp();
alter table roapp_sync_queue add column if not exists remote_checked_at timestamptz;
create unique index if not exists roapp_order_mapping_idx on roapp_sync_queue(ro_order_id) where ro_order_id is not null;
create table if not exists roapp_order_state (
  booking_id integer primary key references bookings(id) on delete cascade,
  status_id integer not null,
  status_name text not null,
  amount_cents integer not null check(amount_cents>=0),
  inquiry_cents integer not null check(inquiry_cents>=0),
  fixed_price boolean not null default false,
  public_url text,
  scheduled_for timestamptz,
  remote_modified_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create table if not exists roapp_order_history (
  id bigserial primary key,
  booking_id integer not null references bookings(id) on delete cascade,
  status_name text not null,
  amount_cents integer not null,
  fixed_price boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists roapp_history_booking_idx on roapp_order_history(booking_id,id);
