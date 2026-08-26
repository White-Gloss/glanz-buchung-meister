\set ON_ERROR_STOP on

-- Contract test for the durable, single-use ERPNext write approval boundary.
-- This file is executed only against the disposable database created by
-- scripts/check-erpnext-operational-approval.sh.

set client_min_messages = warning;

create or replace function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'ERPNext approval contract failed: %', p_message;
  end if;
end;
$$;

create temporary table approval_contract_results (
  label text primary key,
  value uuid
);
grant select, insert, update, delete on approval_contract_results to service_role;

insert into auth.users (id, email)
values
  ('10000000-0000-4000-8000-000000000001', 'approval-admin@example.invalid'),
  ('10000000-0000-4000-8000-000000000002', 'approval-user@example.invalid');

insert into public.user_roles (user_id, role)
values ('10000000-0000-4000-8000-000000000001', 'admin');

insert into public.bookings (
  id,
  invoice_number,
  vehicle_id,
  package_id,
  booking_date,
  booking_time,
  customer_name,
  customer_email,
  customer_phone,
  customer_plate,
  total,
  status,
  updated_at
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    'WGD-APPROVAL-CUSTOMER',
    'limousine',
    'basis',
    '2026-08-30',
    '08:00',
    'Customer Contract',
    'customer.contract@example.invalid',
    '+49 170 0000001',
    'WG-C-1',
    199,
    'Bestätigt',
    '2026-08-26 08:00:01+00'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'WGD-APPROVAL-VEHICLE',
    'suv',
    'premium',
    '2026-08-30',
    '09:00',
    'Vehicle Contract',
    'vehicle.contract@example.invalid',
    '+49 170 0000002',
    'WG-V-2',
    299,
    'Bezahlt',
    '2026-08-26 08:00:02+00'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'WGD-APPROVAL-EXPIRED',
    'kombi',
    'basis',
    '2026-08-30',
    '10:00',
    'Expired Contract',
    'expired.contract@example.invalid',
    '+49 170 0000003',
    'WG-E-3',
    219,
    'Bestätigt',
    '2026-08-26 08:00:03+00'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    'WGD-APPROVAL-WRONG-SCOPE',
    'coupe',
    'premium',
    '2026-08-29',
    '11:00',
    'Scope Contract',
    'scope.contract@example.invalid',
    '+49 170 0000004',
    'WG-S-4',
    319,
    'Bezahlt',
    '2026-08-26 08:00:04+00'
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    'WGD-APPROVAL-INELIGIBLE',
    'kleinwagen',
    'basis',
    '2026-08-29',
    '12:00',
    'Ineligible Contract',
    'ineligible.contract@example.invalid',
    '+49 170 0000005',
    'WG-I-5',
    179,
    'Angefragt',
    '2026-08-26 08:00:05+00'
  ),
  (
    '20000000-0000-4000-8000-000000000006',
    'WGD-APPROVAL-RACE',
    'transporter',
    'premium',
    '2026-08-29',
    '13:00',
    'Race Contract',
    'race.contract@example.invalid',
    '+49 170 0000006',
    'WG-R-6',
    399,
    'Bestätigt',
    '2026-08-26 08:00:06+00'
  );

-- Direct table access and all approval-aware entry points stay server-only.
select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.erpnext_write_approvals', 'SELECT,INSERT,UPDATE,DELETE'),
  'anon unexpectedly has table privileges'
);
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.erpnext_write_approvals', 'SELECT,INSERT,UPDATE,DELETE'),
  'authenticated unexpectedly has table privileges'
);
select pg_temp.assert_true(
  has_table_privilege('service_role', 'public.erpnext_write_approvals', 'SELECT'),
  'service_role cannot read approval metadata'
);
select pg_temp.assert_true(
  not has_table_privilege('service_role', 'public.erpnext_write_approvals', 'INSERT'),
  'service_role can insert approvals directly'
);
select pg_temp.assert_true(
  not has_table_privilege('service_role', 'public.erpnext_write_approvals', 'UPDATE'),
  'service_role can update approvals directly'
);
select pg_temp.assert_true(
  not has_table_privilege('service_role', 'public.erpnext_write_approvals', 'DELETE'),
  'service_role can delete approvals directly'
);

select pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.create_erpnext_write_approval(uuid,timestamptz,text,uuid,integer)',
    'EXECUTE'
  ),
  'service_role cannot create approvals'
);
select pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.claim_erpnext_booking_sync(uuid,timestamptz,uuid,uuid,integer)',
    'EXECUTE'
  ),
  'service_role cannot consume a vehicle/order approval'
);
select pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.claim_erpnext_customer_booking_sync(uuid,timestamptz,text,uuid,uuid,integer)',
    'EXECUTE'
  ),
  'service_role cannot consume a customer approval'
);

