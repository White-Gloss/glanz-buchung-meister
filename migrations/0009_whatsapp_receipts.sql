-- Receipt and outbox update are committed in one statement by the webhook handler.
-- Store a digest only: no full webhook bodies, phone numbers or customer data.
create table if not exists whatsapp_webhook_receipts (
  event_hash text primary key check (event_hash ~ '^[a-f0-9]{64}$'),
  received_at timestamptz not null default now()
);
