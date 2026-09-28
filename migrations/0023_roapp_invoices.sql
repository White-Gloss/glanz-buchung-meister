-- Website-issued invoices for completed RO App orders. Additive only; the
-- application applies the identical DDL at runtime (ensureRoInvoiceSchema), so
-- this file is not part of the release gate (scripts/write-release-manifest.mjs).
create table if not exists roapp_invoices (
  booking_id integer primary key references bookings(id),
  shop_id text not null default 'white-gloss',
  account_scope text not null,
  ro_order_id integer not null,
  status text not null default 'geplant' check (status in ('geplant','wartet','in_arbeit','ausgestellt','versendet','pruefung','verworfen')),
  reason text,
  completed_at timestamptz not null,
  due_at timestamptz not null,
  attempts integer not null default 0,
  lease_token text,
  locked_until timestamptz,
  invoice_number text unique,
  issued_on date,
  service_from date,
  service_to date,
  payment_due_on date,
  gross_cents integer check (gross_cents >= 0),
  net_cents integer,
  vat_cents integer,
  recipient_email text,
  recipient jsonb,
  lines jsonb,
  pdf_base64 text,
  delivery text check (delivery in ('email','inhaber')),
  sent_at timestamptz,
  paid_cents integer not null default 0 check (paid_cents >= 0),
  payment_status text not null default 'offen' check (payment_status in ('offen','teilbezahlt','bezahlt')),
  paid_on date,
  ro_comment_state text not null default 'offen' check (ro_comment_state in ('offen','erledigt','pruefung')),
  attention text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('ausgestellt','versendet') or (invoice_number is not null and pdf_base64 is not null and gross_cents is not null)),
  check (paid_cents <= coalesce(gross_cents, 0))
);
create index if not exists roapp_invoices_due_idx on roapp_invoices(status, due_at);
create table if not exists roapp_invoice_numbers (
  year integer primary key,
  last_value integer not null check (last_value > 0)
);
create table if not exists roapp_invoice_payments (
  id serial primary key,
  invoice_number text not null references roapp_invoices(invoice_number),
  request_id uuid not null,
  amount_cents integer not null check (amount_cents > 0),
  method text not null check (method in ('bar','ueberweisung')),
  paid_on date not null,
  recorded_by text not null,
  receipt_number text unique,
  receipt_pdf_base64 text,
  created_at timestamptz not null default now(),
  unique (invoice_number, request_id)
);
