-- Zoho as operational system. Postgres remains the reservation authority.
-- Existing bookings, invoices and outbound messages are not rewritten or resent.

alter table bookings add column if not exists estimated_price_cents integer;
alter table bookings add column if not exists agreed_price_cents integer;
alter table bookings add column if not exists work_start_at timestamptz;
alter table bookings add column if not exists work_end_at timestamptz;
alter table bookings add column if not exists resource_id integer not null default 1;
alter table bookings add column if not exists ops_stage text not null default 'anfrage_eingegangen';
alter table bookings add column if not exists invoice_status text not null default 'nicht_erstellt';
alter table bookings add column if not exists payment_status text not null default 'offen';
alter table bookings add column if not exists payment_method text;
alter table bookings add column if not exists payment_recorded_cents integer;
alter table bookings add column if not exists payment_recorded_on date;
alter table bookings add column if not exists customer_acceptance_required boolean not null default false;
alter table bookings add column if not exists customer_accepted_at timestamptz;
alter table bookings add column if not exists internal_notes text;
alter table bookings add column if not exists vehicle_make text;
alter table bookings add column if not exists vehicle_model text;
alter table bookings add column if not exists vehicle_plate text;
alter table bookings add column if not exists confirmation_pdf_version integer not null default 0;
alter table bookings add column if not exists zoho_contact_id text;
alter table bookings add column if not exists zoho_deal_id text;
alter table bookings add column if not exists zoho_event_id text;
alter table bookings add column if not exists zoho_invoice_id text;
alter table bookings add column if not exists zoho_payment_id text;
alter table bookings add column if not exists zoho_invoice_number text;
alter table bookings add column if not exists zoho_last_error text;

update bookings
  set estimated_price_cents = total_cents
  where estimated_price_cents is null;

update bookings
  set ops_stage = case
    when status = 'neu' then 'anfrage_eingegangen'
    when status = 'bestaetigt' then 'bestaetigt'
    when status = 'erledigt' then 'abgeschlossen'
    when status = 'abgelehnt' then 'abgelehnt'
    when status = 'storniert' then 'storniert'
    when status = 'nicht_erschienen' then 'storniert'
    else ops_stage
  end
  where ops_stage = 'anfrage_eingegangen';

alter table bookings drop constraint if exists bookings_ops_stage_check;
alter table bookings add constraint bookings_ops_stage_check check (
  ops_stage in (
    'anfrage_eingegangen',
    'in_pruefung',
    'kundenrueckmeldung',
    'bestaetigt',
    'in_bearbeitung',
    'abgeschlossen',
    'abgelehnt',
    'storniert'
  )
);

alter table bookings drop constraint if exists bookings_invoice_status_check;
alter table bookings add constraint bookings_invoice_status_check check (
  invoice_status in (
    'nicht_erstellt',
    'ausstehend',
    'erstellt',
    'versand_ausstehend',
    'versendet',
    'fehler'
  )
);

alter table bookings drop constraint if exists bookings_payment_status_check;
alter table bookings add constraint bookings_payment_status_check check (
  payment_status in ('offen', 'teilbezahlt', 'bezahlt')
);

alter table bookings drop constraint if exists bookings_payment_method_check;
alter table bookings add constraint bookings_payment_method_check check (
  payment_method is null or payment_method in ('bar', 'ueberweisung')
);

create table if not exists booking_time_blocks (
  id serial primary key,
  shop_id text not null,
  booking_id integer not null references bookings(id),
  resource_id integer not null default 1,
  start_at timestamptz not null,
  end_at timestamptz not null,
  source text not null default 'booking',
  unique (shop_id, booking_id)
);
create index if not exists booking_time_blocks_range_idx
  on booking_time_blocks (shop_id, resource_id, start_at, end_at);

create table if not exists zoho_sync_queue (
  booking_id integer primary key references bookings(id),
  shop_id text not null default 'white-gloss',
  requested_version integer not null,
  synced_version integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'synced', 'failed', 'review')),
  job text not null default 'record' check (
    job in ('record', 'photos', 'calendar', 'confirmation', 'invoice', 'payment', 'inbound')
  ),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  write_pending text,
  updated_at timestamptz not null default now()
);
create index if not exists zoho_sync_due_idx on zoho_sync_queue (status, next_attempt_at);

create table if not exists zoho_job_queue (
  id serial primary key,
  shop_id text not null default 'white-gloss',
  booking_id integer not null references bookings(id),
  job text not null,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'done', 'failed', 'review')
  ),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, idempotency_key)
);
create index if not exists zoho_job_due_idx on zoho_job_queue (status, next_attempt_at);

create table if not exists zoho_sync_runner (
  shop_id text primary key,
  lease_token text,
  locked_until timestamptz
);
insert into zoho_sync_runner (shop_id) values ('white-gloss') on conflict do nothing;

alter table shop_settings add column if not exists zoho_ops_enabled boolean not null default false;
alter table shop_settings add column if not exists zoho_dc text;
alter table shop_settings add column if not exists zoho_client_id text;
alter table shop_settings add column if not exists zoho_client_secret text;
alter table shop_settings add column if not exists zoho_refresh_token text;
alter table shop_settings add column if not exists zoho_access_token text;
alter table shop_settings add column if not exists zoho_access_expires_at timestamptz;
alter table shop_settings add column if not exists zoho_books_org_id text;
alter table shop_settings add column if not exists zoho_webhook_secret text;
alter table shop_settings add column if not exists zoho_tax_id text;
alter table shop_settings add column if not exists zoho_cash_account_id text;
alter table shop_settings add column if not exists zoho_bank_account_id text;