do $$
declare
  v_role name;
begin
  foreach v_role in array array['anon'::name, 'authenticated'::name]
  loop
    if has_function_privilege(
      v_role,
      'public.create_erpnext_write_approval(uuid,timestamptz,text,uuid,integer)',
      'EXECUTE'
    ) then
      raise exception 'ERPNext approval contract failed: % can create approvals', v_role;
    end if;
    if has_function_privilege(
      v_role,
      'public.claim_erpnext_booking_sync(uuid,timestamptz,uuid,uuid,integer)',
      'EXECUTE'
    ) then
      raise exception 'ERPNext approval contract failed: % can claim vehicle/order writes', v_role;
    end if;
    if has_function_privilege(
      v_role,
      'public.claim_erpnext_customer_booking_sync(uuid,timestamptz,text,uuid,uuid,integer)',
      'EXECUTE'
    ) then
      raise exception 'ERPNext approval contract failed: % can claim customer writes', v_role;
    end if;
  end loop;
end;
$$;

-- The pre-approval overloads remain present only as fail-closed deployment
-- guards. No application role may execute them, and even their owner gets a
-- false/null result.
select pg_temp.assert_true(
  not has_function_privilege(
    'service_role',
    'public.claim_erpnext_booking_sync(uuid,timestamptz,integer)',
    'EXECUTE'
  ),
  'service_role can execute the old vehicle/order claim overload'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'service_role',
    'public.claim_erpnext_customer_booking_sync(uuid,timestamptz,text,integer)',
    'EXECUTE'
  ),
  'service_role can execute the old customer claim overload'
);
select pg_temp.assert_true(
  public.claim_erpnext_booking_sync(
    '20000000-0000-4000-8000-000000000002',
    '2026-08-26 08:00:02+00',
    10
  ) is false,
  'old vehicle/order claim does not fail closed'
);
select pg_temp.assert_true(
  public.claim_erpnext_customer_booking_sync(
    '20000000-0000-4000-8000-000000000001',
    '2026-08-26 08:00:01+00',
    'customer.contract@example.invalid',
    300
  ) is null,
  'old customer claim does not fail closed'
);

-- Approval creation is bound to a verified admin, one eligible booking
-- revision and one known write scope.
select pg_temp.assert_true(
  public.create_erpnext_write_approval(
    '20000000-0000-4000-8000-000000000001',
    '2026-08-26 08:00:01+00',
    'customer',
    '10000000-0000-4000-8000-000000000002',
    120
  ) is null,
  'a non-admin actor created an approval'
);
select pg_temp.assert_true(
  public.create_erpnext_write_approval(
    '20000000-0000-4000-8000-000000000005',
    '2026-08-26 08:00:05+00',
    'customer',
    '10000000-0000-4000-8000-000000000001',
    120
  ) is null,
  'an ineligible booking status was approved'
);
select pg_temp.assert_true(
  public.create_erpnext_write_approval(
    '20000000-0000-4000-8000-000000000001',
    '2026-08-26 08:00:00+00',
    'customer',
    '10000000-0000-4000-8000-000000000001',
    120
  ) is null,
  'a stale booking revision was approved'
);
select pg_temp.assert_true(
  public.create_erpnext_write_approval(
    '20000000-0000-4000-8000-000000000001',
    '2026-08-26 08:00:01+00',
    'invoice',
    '10000000-0000-4000-8000-000000000001',
    120
  ) is null,
  'an unknown write scope was approved'
);

set role service_role;
insert into approval_contract_results (label, value)
select
  'customer-approval',
  public.create_erpnext_write_approval(
    '20000000-0000-4000-8000-000000000001',
    '2026-08-26 08:00:01+00',
    'customer',
    '10000000-0000-4000-8000-000000000001',
    120
  );
reset role;

select pg_temp.assert_true(
  (select value is not null from approval_contract_results where label = 'customer-approval'),
  'service_role did not create the valid customer approval'
);
select pg_temp.assert_true(
  exists (
    select 1
      from public.erpnext_write_approvals approval
     where approval.id = (
       select value from approval_contract_results where label = 'customer-approval'
     )
       and approval.booking_id = '20000000-0000-4000-8000-000000000001'
       and approval.booking_revision = '2026-08-26 08:00:01+00'
       and approval.scope = 'customer'
       and approval.approved_by = '10000000-0000-4000-8000-000000000001'
       and approval.consumed_at is null
       and approval.revoked_at is null
       and extract(epoch from approval.expires_at - approval.approved_at) = 120
  ),
  'stored approval is not bound to the exact admin, booking, revision, scope and TTL'
);

