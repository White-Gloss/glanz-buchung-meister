-- WHITE GLOSS OS · ERPNext integration foundation
-- Additive migration: no existing booking data is rewritten.

-- Trigger functions must not be directly callable through PostgREST.
-- The trigger itself continues to execute when bookings are inserted/updated.
revoke execute on function public.reject_duplicate_booking_submission() from public;
revoke execute on function public.reject_duplicate_booking_submission() from anon;
revoke execute on function public.reject_duplicate_booking_submission() from authenticated;

alter table public.booking_automation_state
  add column if not exists erpnext_customer_id text,
  add column if not exists erpnext_order_id text,
  add column if not exists erpnext_processing_at timestamptz,
  add column if not exists erpnext_synced_at timestamptz,
  add column if not exists erpnext_last_error text,
  add column if not exists erpnext_last_http_status integer,
  add column if not exists erpnext_attempts integer not null default 0;

create unique index if not exists booking_automation_state_erpnext_order_id_uidx
  on public.booking_automation_state (erpnext_order_id)
  where erpnext_order_id is not null;

comment on table public.booking_automation_state is
  'Server-only state for Lexware, ERPNext and appointment-reminder automation.';

comment on column public.booking_automation_state.erpnext_order_id is
  'ERPNext Sales Order name linked to this booking; unique when present.';

comment on column public.booking_automation_state.erpnext_last_error is
  'Last sanitized ERPNext sync error. Never store credentials or authorization headers here.';
