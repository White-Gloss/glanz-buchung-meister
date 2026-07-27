-- Prevent double-bookings: unique partial index on (booking_date, booking_time)
-- excluding cancelled bookings so a cancelled slot can be re-booked.
CREATE UNIQUE INDEX bookings_date_time_unique_idx
  ON public.bookings (booking_date, booking_time)
  WHERE status <> 'Storniert';

-- Update create_booking_public to check availability before inserting.
CREATE OR REPLACE FUNCTION public.create_booking_public(
  p_vehicle_id      text,
  p_package_id      text,
  p_add_on_ids      text[],
  p_booking_date    date,
  p_booking_time    text,
  p_customer_name   text,
  p_customer_email  text,
  p_customer_phone  text,
  p_customer_plate  text
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
  -- 'hol' is flat-priced (no vehicle factor) and included free in 'keramik'
  c_flat_addons     constant text[] := ARRAY['hol'];
  c_included_map    constant jsonb  := '{"hol":["keramik"]}';

  -- ---- business rule constants (mirrors servicesConfig.ts) ----
  c_invoice_prefix  constant text    := 'WGD-2026-';
  c_invoice_start   constant int     := 1001;
  c_deposit_rate    constant numeric := 0.2;

  -- ---- computed locals ----
  v_vehicle_factor  numeric;
  v_package_price   numeric;
  v_addon_price     numeric;
  v_total           numeric := 0;
  v_addon_id        text;
  v_is_included     boolean;

  v_is_new_customer boolean;
  v_booking_count   bigint;
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
  -- Use pg_advisory_xact_lock to serialize concurrent requests for the same slot.
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

  FOREACH v_addon_id IN ARRAY p_add_on_ids LOOP
    -- Check if this add-on is included free in the selected package
    v_is_included := (
      c_included_map ? v_addon_id
      AND (c_included_map -> v_addon_id) @> to_jsonb(p_package_id)
    );
    IF NOT v_is_included THEN
      SELECT amount INTO v_addon_price
      FROM public.service_prices
      WHERE item_type = 'addon' AND item_id = v_addon_id;
      IF FOUND AND v_addon_price IS NOT NULL THEN
        -- Flat-priced add-ons are not multiplied by vehicle factor
        IF v_addon_id = ANY(c_flat_addons) THEN
          v_total := v_total + v_addon_price;
        ELSE
          v_total := v_total + ROUND(v_addon_price * v_vehicle_factor);
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- ---- new-customer check ----
  SELECT NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE lower(customer_email) = lower(p_customer_email)
       OR upper(replace(replace(customer_plate, ' ', ''), '-', ''))
          = upper(replace(replace(p_customer_plate, ' ', ''), '-', ''))
  ) INTO v_is_new_customer;

  -- ---- invoice number (sequential, race-safe via FOR UPDATE) ----
  SELECT COUNT(*) INTO v_booking_count FROM public.bookings;
  v_invoice_number := c_invoice_prefix || (c_invoice_start + v_booking_count)::text;

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
    booking_date,    booking_time,
    customer_name,   customer_email, customer_phone, customer_plate,
    total,           status,        is_new_customer,
    deposit_amount,  deposit_status
  ) VALUES (
    v_invoice_number, p_vehicle_id, p_package_id, p_add_on_ids,
    p_booking_date,   p_booking_time,
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

-- Re-apply grants (CREATE OR REPLACE does not preserve them)
REVOKE ALL ON FUNCTION public.create_booking_public(
  text, text, text[], date, text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_public(
  text, text, text[], date, text, text, text, text, text
) TO anon, authenticated, service_role;
