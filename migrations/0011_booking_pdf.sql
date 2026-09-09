-- Immutable attachment payload; retries must not use mutable booking data.
alter table outbound_queue add column if not exists attachments jsonb not null default '[]'::jsonb;
