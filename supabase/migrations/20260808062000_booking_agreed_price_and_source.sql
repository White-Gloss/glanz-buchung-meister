alter table public.bookings
  add column if not exists agreed_price numeric(10,2),
  add column if not exists agreed_price_set_at timestamptz,
  add column if not exists booking_source text not null default 'website';

alter table public.bookings
  drop constraint if exists bookings_agreed_price_positive;
alter table public.bookings
  add constraint bookings_agreed_price_positive
  check (agreed_price is null or agreed_price > 0);

alter table public.bookings
  drop constraint if exists bookings_booking_source_check;
alter table public.bookings
  add constraint bookings_booking_source_check
  check (booking_source in ('website','whatsapp','telefon','vor_ort','sonstiges'));

comment on column public.bookings.agreed_price is
  'Vom Admin bestätigter, mit dem Kunden vereinbarter Gesamtpreis. Erst danach darf der Termin bestätigt werden.';
comment on column public.bookings.booking_source is
  'Quelle der Buchung: website, whatsapp, telefon, vor_ort oder sonstiges.';
