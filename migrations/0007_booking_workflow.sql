-- Preserve existing bookings. Existing collisions abort this entire migration;
-- reconcile them explicitly before retrying, never delete or auto-cancel data.
alter table bookings add column version integer not null default 1;
alter table bookings add column confirmed_at timestamptz;
alter table bookings add column confirmed_by text;
alter table bookings add column cancelled_at timestamptz;
alter table bookings add column request_key_hash text;
alter table bookings add column request_fingerprint text;
create unique index bookings_request_key_idx on bookings(shop_id, request_key_hash);
alter table bookings add constraint bookings_workflow_status check
  (status in ('neu','bestaetigt','abgelehnt','storniert','erledigt','nicht_erschienen')) not valid;

create table booking_events (
  id serial primary key,
  shop_id text not null,
  booking_id integer not null references bookings(id),
  event text not null,
  actor text not null,
  version integer not null,
  before_data jsonb,
  after_data jsonb not null,
  created_at timestamptz not null default now(),
  unique(shop_id,booking_id,version)
);
create index booking_events_history_idx on booking_events(shop_id,booking_id,created_at);

-- A small shop has one shared capacity. Lock this row for any reservation
-- change. Unique claims are a second defence even under stale SQL snapshots.
create table booking_workflow_locks(shop_id text primary key, revision bigint not null default 0);
insert into booking_workflow_locks(shop_id) values ('white-gloss');
create table booking_capacity_claims (
  shop_id text not null,
  booking_id integer not null references bookings(id) on delete cascade,
  appointment_date date not null,
  resource integer not null,
  primary key(shop_id,appointment_date,resource)
);
create index booking_capacity_booking_idx on booking_capacity_claims(booking_id);

create function reserve_booking_capacity(p_shop text, p_id integer, p_date date, p_slot text, p_package text)
returns void language plpgsql as $$
declare capacity integer;
begin
  if p_date is null then return; end if;
  if p_slot is not null and p_slot not in ('09:00','11:00','13:00','15:00') then
    raise exception 'Invalid appointment slot' using errcode='23514';
  end if;
  -- A legacy appointment without a precise slot occupies the whole day.
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

do $$
declare b record;
begin
  for b in select * from bookings where status in ('bestaetigt','erledigt','nicht_erschienen') order by id loop
    perform reserve_booking_capacity(b.shop_id,b.id,b.preferred_date,b.preferred_slot,b.package_id);
  end loop;
end $$;

create function enforce_booking_workflow() returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Bookings must be cancelled, not deleted' using errcode='23514';
  end if;
  if NEW.status='bestaetigt' and (TG_OP='INSERT' or OLD.status is distinct from 'bestaetigt') then
    if nullif(current_setting('white_gloss.confirm_actor',true),'') is null
      or NEW.confirmed_by is distinct from current_setting('white_gloss.confirm_actor',true)
      or NEW.confirmed_at is null then
      raise exception 'Explicit owner confirmation required' using errcode='42501';
    end if;
    if NEW.preferred_date is null or NEW.preferred_slot is null
      or NEW.preferred_slot not in ('09:00','11:00','13:00','15:00') then
      raise exception 'Confirmation requires date and slot' using errcode='23514';
    end if;
  end if;
  if TG_OP='UPDATE' and OLD.status='bestaetigt' and NEW.status='bestaetigt'
    and (NEW.preferred_date,NEW.preferred_slot,NEW.package_id,NEW.class_id,NEW.extra_ids)
      is distinct from (OLD.preferred_date,OLD.preferred_slot,OLD.package_id,OLD.class_id,OLD.extra_ids) then
    raise exception 'Rescheduling requires new manual confirmation' using errcode='23514';
  end if;
  update booking_workflow_locks set revision=revision+1 where shop_id=NEW.shop_id;
  if not found then raise exception 'Unknown booking shop' using errcode='23514'; end if;
  delete from booking_capacity_claims where booking_id=NEW.id;
  if NEW.status in ('bestaetigt','erledigt','nicht_erschienen') then
    perform reserve_booking_capacity(NEW.shop_id,NEW.id,NEW.preferred_date,NEW.preferred_slot,NEW.package_id);
  end if;
  return NEW;
end $$;
create trigger booking_workflow_guard after insert or update of status,preferred_date,preferred_slot,package_id,class_id,extra_ids or delete
  on bookings for each row execute function enforce_booking_workflow();

-- Historical confirmations stay historical: do not invent a confirming person
-- or timestamp. Their legacy audit snapshot is explicitly labelled.
insert into booking_events(shop_id,booking_id,event,actor,version,after_data)
select shop_id,id,'booking.imported','migration',version,
  jsonb_build_object('status',status,'date',preferred_date,'slot',preferred_slot,'legacy',true)
from bookings;