create or replace function reserve_time_block(
  p_shop text,
  p_id integer,
  p_resource integer,
  p_start timestamptz,
  p_end timestamptz
) returns void language plpgsql as $$
declare legacy date;
begin
  if p_start is null or p_end is null then
    raise exception 'Work interval required' using errcode = '23514';
  end if;
  if p_end <= p_start then
    raise exception 'Work end must be after start' using errcode = '23514';
  end if;
  if exists (
    select 1 from booking_time_blocks b
    where b.shop_id = p_shop
      and b.resource_id = p_resource
      and b.booking_id <> p_id
      and b.start_at < p_end
      and b.end_at > p_start
  ) then
    raise exception 'Appointment capacity conflict' using errcode = '23505';
  end if;
  for legacy in
    select distinct c.appointment_date
    from booking_capacity_claims c
    where c.shop_id = p_shop
      and c.booking_id <> p_id
      and c.appointment_date >= (p_start at time zone 'Europe/Berlin')::date
      and c.appointment_date <= (p_end at time zone 'Europe/Berlin')::date
  loop
    raise exception 'Appointment capacity conflict' using errcode = '23505';
  end loop;
  insert into booking_time_blocks (shop_id, booking_id, resource_id, start_at, end_at)
  values (p_shop, p_id, p_resource, p_start, p_end)
  on conflict (shop_id, booking_id) do update
    set resource_id = excluded.resource_id,
        start_at = excluded.start_at,
        end_at = excluded.end_at;
end $$;

create or replace function reserve_booking_capacity(
  p_shop text,
  p_id integer,
  p_date date,
  p_slot text,
  p_package text
) returns void language plpgsql as $$
declare capacity integer;
begin
  if p_date is null then return; end if;
  if p_slot is not null and p_slot not in ('09:00','11:00','13:00','15:00') then
    raise exception 'Invalid appointment slot' using errcode='23514';
  end if;
  if exists (
    select 1 from booking_time_blocks b
    where b.shop_id = p_shop
      and b.booking_id <> p_id
      and (b.start_at at time zone 'Europe/Berlin')::date <= p_date
      and (b.end_at at time zone 'Europe/Berlin')::date >= p_date
  ) then
    raise exception 'Appointment capacity conflict' using errcode = '23505';
  end if;
  if p_package = 'keramik' or p_slot is null then
    insert into booking_capacity_claims values (p_shop,p_id,p_date,1),(p_shop,p_id,p_date,2);
  else
    select n into capacity from generate_series(1,2) n
    where not exists (select 1 from booking_capacity_claims c
      where c.shop_id=p_shop and c.appointment_date=p_date and c.resource=n)
    order by n limit 1;
    if capacity is null then raise exception 'Appointment capacity conflict' using errcode='23505'; end if;
    insert into booking_capacity_claims values (p_shop,p_id,p_date,capacity);
  end if;
  if p_slot is not null then
    insert into booking_capacity_claims values
      (p_shop,p_id,p_date,100+extract(hour from p_slot::time)::integer);
  end if;
end $$;

create or replace function enforce_booking_workflow() returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Bookings must be cancelled, not deleted' using errcode = '23514';
  end if;
  if NEW.status = 'bestaetigt' and (TG_OP = 'INSERT' or OLD.status is distinct from 'bestaetigt') then
    if nullif(current_setting('white_gloss.confirm_actor', true), '') is null
      or NEW.confirmed_by is distinct from current_setting('white_gloss.confirm_actor', true)
      or NEW.confirmed_at is null then
      raise exception 'Explicit owner confirmation required' using errcode = '42501';
    end if;
    if NEW.work_start_at is not null and NEW.work_end_at is not null then
      if NEW.work_end_at <= NEW.work_start_at then
        raise exception 'Work end must be after start' using errcode = '23514';
      end if;
    elsif NEW.preferred_date is null or NEW.preferred_slot is null
      or NEW.preferred_slot not in ('09:00', '11:00', '13:00', '15:00') then
      raise exception 'Confirmation requires date and slot' using errcode = '23514';
    end if;
  end if;
  if TG_OP = 'UPDATE' and OLD.status = 'bestaetigt' and NEW.status = 'bestaetigt'
    and (NEW.preferred_date, NEW.preferred_slot, NEW.package_id, NEW.class_id, NEW.extra_ids,
         NEW.work_start_at, NEW.work_end_at, NEW.resource_id)
      is distinct from
        (OLD.preferred_date, OLD.preferred_slot, OLD.package_id, OLD.class_id, OLD.extra_ids,
         OLD.work_start_at, OLD.work_end_at, OLD.resource_id) then
    raise exception 'Rescheduling requires new manual confirmation' using errcode = '23514';
  end if;
  update booking_workflow_locks set revision = revision + 1 where shop_id = NEW.shop_id;
  if not found then raise exception 'Unknown booking shop' using errcode = '23514'; end if;
  delete from booking_capacity_claims where booking_id = NEW.id;
  delete from booking_time_blocks where booking_id = NEW.id;
  if NEW.status in ('bestaetigt', 'erledigt', 'nicht_erschienen') then
    if NEW.work_start_at is not null and NEW.work_end_at is not null then
      perform reserve_time_block(
        NEW.shop_id, NEW.id, coalesce(NEW.resource_id, 1), NEW.work_start_at, NEW.work_end_at
      );
    else
      perform reserve_booking_capacity(
        NEW.shop_id, NEW.id, NEW.preferred_date, NEW.preferred_slot, NEW.package_id
      );
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists booking_workflow_guard on bookings;
create trigger booking_workflow_guard
  after insert or update of
    status, preferred_date, preferred_slot, package_id, class_id, extra_ids,
    work_start_at, work_end_at, resource_id
  or delete
  on bookings
  for each row execute function enforce_booking_workflow();
