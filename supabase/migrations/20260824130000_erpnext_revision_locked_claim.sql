-- Prevent a booking from changing between production-write approval and the
-- corresponding ERPNext vehicle/order commit.

alter table public.booking_automation_state
  add column if not exists erpnext_processing_expires_at timestamptz;

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
       and state.erpnext_processing_at is not null
       and state.erpnext_processing_expires_at > now()
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

drop trigger if exists block_booking_mutation_during_erpnext_sync on public.bookings;
create trigger block_booking_mutation_during_erpnext_sync
before update or delete on public.bookings
for each row
execute function public.block_booking_mutation_during_erpnext_sync();

-- Replace the old claim with a revision-aware claim. The row lock serializes
-- the claim with a concurrent booking update; the trigger above protects the
-- booking against updates and deletion for the remainder of the external
-- ERPNext commit.
drop function if exists public.claim_erpnext_booking_sync(uuid, integer);

create function public.claim_erpnext_booking_sync(
  p_booking_id uuid,
  p_booking_revision timestamptz,
  p_ttl_minutes integer default 10
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_revision timestamptz;
  v_claimed boolean := false;
begin
  select booking.updated_at
    into v_booking_revision
    from public.bookings booking
   where booking.id = p_booking_id
   for update;

  if not found or v_booking_revision is distinct from p_booking_revision then
    return false;
  end if;

  insert into public.booking_automation_state (booking_id)
  values (p_booking_id)
  on conflict (booking_id) do nothing;

  update public.booking_automation_state
     set erpnext_processing_at = now(),
         erpnext_processing_expires_at =
           now() + make_interval(mins => least(greatest(coalesce(p_ttl_minutes, 10), 1), 60)),
         erpnext_attempts = erpnext_attempts + 1,
         updated_at = now()
   where booking_id = p_booking_id
     and erpnext_last_error is null
     and (
       erpnext_processing_at is null
       or erpnext_processing_expires_at is null
       or erpnext_processing_expires_at <= now()
     )
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.claim_erpnext_booking_sync(uuid, timestamptz, integer) from public;
revoke all on function public.claim_erpnext_booking_sync(uuid, timestamptz, integer) from anon;
revoke all on function public.claim_erpnext_booking_sync(uuid, timestamptz, integer) from authenticated;
grant execute on function public.claim_erpnext_booking_sync(uuid, timestamptz, integer) to service_role;

comment on function public.claim_erpnext_booking_sync(uuid, timestamptz, integer) is
  'Atomically claims one booking revision for ERPNext sync and leases its update/delete lock until processing is cleared or expires.';
