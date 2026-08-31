create table if not exists cms_items (
  id serial primary key,
  shop_id text not null default 'white-gloss',
  kind text not null,
  slug text,
  title text not null,
  body text not null default '',
  extra text not null default '{}',
  published boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cms_shop_kind_idx on cms_items (shop_id, kind, published, sort);

create table if not exists outbound_queue (
  id serial primary key,
  shop_id text not null default 'white-gloss',
  channel text not null,
  direction text not null default 'out',
  to_addr text,
  subject text,
  body text not null,
  booking_id integer,
  status text not null default 'queued',
  created_at timestamptz not null default now()
);
create index if not exists outbound_shop_idx on outbound_queue (shop_id, created_at desc);

create table if not exists automation_events (
  id serial primary key,
  shop_id text not null default 'white-gloss',
  area text not null,
  event text not null,
  severity text not null default 'info',
  context text,
  created_at timestamptz not null default now()
);
create index if not exists automation_events_shop_idx on automation_events (shop_id, created_at desc);