-- Even an oversized requested TTL is clamped to the database-enforced
-- maximum of five minutes. The next test deliberately supersedes this
-- still-active fixture for the same booking and scope.
set role service_role;
insert into approval_contract_results (label, value)
select
  'ttl-clamped-approval',
  public.create_erpnext_write_approval(
    '20000000-0000-4000-8000-000000000003',
    '2026-08-26 08:00:03+00',
    'vehicle_order',
    '10000000-0000-4000-8000-000000000001',
    999
  );
reset role;

select pg_temp.assert_true(
  exists (
    select 1
      from public.erpnext_write_approvals approval
     where approval.id = (
       select value from approval_contract_results where label = 'ttl-clamped-approval'
     )
       and approval.expires_at - approval.approved_at = interval '5 minutes'
  ),
  'oversized approval TTL was not clamped to five minutes'
);

-- A valid approval cannot cross the customer/vehicle-order scope boundary.
set role service_role;
insert into approval_contract_results (label, value)
select
  'wrong-scope-approval',
  public.create_erpnext_write_approval(
    '20000000-0000-4000-8000-000000000004',
    '2026-08-26 08:00:04+00',
    'customer',
    '10000000-0000-4000-8000-000000000001',
    120
  );
insert into approval_contract_results (label, value)
select
  'wrong-scope-token',
  public.claim_erpnext_booking_sync(
    '20000000-0000-4000-8000-000000000004',
    '2026-08-26 08:00:04+00',
    (select value from approval_contract_results where label = 'wrong-scope-approval'),
    '10000000-0000-4000-8000-000000000001',
    10
  );
reset role;

select pg_temp.assert_true(
  (select value is null from approval_contract_results where label = 'wrong-scope-token'),
  'customer approval was accepted by the vehicle/order claim'
);
select pg_temp.assert_true(
  exists (
    select 1
      from public.erpnext_write_approvals
     where id = (select value from approval_contract_results where label = 'wrong-scope-approval')
       and consumed_at is null
  ),
  'wrong-scope claim consumed the approval'
);

-- Expired approvals fail before a mutation lease can be acquired.
set role service_role;
insert into approval_contract_results (label, value)
select
  'expired-approval',
  public.create_erpnext_write_approval(
    '20000000-0000-4000-8000-000000000003',
    '2026-08-26 08:00:03+00',
    'vehicle_order',
    '10000000-0000-4000-8000-000000000001',
    120
  );
reset role;

update public.erpnext_write_approvals
   set approved_at = '2000-01-01 00:00:00+00',
       expires_at = '2000-01-01 00:01:00+00'
 where id = (select value from approval_contract_results where label = 'expired-approval');

set role service_role;
insert into approval_contract_results (label, value)
select
  'expired-token',
  public.claim_erpnext_booking_sync(
    '20000000-0000-4000-8000-000000000003',
    '2026-08-26 08:00:03+00',
    (select value from approval_contract_results where label = 'expired-approval'),
    '10000000-0000-4000-8000-000000000001',
    10
  );
reset role;

select pg_temp.assert_true(
  (select value is null from approval_contract_results where label = 'expired-token'),
  'expired approval acquired a vehicle/order lease'
);
select pg_temp.assert_true(
  not exists (
    select 1
      from public.booking_automation_state
     where booking_id = '20000000-0000-4000-8000-000000000003'
  ),
  'expired approval mutated booking automation state'
);

-- Vehicle/order: exactly one UUID fencing token is returned, stored on the
-- lease and bound to the one consumed approval.
set role service_role;
insert into approval_contract_results (label, value)
select
  'vehicle-approval',
  public.create_erpnext_write_approval(
    '20000000-0000-4000-8000-000000000002',
    '2026-08-26 08:00:02+00',
    'vehicle_order',
    '10000000-0000-4000-8000-000000000001',
    120
  );
insert into approval_contract_results (label, value)
select
  'vehicle-token',
  public.claim_erpnext_booking_sync(
    '20000000-0000-4000-8000-000000000002',
    '2026-08-26 08:00:02+00',
    (select value from approval_contract_results where label = 'vehicle-approval'),
    '10000000-0000-4000-8000-000000000001',
    10
  );
reset role;

select pg_temp.assert_true(
  (select value is not null from approval_contract_results where label = 'vehicle-token'),
  'valid vehicle/order claim did not return a fencing token'
);
select pg_temp.assert_true(
  exists (
    select 1
      from public.booking_automation_state state
     where state.booking_id = '20000000-0000-4000-8000-000000000002'
       and state.erpnext_processing_token = (
         select value from approval_contract_results where label = 'vehicle-token'
       )
       and state.erpnext_attempts = 1
  ),
  'vehicle/order fencing token was not stored on the claimed lease'
);
select pg_temp.assert_true(
  exists (
    select 1
      from public.erpnext_write_approvals approval
     where approval.id = (
       select value from approval_contract_results where label = 'vehicle-approval'
     )
       and approval.consumed_at is not null
       and approval.consumed_by = '10000000-0000-4000-8000-000000000001'
       and approval.consumer = 'erpnext-vehicle-order-commit'
  ),
  'vehicle/order approval was not consumed by the expected admin and consumer'
);

