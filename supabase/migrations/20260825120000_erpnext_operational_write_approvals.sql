-- WHITE GLOSS OS · durable, single-use ERPNext write approvals
--
-- The global Edge Function switches remain emergency kill switches. An
-- individual production write additionally needs one short-lived approval
-- for the exact booking revision and write scope. The approval is consumed
-- in the same database transaction that acquires the existing sync lease.

alter table public.booking_automation_state
  add column if not exists erpnext_processing_token uuid;

comment on column public.booking_automation_state.erpnext_processing_token is
  'Fencing token for the active vehicle/order mutation lease. Completion and failure updates must match it.';

revoke all on table public.booking_automation_state from public, anon, authenticated;
revoke all on table public.erpnext_customer_mappings from public, anon, authenticated;
grant select, insert, update, delete on table public.booking_automation_state to service_role;
grant select, insert, update, delete on table public.erpnext_customer_mappings to service_role;

create policy "No direct client access to ERPNext automation state"
  on public.booking_automation_state
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "No direct client access to ERPNext customer mappings"
  on public.erpnext_customer_mappings
  for all
  to anon, authenticated
  using (false)
  with check (false);

create table if not exists public.erpnext_write_approvals (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  booking_revision timestamptz not null,
  scope text not null,
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by uuid,
  consumer text,
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,
  constraint erpnext_write_approvals_scope_check
    check (scope in ('customer', 'vehicle_order')),
  constraint erpnext_write_approvals_expiry_check
    check (
      expires_at > approved_at
      and expires_at <= approved_at + interval '5 minutes'
    ),
  constraint erpnext_write_approvals_terminal_state_check
    check (not (consumed_at is not null and revoked_at is not null)),
  constraint erpnext_write_approvals_consumed_actor_check
    check (
      (consumed_at is null and consumed_by is null and consumer is null)
      or
      (consumed_at is not null and consumed_by is not null and consumer is not null)
    ),
  constraint erpnext_write_approvals_revoked_actor_check
    check (
      (revoked_at is null and revoked_by is null and revoke_reason is null)
      or
      (revoked_at is not null and revoked_by is not null and revoke_reason is not null)
    )
);

comment on table public.erpnext_write_approvals is
  'Server-only audit trail for short-lived, single-use ERPNext writes bound to one booking revision and scope.';
comment on column public.erpnext_write_approvals.approved_by is
  'Verified Supabase admin user id. Kept as an immutable audit value even if the auth user is later removed.';
comment on column public.erpnext_write_approvals.consumer is
  'Fixed Edge Function name that atomically consumed the approval while acquiring the sync lease.';

create unique index if not exists erpnext_write_approvals_one_active_scope_uidx
  on public.erpnext_write_approvals (booking_id, scope)
  where consumed_at is null and revoked_at is null;

create index if not exists erpnext_write_approvals_active_lookup_idx
  on public.erpnext_write_approvals (booking_id, booking_revision, scope, expires_at)
  where consumed_at is null and revoked_at is null;

alter table public.erpnext_write_approvals enable row level security;

revoke all on table public.erpnext_write_approvals from public, anon, authenticated, service_role;
grant select on table public.erpnext_write_approvals to service_role;

