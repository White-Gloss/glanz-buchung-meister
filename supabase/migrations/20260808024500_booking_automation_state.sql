-- White Gloss automation state
-- Keeps Lexware synchronization and reminder delivery metadata separate from
-- the core booking record. The table is intentionally not exposed to the
-- browser; server-side code accesses it through the managed PostgreSQL pool.

create table if not exists public.booking_automation_state (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  lexware_contact_id uuid,
  lexware_invoice_id uuid,
  lexware_invoice_number text,
  lexware_processing_at timestamptz,
  lexware_synced_at timestamptz,
  lexware_last_error text,
  invoice_mail_sent_at timestamptz,
  reminder_processing_at timestamptz,
  reminder_sent_at timestamptz,
  reminder_last_error text,
  updated_at timestamptz not null default now()
);

create unique index if not exists booking_automation_state_lexware_invoice_uidx
  on public.booking_automation_state (lexware_invoice_id)
  where lexware_invoice_id is not null;

create index if not exists booking_automation_state_reminder_pending_idx
  on public.booking_automation_state (reminder_sent_at, reminder_processing_at);

alter table public.booking_automation_state enable row level security;

comment on table public.booking_automation_state is
  'Server-only state for Lexware invoice sync and appointment reminder delivery.';
