alter table shop_settings add column if not exists vibe_ai_api_key text;
create table if not exists vibe_agent_runs (
  shop_id text not null,
  user_id text not null,
  request_id uuid not null,
  fingerprint text not null,
  booking_id integer references bookings(id),
  status text not null check (status in ('running','succeeded','failed')),
  result text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (shop_id,user_id,request_id)
);
create index if not exists vibe_agent_runs_user_idx on vibe_agent_runs(shop_id,user_id,created_at);
-- Only the authenticated application server accesses these records. No public Data API.
alter table vibe_agent_runs enable row level security;

