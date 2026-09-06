-- Qonto client-invoice mapping on bookings

alter table bookings
  add column if not exists qonto_client_id text,
  add column if not exists qonto_invoice_id text,
  add column if not exists qonto_invoice_number text,
  add column if not exists qonto_invoice_status text,
  add column if not exists qonto_invoice_error text,
  add column if not exists qonto_sent_at timestamptz;

comment on column bookings.qonto_invoice_status is
  'pending | unpaid | sent | failed - local mirror; Qonto is authoritative';

create index if not exists bookings_qonto_invoice_id_idx
  on bookings (qonto_invoice_id)
  where qonto_invoice_id is not null;
