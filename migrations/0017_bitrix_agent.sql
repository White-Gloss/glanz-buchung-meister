-- Advisory AI only. The application connects with its server database role.
-- No browser/Data API access to prompts, results or credentials.
alter table shop_settings add column if not exists vibe_ai_api_key text;
create table if not exists booking_agent_runs (
  request_id uuid primary key,
  shop_id text not null,
  user_id text not null,
  booking_id integer references bookings(id),
  booking_version integer,
  fingerprint text not null,
  status text not null check(status in ('processing','done','failed')),
  answer jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table booking_agent_runs enable row level security;
revoke all on booking_agent_runs from public;
create index if not exists booking_agent_runs_owner_idx on booking_agent_runs(shop_id,user_id,created_at desc);
