-- Security hardening for public booking, storage uploads, roles and offer links.
-- Apply through the normal Supabase migration workflow before deploying the
-- matching application code.

-- 1) Never grant the first public signup administrative rights. Existing roles
-- are preserved; every future signup is a regular user until an owner promotes
-- it deliberately in Supabase.
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::public.app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;

-- 2) The TanStack server function uses the direct database pool. Public
-- visitors must not be able to call the pricing/booking RPC through the
-- Supabase REST API; the app server retains the direct database role.
REVOKE EXECUTE ON FUNCTION public.create_booking_public(
  text, text, text[], date, text, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;

-- 3) Keep the vehicle-media bucket private and remove the direct anonymous
-- upload policy. Every upload now passes through server-side MIME, size and
-- magic-byte validation using the server-only service role.
DROP POLICY IF EXISTS "Interessenten duerfen Zustandsfotos hochladen" ON storage.objects;

-- 4) Offer tokens are confidential credentials. Limit their lifetime and make
-- every read/write reject expired links. Existing links are invalidated because
-- their original issuance date cannot be verified; regenerate them in admin.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS access_token_expires_at timestamptz;

-- Existing links predate an expiry timestamp and cannot be assigned a trustworthy
-- issuance date. Invalidate them instead of extending potentially leaked links.
UPDATE public.bookings
SET access_token = gen_random_uuid(),
    access_token_expires_at = now()
WHERE access_token_expires_at IS NULL;

ALTER TABLE public.bookings
  ALTER COLUMN access_token_expires_at SET DEFAULT (now() + interval '30 days'),
  ALTER COLUMN access_token_expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_access_token_active_idx
  ON public.bookings (access_token, access_token_expires_at);

-- 5) Reject repeated browser submissions before they create capacity, audit or
-- mail noise. This is intentionally narrow: same email + normalized plate +
-- date inside 15 minutes. It supplements (not replaces) app-instance rate
-- limiting and a future edge/WAF rule.
CREATE OR REPLACE FUNCTION public.reject_duplicate_booking_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id IS DISTINCT FROM NEW.id
      AND b.created_at >= now() - interval '15 minutes'
      AND b.booking_date = NEW.booking_date
      AND lower(b.customer_email) = lower(NEW.customer_email)
      AND upper(regexp_replace(b.customer_plate, '[[:space:]-]', '', 'g'))
          = upper(regexp_replace(NEW.customer_plate, '[[:space:]-]', '', 'g'))
      AND b.status <> 'Storniert'
  ) THEN
    RAISE EXCEPTION 'Diese Anfrage wurde bereits gesendet. Bitte warten Sie auf unsere Rückmeldung.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_duplicate_booking_submission ON public.bookings;
CREATE TRIGGER reject_duplicate_booking_submission
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.reject_duplicate_booking_submission();
