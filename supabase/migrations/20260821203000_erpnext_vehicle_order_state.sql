-- WHITE GLOSS OS · vehicle/order sync state
-- Additive only. No business data is rewritten.

alter table public.booking_automation_state
  add column if not exists erpnext_vehicle_id text;

create index if not exists booking_automation_state_erpnext_vehicle_id_idx
  on public.booking_automation_state (erpnext_vehicle_id)
  where erpnext_vehicle_id is not null;

comment on column public.booking_automation_state.erpnext_vehicle_id is
  'WHITE GLOSS Vehicle name linked to this booking after deterministic ERPNext synchronization.';

comment on column public.booking_automation_state.erpnext_order_id is
  'WHITE GLOSS Order name linked to this booking; unique when present.';