-- This policy documents the direct-client boundary and also prevents the
-- security advisor from mistaking an intentionally server-only table for an
-- unreviewed RLS configuration. service_role continues to use its explicit
-- table privileges and bypasses RLS.
create policy "No direct client access to ERPNext write approvals"
  on public.erpnext_write_approvals
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.create_erpnext_write_approval(
  p_booking_id uuid,
  p_booking_revision timestamptz,
  p_scope text,
  p_approved_by uuid,
  p_ttl_seconds integer default 300
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_revision timestamptz;
  v_booking_status text;
  v_approval_id uuid;
  v_ttl_seconds integer := least(greatest(coalesce(p_ttl_seconds, 300), 60), 300);
begin
  if p_scope not in ('customer', 'vehicle_order') then
    return null;
  end if;

  if not exists (
    select 1
      from public.user_roles roles
     where roles.user_id = p_approved_by
       and roles.role = 'admin'::public.app_role
  ) then
    return null;
  end if;

  select booking.updated_at, booking.status
    into v_booking_revision, v_booking_status
    from public.bookings booking
   where booking.id = p_booking_id
   for update;

  if not found
     or v_booking_revision is distinct from p_booking_revision
     or v_booking_status not in ('Bestätigt', 'Bezahlt') then
    return null;
  end if;

  -- A retry or a deliberate new approval supersedes the previous unconsumed
  -- approval. This also retires expired rows before the partial unique index
  -- is used for the new record.
  update public.erpnext_write_approvals approval
     set revoked_at = now(),
         revoked_by = p_approved_by,
         revoke_reason = case
           when approval.expires_at <= now() then 'expired_replaced'
           else 'superseded_by_new_approval'
         end
   where approval.booking_id = p_booking_id
     and approval.scope = p_scope
     and approval.consumed_at is null
     and approval.revoked_at is null;

  insert into public.erpnext_write_approvals (
    booking_id,
    booking_revision,
    scope,
    approved_by,
    expires_at
  )
  values (
    p_booking_id,
    p_booking_revision,
    p_scope,
    p_approved_by,
    now() + make_interval(secs => v_ttl_seconds)
  )
  returning id into v_approval_id;

  return v_approval_id;
end;
$$;

revoke all on function public.create_erpnext_write_approval(uuid, timestamptz, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.create_erpnext_write_approval(uuid, timestamptz, text, uuid, integer)
  to service_role;

comment on function public.create_erpnext_write_approval(uuid, timestamptz, text, uuid, integer) is
  'Creates one short-lived ERPNext approval after locking and rechecking the exact eligible booking revision and verified admin actor.';

-- Disable the previous approval-free claim signature. Keeping a fail-closed
-- overload avoids a deployment window in which older Edge Function code can
-- accidentally obtain an approval-free lease.
create or replace function public.claim_erpnext_booking_sync(
  p_booking_id uuid,
  p_booking_revision timestamptz,
  p_ttl_minutes integer default 10
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return false;
end;
$$;

revoke all on function public.claim_erpnext_booking_sync(uuid, timestamptz, integer)
  from public, anon, authenticated, service_role;

create or replace function public.claim_erpnext_booking_sync(
  p_booking_id uuid,
  p_booking_revision timestamptz,
  p_approval_id uuid,
  p_consumed_by uuid,
  p_ttl_minutes integer default 10
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_revision timestamptz;
  v_booking_status text;
  v_token uuid := gen_random_uuid();
  v_claimed boolean := false;
  v_rows integer := 0;
begin
  select booking.updated_at, booking.status
    into v_booking_revision, v_booking_status
    from public.bookings booking
   where booking.id = p_booking_id
   for update;

  if not found
     or v_booking_revision is distinct from p_booking_revision
     or v_booking_status not in ('Bestätigt', 'Bezahlt') then
    return null;
  end if;

  if not exists (
    select 1
      from public.user_roles roles
     where roles.user_id = p_consumed_by
       and roles.role = 'admin'::public.app_role
  ) then
    return null;
  end if;

  perform 1
    from public.erpnext_write_approvals approval
   where approval.id = p_approval_id
     and approval.booking_id = p_booking_id
     and approval.booking_revision = p_booking_revision
     and approval.scope = 'vehicle_order'
     and approval.expires_at > now()
     and approval.consumed_at is null
     and approval.revoked_at is null
   for update;

  if not found then
    return null;
  end if;

  insert into public.booking_automation_state (booking_id)
  values (p_booking_id)
  on conflict (booking_id) do nothing;

  update public.booking_automation_state state
     set erpnext_processing_at = now(),
         erpnext_processing_expires_at =
           now() + make_interval(mins => least(greatest(coalesce(p_ttl_minutes, 10), 1), 60)),
         erpnext_processing_token = v_token,
         erpnext_attempts = state.erpnext_attempts + 1,
         updated_at = now()
   where state.booking_id = p_booking_id
     and state.erpnext_last_error is null
     and (
       state.erpnext_processing_at is null
       or state.erpnext_processing_expires_at is null
       or state.erpnext_processing_expires_at <= now()
     )
  returning true into v_claimed;

  if not coalesce(v_claimed, false) then
    return null;
  end if;

  update public.erpnext_write_approvals approval
     set consumed_at = now(),
         consumed_by = p_consumed_by,
         consumer = 'erpnext-vehicle-order-commit'
   where approval.id = p_approval_id
     and approval.consumed_at is null
     and approval.revoked_at is null
     and approval.expires_at > now();

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception using
      errcode = '55000',
      message = 'erpnext_write_approval_consumption_failed';
  end if;

  return v_token;
end;
$$;

revoke all on function public.claim_erpnext_booking_sync(uuid, timestamptz, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_erpnext_booking_sync(uuid, timestamptz, uuid, uuid, integer)
  to service_role;

comment on function public.claim_erpnext_booking_sync(uuid, timestamptz, uuid, uuid, integer) is
  'Atomically validates and consumes one vehicle/order approval while claiming the exact booking revision and fenced mutation lease.';

-- Disable the previous approval-free customer claim signature for the same
-- fail-closed deployment behavior.
create or replace function public.claim_erpnext_customer_booking_sync(
  p_booking_id uuid,
  p_booking_revision timestamptz,
  p_normalized_email text,
  p_ttl_seconds integer default 300
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return null;
end;
$$;

revoke all on function public.claim_erpnext_customer_booking_sync(uuid, timestamptz, text, integer)
  from public, anon, authenticated, service_role;

create or replace function public.claim_erpnext_customer_booking_sync(
  p_booking_id uuid,
  p_booking_revision timestamptz,
  p_normalized_email text,
  p_approval_id uuid,
  p_consumed_by uuid,
  p_ttl_seconds integer default 300
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_normalized_email, '')));
  v_booking_revision timestamptz;
  v_booking_status text;
  v_token uuid := gen_random_uuid();
  v_claimed boolean := false;
  v_rows integer := 0;
  v_ttl_seconds integer := least(greatest(coalesce(p_ttl_seconds, 300), 30), 900);
begin
  if v_email = '' or position('@' in v_email) <= 1 then
    return null;
  end if;

  select booking.updated_at, booking.status
    into v_booking_revision, v_booking_status
    from public.bookings booking
   where booking.id = p_booking_id
   for update;

  if not found
     or v_booking_revision is distinct from p_booking_revision
     or v_booking_status not in ('Bestätigt', 'Bezahlt') then
    return null;
  end if;

  if not exists (
    select 1
      from public.user_roles roles
     where roles.user_id = p_consumed_by
       and roles.role = 'admin'::public.app_role
  ) then
    return null;
  end if;

  perform 1
    from public.erpnext_write_approvals approval
   where approval.id = p_approval_id
     and approval.booking_id = p_booking_id
     and approval.booking_revision = p_booking_revision
     and approval.scope = 'customer'
     and approval.expires_at > now()
     and approval.consumed_at is null
     and approval.revoked_at is null
   for update;

  if not found then
    return null;
  end if;

  insert into public.booking_automation_state (booking_id)
  values (p_booking_id)
  on conflict (booking_id) do nothing;

  update public.booking_automation_state state
     set erpnext_customer_processing_at = now(),
         erpnext_customer_processing_expires_at =
           now() + make_interval(secs => v_ttl_seconds),
         erpnext_customer_processing_token = v_token,
         updated_at = now()
   where state.booking_id = p_booking_id
     and (
       state.erpnext_customer_processing_at is null
       or state.erpnext_customer_processing_expires_at is null
       or state.erpnext_customer_processing_expires_at <= now()
     )
  returning true into v_claimed;

  if not coalesce(v_claimed, false) then
    return null;
  end if;

  insert into public.erpnext_customer_mappings (normalized_email)
  values (v_email)
  on conflict (normalized_email) do nothing;

  v_claimed := false;
  update public.erpnext_customer_mappings mapping
     set processing_at = now(),
         processing_token = v_token,
         attempts = mapping.attempts + 1,
         updated_at = now()
   where mapping.normalized_email = v_email
     and mapping.synced_at is null
     and mapping.last_error is null
     and (
       mapping.processing_at is null
       or mapping.processing_at < now() - make_interval(secs => v_ttl_seconds)
     )
  returning true into v_claimed;

  if not coalesce(v_claimed, false) then
    update public.booking_automation_state state
       set erpnext_customer_processing_at = null,
           erpnext_customer_processing_expires_at = null,
           erpnext_customer_processing_token = null,
           updated_at = now()
     where state.booking_id = p_booking_id
       and state.erpnext_customer_processing_token = v_token;
    return null;
  end if;

  update public.erpnext_write_approvals approval
     set consumed_at = now(),
         consumed_by = p_consumed_by,
         consumer = 'erpnext-sync-customer'
   where approval.id = p_approval_id
     and approval.consumed_at is null
     and approval.revoked_at is null
     and approval.expires_at > now();

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception using
      errcode = '55000',
      message = 'erpnext_write_approval_consumption_failed';
  end if;

  return v_token;
end;
$$;

revoke all on function public.claim_erpnext_customer_booking_sync(uuid, timestamptz, text, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_erpnext_customer_booking_sync(uuid, timestamptz, text, uuid, uuid, integer)
  to service_role;

comment on function public.claim_erpnext_customer_booking_sync(uuid, timestamptz, text, uuid, uuid, integer) is
  'Atomically validates and consumes one customer approval while claiming the exact booking revision, customer mapping and fenced mutation lease.';
