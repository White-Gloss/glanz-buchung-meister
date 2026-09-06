-- Durable delivery metadata. Existing queued/sent/failed messages are preserved.
alter table outbound_queue
  add column if not exists event_key text,
  add column if not exists legacy_status text,
  add column if not exists event_type text,
  add column if not exists booking_version integer,
  add column if not exists from_addr text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists first_attempt_at timestamptz,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists locked_until timestamptz,
  add column if not exists lease_token text,
  add column if not exists provider_message_id text,
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists updated_at timestamptz not null default now();

-- Historical queue-only messages have no reliable delivery proof. Never send a
-- backlog to real customers merely because the new worker has been installed.
update outbound_queue set legacy_status = status, status = 'review',
  last_error_code = 'legacy_delivery_unverified'
  where event_key is null and status in ('queued', 'failed');
update outbound_queue set event_key = 'legacy:' || id::text where event_key is null;
alter table outbound_queue alter column event_key set not null;
alter table outbound_queue alter column event_key set default ('manual:' || gen_random_uuid()::text);
create unique index if not exists outbound_event_key_idx on outbound_queue(shop_id, event_key);
create index if not exists outbound_due_idx on outbound_queue(shop_id, next_attempt_at, id)
  where status in ('queued', 'processing');
create index if not exists outbound_provider_message_idx on outbound_queue(provider_message_id)
  where provider_message_id is not null;
alter table shop_settings add column if not exists notification_worker_last_run_at timestamptz;
