-- =====================================================================
-- 1) Abholservice: Staffelpreise statt Pauschale
-- 2) Rechnungsnummern: echte Sequence statt COUNT(*)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Abholort an der Buchung speichern (Grundlage für die Entfernungsstaffel)
-- ---------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pickup_city text;

-- ---------------------------------------------------------------------
-- service_prices um den Typ 'pickup' erweitern
-- ---------------------------------------------------------------------
ALTER TABLE public.service_prices
  DROP CONSTRAINT IF EXISTS service_prices_item_type_check;

ALTER TABLE public.service_prices
  ADD CONSTRAINT service_prices_item_type_check
  CHECK (item_type IN ('package', 'addon', 'vehicle', 'pickup'));

INSERT INTO public.service_prices (item_type, item_id, label, amount) VALUES
  ('pickup', 'tier_10', 'Abholung bis 10 km',  0),
  ('pickup', 'tier_20', 'Abholung bis 20 km', 50),
  ('pickup', 'tier_50', 'Abholung bis 50 km', 70)
ON CONFLICT (item_type, item_id) DO NOTHING;

-- Der frühere Pauschalpreis des Add-ons wird nicht mehr verwendet.
UPDATE public.service_prices
   SET amount = 0,
       label  = 'Hol- & Bringservice (Preis nach Entfernungsstaffel)'
 WHERE item_type = 'addon' AND item_id = 'hol';

-- ---------------------------------------------------------------------
-- Fortlaufende Rechnungsnummer über eine Sequence
-- COUNT(*) war weder nebenläufigkeitssicher noch lückenfrei fortlaufend:
-- zwei gleichzeitige Buchungen erzeugten dieselbe Nummer, und nach dem
-- Löschen einer Buchung sprang der Zähler zurück.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_next bigint;
BEGIN
  SELECT COALESCE(MAX((regexp_replace(invoice_number, '^.*-', ''))::bigint), 1000) + 1
    INTO v_next
    FROM public.bookings
   WHERE invoice_number ~ '-[0-9]+$';

  IF v_next IS NULL OR v_next < 1001 THEN
    v_next := 1001;
  END IF;

  EXECUTE format(
    'CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START WITH %s MINVALUE 1001',
    v_next
  );
END $$;

REVOKE ALL ON SEQUENCE public.invoice_number_seq FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- create_booking_public: Staffelpreis + Sequence + Abholort
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_booking_public(
  p_vehicle_id      text,
  p_package_id      text,
  p_add_on_ids      text[],
  p_booking_date    date,
  p_booking_time    text,
  p_customer_name   text,
  p_customer_email  text,
  p_customer_phone  text,
  p_customer_plate  text,
  p_pickup_city     text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- ---- allowed value sets (mirrors servicesConfig.ts) ----
  c_vehicles  constant text[] := ARRAY['kompakt','suv','transporter'];
  c_packages  constant text[] := ARRAY['basis','premium','keramik'];
  c_addons    constant text[] := ARRAY['felgen','ozon','motor','leder','scheinwerfer','hol'];
  c_timeslots constant text[] := ARRAY['08:00','10:00','12:00','14:00','16:00','18:00'];

  -- ---- Abholservice (mirrors servicesConfig.ts + pickupLocations.ts) ----
  c_pickup_addon    constant text    := 'hol';
  c_pickup_free_pkg constant text    := 'keramik';
  c_pickup_free_km  constant numeric := 60;
  c_pickup_max_km   constant numeric := 50;
  c_pickup_km       constant jsonb   := '{
    "horb-am-neckar": 0,
    "nagold": 20,
    "rottenburg-am-neckar": 25,
    "freudenstadt": 30,
    "oberndorf-am-neckar": 30,
    "herrenberg": 35,
    "tuebingen": 35,
    "calw": 40,
    "balingen": 45,
    "rottweil": 45,
    "boeblingen": 50,
    "reutlingen": 50,
    "sindelfingen": 52
  }';

  -- ---- business rule constants (mirrors servicesConfig.ts) ----
  c_invoice_prefix  constant text    := 'WGD-';
  c_deposit_rate    constant numeric := 0.2;

  -- ---- computed locals ----
  v_vehicle_factor  numeric;
  v_package_price   numeric;
  v_addon_price     numeric;
  v_total           numeric := 0;
  v_addon_id        text;
  v_is_included     boolean;

  v_pickup_km       numeric;
  v_pickup_price    numeric;
  v_pickup_tier     text;
  v_pickup_city     text;

  v_is_new_customer boolean;
  v_invoice_number  text;
  v_deposit_amount  numeric;
  v_deposit_status  text;
  v_row             public.bookings;
