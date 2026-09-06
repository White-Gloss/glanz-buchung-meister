create table if not exists booking_photos (
  id serial primary key,
  shop_id text not null default 'white-gloss',
  booking_id integer not null references bookings(id) on delete cascade,
  storage_path text not null,
  mime text not null,
  size_bytes integer not null,
  original_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists booking_photos_booking_idx
  on booking_photos (shop_id, booking_id, created_at desc);
