-- The application performs all booking writes and capacity reads through its
-- server-side PostgreSQL connection. These SECURITY DEFINER functions must not
-- also be callable through the public Data API, where they would bypass RLS.

REVOKE EXECUTE ON FUNCTION public.bookings_per_day(date)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.booking_day_load(date, date)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.create_booking_public(
  text, text, text[], date, text, text, text, text, text, text, text
)
  FROM PUBLIC, anon, authenticated;

-- Trigger functions are invoked by PostgreSQL itself and never need Data API
-- execute permissions.
REVOKE EXECUTE ON FUNCTION public.enforce_daily_booking_limit()
  FROM PUBLIC, anon, authenticated;
