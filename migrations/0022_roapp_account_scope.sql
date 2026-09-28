-- Existing identifiers belong to retired accounts and must never be reused.
alter table roapp_sync_queue add column if not exists account_scope text not null default 'legacy';
create index if not exists roapp_queue_account_pending on roapp_sync_queue(account_scope,status,next_attempt_at);
alter table roapp_order_state add column if not exists owner_confirmed_at timestamptz;
alter table roapp_order_state add column if not exists completed_at timestamptz;
alter table bookings add column if not exists review_email_consent boolean not null default false;
