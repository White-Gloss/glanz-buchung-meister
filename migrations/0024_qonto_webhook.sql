-- Dedup key only. The raw Qonto body stays out of the database:
-- invoices and transactions can contain names, mail addresses and IBANs.
-- Additive only; the application applies the identical DDL at runtime
-- (ensureQontoWebhookSchema), so this file is not part of the release gate
-- (scripts/write-release-manifest.mjs).
create table if not exists qonto_webhook_receipts (
  event_id text primary key check (event_id ~ '^[A-Za-z0-9_-]{8,80}$'),
  event_type text not null check (event_type ~ '^[a-z0-9/_-]{1,48}$'),
  outcome text not null check (outcome ~ '^[a-z_]{1,32}$'),
  booking_id integer,
  received_at timestamptz not null default now()
);
