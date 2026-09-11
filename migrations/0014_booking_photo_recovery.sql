alter table booking_photos add column if not exists content_hash text;
alter table booking_photos add column if not exists upload_state text not null default 'ready';
alter table booking_photos add column if not exists upload_lease text;
alter table booking_photos add column if not exists upload_until timestamptz;
alter table booking_photos add column if not exists updated_at timestamptz not null default now();
create unique index if not exists booking_photos_content_idx on booking_photos(shop_id,booking_id,content_hash);
alter table booking_photos enable row level security;
