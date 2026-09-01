create table if not exists bookings (
  id serial primary key,
  shop_id text not null default 'white-gloss',
  status text not null default 'neu',
  customer_name text not null,
  phone text not null,
  email text,
  preferred_date date,
  preferred_slot text,
  package_id text not null,
  class_id text not null,
  extra_ids text not null default '[]',
  city_slug text,
  note text,
  total_cents integer not null default 0,
  pickup_cents integer not null default 0,
  handled_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bookings_shop_status_idx on bookings (shop_id, status, created_at desc);
create index if not exists bookings_shop_date_idx on bookings (shop_id, preferred_date);

create table if not exists customers (
  id serial primary key,
  shop_id text not null default 'white-gloss',
  name text not null,
  phone text not null,
  email text,
  notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists customers_shop_phone_idx on customers (shop_id, phone);

create table if not exists inbox_messages (
  id serial primary key,
  shop_id text not null default 'white-gloss',
  channel text not null,
  direction text not null default 'in',
  sender text,
  subject text,
  body text not null,
  booking_id integer,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists inbox_shop_created_idx on inbox_messages (shop_id, created_at desc);

create table if not exists documents (
  id serial primary key,
  shop_id text not null default 'white-gloss',
  booking_id integer,
  customer_id integer,
  kind text not null,
  title text not null,
  amount_cents integer not null default 0,
  status text not null default 'entwurf',
  body text not null default '',
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists documents_shop_idx on documents (shop_id, created_at desc);

create table if not exists agent_commands (
  id serial primary key,
  shop_id text not null default 'white-gloss',
  channel text not null,
  input text not null,
  result text not null,
  user_id text,
  created_at timestamptz not null default now()
);
create index if not exists agent_commands_shop_idx on agent_commands (shop_id, created_at desc);
