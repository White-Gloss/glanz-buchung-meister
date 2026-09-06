-- A booking reference alone must not authorize private photo uploads.
-- Legacy bookings keep NULL values and cannot receive anonymous uploads.
alter table bookings
  add column if not exists upload_token_hash text,
  add column if not exists upload_token_expires_at timestamptz;