BEGIN
  -- ---- input validation ----
  IF NOT (p_vehicle_id = ANY(c_vehicles)) THEN
    RAISE EXCEPTION 'Invalid vehicle_id: %', p_vehicle_id;
  END IF;
  IF NOT (p_package_id = ANY(c_packages)) THEN
    RAISE EXCEPTION 'Invalid package_id: %', p_package_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_add_on_ids) a(id) WHERE id <> ALL(c_addons)
  ) THEN
    RAISE EXCEPTION 'Invalid add_on_id in list';
  END IF;
  IF NOT (p_booking_time = ANY(c_timeslots)) THEN
    RAISE EXCEPTION 'Invalid booking_time: %', p_booking_time;
  END IF;
  IF p_booking_date < current_date THEN
    RAISE EXCEPTION 'booking_date must not be in the past';
  END IF;
  IF EXTRACT(DOW FROM p_booking_date) = 0 THEN
    RAISE EXCEPTION 'booking_date must not be a Sunday';
  END IF;
  IF trim(p_customer_name)   = '' OR length(trim(p_customer_name))   < 2 THEN
    RAISE EXCEPTION 'customer_name too short';
  END IF;
  IF trim(p_customer_email)  = '' OR p_customer_email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION 'customer_email invalid';
  END IF;
  IF trim(p_customer_phone)  = '' OR length(trim(p_customer_phone))  < 6 THEN
    RAISE EXCEPTION 'customer_phone too short';
  END IF;
  IF trim(p_customer_plate)  = '' OR length(trim(p_customer_plate))  < 3 THEN
    RAISE EXCEPTION 'customer_plate too short';
  END IF;

  -- ---- slot availability check (advisory lock on date+time) ----
  PERFORM pg_advisory_xact_lock(
    hashtext(p_booking_date::text || '|' || p_booking_time)
  );

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND status <> 'Storniert'
  ) THEN
    RAISE EXCEPTION 'Dieser Zeitslot ist leider bereits vergeben. Bitte wählen Sie einen anderen Termin.';
  END IF;

  -- ---- price computation (purely from service_prices table) ----
  SELECT amount INTO v_vehicle_factor
  FROM public.service_prices
  WHERE item_type = 'vehicle' AND item_id = p_vehicle_id;
  v_vehicle_factor := COALESCE(v_vehicle_factor, 1);

  SELECT amount INTO v_package_price
  FROM public.service_prices
  WHERE item_type = 'package' AND item_id = p_package_id;
  IF NOT FOUND OR v_package_price IS NULL THEN
    RAISE EXCEPTION 'No price found for package: %', p_package_id;
  END IF;

  v_total := ROUND(v_package_price * v_vehicle_factor);

  -- ---- Zusatzleistungen (ohne Abholservice) ----
  FOREACH v_addon_id IN ARRAY p_add_on_ids LOOP
    CONTINUE WHEN v_addon_id = c_pickup_addon;

    SELECT amount INTO v_addon_price
    FROM public.service_prices
    WHERE item_type = 'addon' AND item_id = v_addon_id;

    IF FOUND AND v_addon_price IS NOT NULL THEN
      v_total := v_total + ROUND(v_addon_price * v_vehicle_factor);
    END IF;
  END LOOP;

  -- ---- Abholservice nach Entfernungsstaffel ----
  IF c_pickup_addon = ANY(p_add_on_ids) THEN
    v_pickup_city := NULLIF(trim(COALESCE(p_pickup_city, '')), '');

    IF v_pickup_city IS NULL OR NOT (c_pickup_km ? v_pickup_city) THEN
      RAISE EXCEPTION 'Bitte wählen Sie einen gültigen Abholort für den Hol- & Bringservice.';
    END IF;

    v_pickup_km   := (c_pickup_km ->> v_pickup_city)::numeric;
    v_is_included := (p_package_id = c_pickup_free_pkg AND v_pickup_km <= c_pickup_free_km);

    IF v_is_included THEN
      v_pickup_price := 0;
    ELSIF v_pickup_km > c_pickup_max_km THEN
      RAISE EXCEPTION 'Abholungen über % km kalkulieren wir individuell. Bitte kontaktieren Sie uns direkt.', c_pickup_max_km;
    ELSE
      -- kleinste passende Staffelstufe wählen
      v_pickup_tier := CASE
        WHEN v_pickup_km <= 10 THEN 'tier_10'
        WHEN v_pickup_km <= 20 THEN 'tier_20'
        ELSE 'tier_50'
      END;

      SELECT amount INTO v_pickup_price
      FROM public.service_prices
      WHERE item_type = 'pickup' AND item_id = v_pickup_tier;

      IF NOT FOUND OR v_pickup_price IS NULL THEN
        RAISE EXCEPTION 'No price found for pickup tier: %', v_pickup_tier;
      END IF;
    END IF;

    -- Der Abholpreis ist eine Pauschale und wird nicht mit dem Fahrzeugfaktor multipliziert.
    v_total := v_total + v_pickup_price;
  ELSE
    v_pickup_city := NULL;
  END IF;

  -- ---- new-customer check ----
  SELECT NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE lower(customer_email) = lower(p_customer_email)
       OR upper(replace(replace(customer_plate, ' ', ''), '-', ''))
          = upper(replace(replace(p_customer_plate, ' ', ''), '-', ''))
  ) INTO v_is_new_customer;

  -- ---- invoice number (nebenläufigkeitssicher über die Sequence) ----
  v_invoice_number := c_invoice_prefix
                   || to_char(current_date, 'YYYY')
                   || '-'
                   || nextval('public.invoice_number_seq')::text;

  -- ---- deposit ----
  IF v_is_new_customer THEN
    v_deposit_amount := ROUND(v_total * c_deposit_rate * 100.0) / 100.0;
    v_deposit_status := 'offen';
  ELSE
    v_deposit_amount := 0;
    v_deposit_status := 'nicht_erforderlich';
  END IF;

  -- ---- insert ----
  INSERT INTO public.bookings (
    invoice_number,  vehicle_id,   package_id,    add_on_ids,
    booking_date,    booking_time,  pickup_city,
    customer_name,   customer_email, customer_phone, customer_plate,
    total,           status,        is_new_customer,
    deposit_amount,  deposit_status
  ) VALUES (
    v_invoice_number, p_vehicle_id, p_package_id, p_add_on_ids,
    p_booking_date,   p_booking_time, v_pickup_city,
    trim(p_customer_name),  lower(trim(p_customer_email)),
    trim(p_customer_phone), upper(trim(p_customer_plate)),
    v_total,          'Angefragt',   v_is_new_customer,
    v_deposit_amount, v_deposit_status
  )
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'id',             v_row.id,
    'invoice_number', v_row.invoice_number,
    'created_at',     v_row.created_at,
    'vehicle_id',     v_row.vehicle_id,
    'package_id',     v_row.package_id,
    'add_on_ids',     v_row.add_on_ids,
    'booking_date',   v_row.booking_date,
    'booking_time',   v_row.booking_time,
    'pickup_city',    v_row.pickup_city,
    'customer_name',  v_row.customer_name,
    'customer_email', v_row.customer_email,
    'customer_phone', v_row.customer_phone,
    'customer_plate', v_row.customer_plate,
    'total',          v_row.total,
    'status',         v_row.status,
    'is_new_customer',v_row.is_new_customer,
    'deposit_amount', v_row.deposit_amount,
    'deposit_status', v_row.deposit_status,
    'access_token',   v_row.access_token
  );
END;
$$;

-- Alte 9-Parameter-Variante entfernen, damit kein veralteter Aufruf mehr greift.
DROP FUNCTION IF EXISTS public.create_booking_public(
  text, text, text[], date, text, text, text, text, text
);

REVOKE ALL ON FUNCTION public.create_booking_public(
  text, text, text[], date, text, text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_public(
  text, text, text[], date, text, text, text, text, text, text
) TO anon, authenticated, service_role;
