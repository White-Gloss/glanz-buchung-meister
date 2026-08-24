-- Bind controlled ERPNext customer writes to one immutable booking revision.

alter table public.erpnext_customer_mappings
  add column if not exists processing_token uuid;

alter table public.booking_automation_state
  add column if not exists erpnext_customer_processing_at timestamptz,
  add column if not exists erpnext_customer_processing_expires_at timestamptz,
  add column if not exists erpnext_customer_processing_token uuid;

create or replace function public.block_booking_mutation_during_erpnext_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
      from public.booking_automation_state state
     where state.booking_id = old.id
       and (
         (
           state.erpnext_processing_at is not null
           and state.erpnext_processing_expires_at > now()
         )
         or (
           state.erpnext_customer_processing_at is not null
           and state.erpnext_customer_processing_expires_at > now()
         )
       )
  ) then
    raise exception using
      errcode = '55000',
      message = 'booking_locked_for_erpnext_sync';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.block_booking_mutation_during_erpnext_sync() from public;
revoke all on function public.block_booking_mutation_during_erpnext_sync() from anon;
revoke all on function public.block_booking_mutation_during_erpnext_sync() from authenticated;

create or replace function public.claim_erpnext_customer_booking_sync(
  p_booking_id uuid,
  p_booking_revision timestamptz,
  p_normalized_email text,
  p_ttl_seconds integer default 300
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_normalized_email, '')));
  v_booking_revision timestamptz;
  v_token uuid := gen_random_uuid();
  v_claimed boolean := false;
  v_ttl_seconds integer := least(greatest(coalesce(p_ttl_seconds, 300), 30), 900);
begin
  if v_email = '' or position('@' in v_email) <= 1 then
    return null;
  end if;

  select booking.updated_at
    into v_booking_revision
    from public.bookings booking
   where booking.id = p_booking_id
   for update;

  if not found or v_booking_revision is distinct from p_booking_revision then
    return null;
  end if;

  insert into public.booking_automation_state (booking_id)
  values (p_booking_id)
  on conflict (booking_id) do nothing;

  update public.booking_automation_state
     set erpnext_customer_processing_at = now(),
         erpnext_customer_processing_expires_at =
           now() + make_interval(secs => v_ttl_seconds),
         erpnext_customer_processing_token = v_token,
         updated_at = now()
   where booking_id = p_booking_id
     and (
       erpnext_customer_processing_at is null
       or erpnext_customer_processing_expires_at is null
       or erpnext_customer_processing_expires_at <= now()
     )
  returning true into v_claimed;

  if not coalesce(v_claimed, false) then
    return null;
  end if;

  insert into public.erpnext_customer_mappings (normalized_email)
  values (v_email)
  on conflict (normalized_email) do nothing;

  v_claimed := false;
  update public.erpnext_customer_mappings
     set processing_at = now(),
         processing_token = v_token,
         attempts = attempts + 1,
         updated_at = now()
   where normalized_email = v_email
     and synced_at is null
     and last_error is null
     and (
       processing_at is null
       or processing_at < now() - make_interval(secs => v_ttl_seconds)
     )
  returning true into v_claimed;

  if not coalesce(v_claimed, false) then
    update public.booking_automation_state
       set erpnext_customer_processing_at = null,
           erpnext_customer_processing_expires_at = null,
           erpnext_customer_processing_token = null,
           updated_at = now()
     where booking_id = p_booking_id
       and erpnext_customer_processing_token = v_token;
    return null;
  end if;

  return v_token;
end;
$$;

revoke all on function public.claim_erpnext_customer_booking_sync(uuid, timestamptz, text, integer)
  from public;
revoke all on function public.claim_erpnext_customer_booking_sync(uuid, timestamptz, text, integer)
  from anon;
revoke all on function public.claim_erpnext_customer_booking_sync(uuid, timestamptz, text, integer)
  from authenticated;
grant execute on function public.claim_erpnext_customer_booking_sync(uuid, timestamptz, text, integer)
  to service_role;

comment on column public.erpnext_customer_mappings.processing_token is
  'Fencing token for the active revision-bound ERPNext customer synchronization lease.';

comment on column public.booking_automation_state.erpnext_customer_processing_token is
  'Fencing token for the active booking mutation guard during ERPNext customer synchronization.';

comment on function public.claim_erpnext_customer_booking_sync(uuid, timestamptz, text, integer) is
  'Claims one customer mapping and its exact booking revision with a fenced, expiring mutation lease.';

