-- White Gloss OS · additive Odoo migration foundation
--
-- ERPNext records stay intact for audit and rollback. New Odoo mappings are
-- deliberately server-only and all write automation remains default-deny.

alter table public.booking_automation_state
  add column if not exists odoo_partner_id bigint,
  add column if not exists odoo_vehicle_id bigint,
  add column if not exists odoo_order_id bigint,
  add column if not exists odoo_processing_at timestamptz,
  add column if not exists odoo_processing_token uuid,
  add column if not exists odoo_synced_at timestamptz,
  add column if not exists odoo_last_error text,
  add column if not exists odoo_last_http_status integer,
  add column if not exists odoo_attempts integer not null default 0;

create unique index if not exists booking_automation_state_odoo_order_id_uidx
  on public.booking_automation_state (odoo_order_id)
  where odoo_order_id is not null;

comment on column public.booking_automation_state.odoo_order_id is
  'Odoo White-Gloss order record id. ERPNext ids remain untouched during migration.';
comment on column public.booking_automation_state.odoo_last_error is
  'Sanitized error code only; never store credentials, headers, or raw upstream bodies.';

revoke all on table public.booking_automation_state from public, anon, authenticated;
grant select, insert, update, delete on table public.booking_automation_state to service_role;

create table if not exists public.odoo_customer_mappings (
  normalized_email text primary key,
  source_name text,
  odoo_partner_id bigint unique,
  processing_at timestamptz,
  processing_token uuid,
  synced_at timestamptz,
  last_error text,
  last_http_status integer,
  attempts integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint odoo_customer_mappings_email_normalized
    check (normalized_email = lower(btrim(normalized_email)) and position('@' in normalized_email) > 1)
);

comment on table public.odoo_customer_mappings is
  'Server-only deterministic Odoo partner mapping keyed by normalized customer email.';

alter table public.odoo_customer_mappings enable row level security;
revoke all on table public.odoo_customer_mappings from public, anon, authenticated;
grant select, insert, update, delete on table public.odoo_customer_mappings to service_role;

create policy "No direct client access to Odoo customer mappings"
  on public.odoo_customer_mappings
  for all
  to anon, authenticated
  using (false)
  with check (false);

create table if not exists public.odoo_healthcheck_state (
  id boolean primary key default true check (id),
  checked_at timestamptz not null default now(),
  stage text not null,
  ok boolean not null,
  upstream_status integer,
  detail text
);

comment on table public.odoo_healthcheck_state is
  'Latest sanitized server-side Odoo connectivity result.';

alter table public.odoo_healthcheck_state enable row level security;
revoke all on table public.odoo_healthcheck_state from public, anon, authenticated;
grant select, insert, update, delete on table public.odoo_healthcheck_state to service_role;

create policy "No direct client access to Odoo healthcheck state"
  on public.odoo_healthcheck_state
  for all
  to anon, authenticated
  using (false)
  with check (false);

