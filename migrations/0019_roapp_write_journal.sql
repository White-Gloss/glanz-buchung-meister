-- This migration belongs to the website's integer-ID database, not the legacy
-- UUID Supabase bookings schema.
create table if not exists roapp_write_journal (
  booking_id integer not null references bookings(id) on delete cascade,
  operation text not null,
  state text not null check (state in ('started', 'done')),
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (booking_id, operation)
);