update public.booking_automation_state
   set erpnext_processing_at = null,
       erpnext_processing_expires_at = null,
       erpnext_processing_token = null
 where booking_id = '20000000-0000-4000-8000-000000000002';

set role service_role;
insert into approval_contract_results (label, value)
select
  'vehicle-replay-token',
  public.claim_erpnext_booking_sync(
    '20000000-0000-4000-8000-000000000002',
    '2026-08-26 08:00:02+00',
    (select value from approval_contract_results where label = 'vehicle-approval'),
    '10000000-0000-4000-8000-000000000001',
    10
  );
reset role;

select pg_temp.assert_true(
  (select value is null from approval_contract_results where label = 'vehicle-replay-token'),
  'consumed vehicle/order approval was replayed'
);
select pg_temp.assert_true(
  (select erpnext_attempts = 1 from public.booking_automation_state where booking_id = '20000000-0000-4000-8000-000000000002'),
  'vehicle/order replay mutated the lease state'
);

-- Customer: the claim returns one fencing token and stores the same value on
-- both the booking lease and normalized customer mapping. A replay stays null
-- even after those leases are manually cleared.
set role service_role;
insert into approval_contract_results (label, value)
select
  'customer-token',
  public.claim_erpnext_customer_booking_sync(
    '20000000-0000-4000-8000-000000000001',
    '2026-08-26 08:00:01+00',
    ' Customer.Contract@Example.Invalid ',
    (select value from approval_contract_results where label = 'customer-approval'),
    '10000000-0000-4000-8000-000000000001',
    300
  );
reset role;

select pg_temp.assert_true(
  (select value is not null from approval_contract_results where label = 'customer-token'),
  'valid customer claim did not return a fencing token'
);
select pg_temp.assert_true(
  exists (
    select 1
      from public.booking_automation_state state
      join public.erpnext_customer_mappings mapping
        on mapping.normalized_email = 'customer.contract@example.invalid'
     where state.booking_id = '20000000-0000-4000-8000-000000000001'
       and state.erpnext_customer_processing_token = (
         select value from approval_contract_results where label = 'customer-token'
       )
       and mapping.processing_token = state.erpnext_customer_processing_token
       and mapping.attempts = 1
  ),
  'customer fencing token was not stored on both protected leases'
);
select pg_temp.assert_true(
  exists (
    select 1
      from public.erpnext_write_approvals approval
     where approval.id = (
       select value from approval_contract_results where label = 'customer-approval'
     )
       and approval.consumed_at is not null
       and approval.consumed_by = '10000000-0000-4000-8000-000000000001'
       and approval.consumer = 'erpnext-sync-customer'
  ),
  'customer approval was not consumed by the expected admin and consumer'
);

update public.booking_automation_state
   set erpnext_customer_processing_at = null,
       erpnext_customer_processing_expires_at = null,
       erpnext_customer_processing_token = null
 where booking_id = '20000000-0000-4000-8000-000000000001';
update public.erpnext_customer_mappings
   set processing_at = null,
       processing_token = null
 where normalized_email = 'customer.contract@example.invalid';

set role service_role;
insert into approval_contract_results (label, value)
select
  'customer-replay-token',
  public.claim_erpnext_customer_booking_sync(
    '20000000-0000-4000-8000-000000000001',
    '2026-08-26 08:00:01+00',
    'customer.contract@example.invalid',
    (select value from approval_contract_results where label = 'customer-approval'),
    '10000000-0000-4000-8000-000000000001',
    300
  );
reset role;

select pg_temp.assert_true(
  (select value is null from approval_contract_results where label = 'customer-replay-token'),
  'consumed customer approval was replayed'
);
select pg_temp.assert_true(
  (select attempts = 1 from public.erpnext_customer_mappings where normalized_email = 'customer.contract@example.invalid'),
  'customer replay mutated the mapping lease'
);

-- Leave one committed approval for the shell runner's deterministic
-- two-session race. Both contenders receive the same approval id; only one
-- may return and persist the fencing token.
set role service_role;
insert into approval_contract_results (label, value)
select
  'race-approval',
  public.create_erpnext_write_approval(
    '20000000-0000-4000-8000-000000000006',
    '2026-08-26 08:00:06+00',
    'vehicle_order',
    '10000000-0000-4000-8000-000000000001',
    300
  );
reset role;

select pg_temp.assert_true(
  (select value is not null from approval_contract_results where label = 'race-approval'),
  'race fixture approval was not created'
);

\echo 'ERPNext approval SQL contract passed.'
