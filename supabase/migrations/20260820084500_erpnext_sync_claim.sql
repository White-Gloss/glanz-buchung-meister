-- Atomically claims one booking for ERPNext synchronization.
-- Failed syncs are intentionally not retried automatically until the
-- recorded error has been reviewed and explicitly cleared.

create or replace function public.claim_erpnext_booking_sync(
  p_booking_id uuid,
  p_ttl_minutes integer default 10
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed boolean := false;
begin
  insert into public.booking_automation_state (booking_id)
  values (p_booking_id)
  on conflict (booking_id) do nothing;

  update public.booking_automation_state
     set erpnext_processing_at = now(),
         erpnext_attempts = erpnext_attempts + 1,
         updated_at = now()
   where booking_id = p_booking_id
     and erpnext_order_id is null
     and erpnext_last_error is null
     and (
       erpnext_processing_at is null
       or erpnext_processing_at < now() - make_interval(mins => greatest(p_ttl_minutes, 1))
     )
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.claim_erpnext_booking_sync(uuid, integer) from public;
revoke all on function public.claim_erpnext_booking_sync(uuid, integer) from anon;
revoke all on function public.claim_erpnext_booking_sync(uuid, integer) from authenticated;
grant execute on function public.claim_erpnext_booking_sync(uuid, integer) to service_role;

comment on function public.claim_erpnext_booking_sync(uuid, integer) is
  'Atomically claims one booking for ERPNext sync. Failed syncs are not retried automatically until their error is explicitly cleared.';
