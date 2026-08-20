create table if not exists public.erpnext_customer_mappings (
  normalized_email text primary key,
  source_name text,
  erpnext_customer_id text unique,
  erpnext_contact_id text unique,
  processing_at timestamptz,
  synced_at timestamptz,
  last_error text,
  last_http_status integer,
  attempts integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint erpnext_customer_mappings_email_normalized
    check (normalized_email = lower(btrim(normalized_email)) and position('@' in normalized_email) > 1)
);

comment on table public.erpnext_customer_mappings is
  'Server-only deterministic ERPNext customer/contact mapping keyed by normalized customer email.';
comment on column public.erpnext_customer_mappings.last_error is
  'Sanitized synchronization error only. Never store credentials, authorization headers, or raw upstream response bodies.';

alter table public.erpnext_customer_mappings enable row level security;

revoke all on table public.erpnext_customer_mappings from public, anon, authenticated;
grant select, insert, update, delete on table public.erpnext_customer_mappings to service_role;

create or replace function public.claim_erpnext_customer_sync(
  _normalized_email text,
  _ttl_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(_normalized_email, '')));
  v_rows integer := 0;
begin
  if v_email = '' or position('@' in v_email) <= 1 then
    return false;
  end if;

  insert into public.erpnext_customer_mappings (normalized_email)
  values (v_email)
  on conflict (normalized_email) do nothing;

  update public.erpnext_customer_mappings
     set processing_at = now(),
         attempts = attempts + 1,
         updated_at = now()
   where normalized_email = v_email
     and synced_at is null
     and last_error is null
     and (
       processing_at is null
       or processing_at < now() - make_interval(secs => greatest(coalesce(_ttl_seconds, 300), 30))
     );

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

revoke all on function public.claim_erpnext_customer_sync(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_erpnext_customer_sync(text, integer) to service_role;
