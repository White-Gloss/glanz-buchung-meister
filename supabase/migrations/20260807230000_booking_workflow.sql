-- =====================================================================
-- BUCHUNGS-WORKFLOW: Tageslimit, Prüfstatus und Gegenangebot
-- =====================================================================
-- Vier Änderungen am Buchungsmodell:
--
--   1. Termine sind rein datumsbasiert. Uhrzeiten werden weder abgefragt
--      noch angezeigt; die genaue Zeit wird wenige Tage vorher persönlich
--      abgestimmt. Die Spalte booking_time bleibt bestehen, damit
--      Altbuchungen lesbar sind, ist aber nicht mehr befüllt.
--
--   2. Höchstens drei aktive Buchungen pro Kalendertag. Abgesichert wird
--      das an zwei Stellen: in create_booking_public (öffentlicher Weg)
--      und über einen Trigger (Admin-Weg, direkte Statusänderungen).
--      Beides ist nötig — der Trigger allein könnte Wettläufe nicht
--      verhindern, die Funktion allein nicht den Admin-Pfad abdecken.
--
--   3. Jede Anfrage startet als „Wartend auf Prüfung". Verbindlich wird
--      sie erst, wenn der Betrieb sie freigibt und — im Fall eines
--      Gegenangebots — der Kunde zustimmt.
--
--   4. Gegenangebot: angepasster Preis mit Begründung plus bis zu drei
--      Ersatzterminen, aus denen der Kunde per Klick in der E-Mail wählt.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Uhrzeit wird nicht mehr erhoben
-- ---------------------------------------------------------------------
ALTER TABLE public.bookings ALTER COLUMN booking_time DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN booking_time DROP DEFAULT;

-- ---------------------------------------------------------------------
-- 2. Neue Felder
-- ---------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS preferred_contact text NOT NULL DEFAULT 'E-Mail',
  ADD COLUMN IF NOT EXISTS offer_note        text,
  ADD COLUMN IF NOT EXISTS offer_alt_dates   date[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS offer_sent_at     timestamptz,
  ADD COLUMN IF NOT EXISTS customer_reply_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname  = 'bookings_preferred_contact_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_preferred_contact_check
      CHECK (preferred_contact IN ('WhatsApp', 'Telefon', 'E-Mail'));
  END IF;
END $$;

-- Höchstens drei Ersatztermine, und nur wenn ein Gegenangebot vorliegt.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname  = 'bookings_offer_alt_dates_max3'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_offer_alt_dates_max3
      CHECK (array_length(offer_alt_dates, 1) IS NULL OR array_length(offer_alt_dates, 1) <= 3);
  END IF;
END $$;

COMMENT ON COLUMN public.bookings.booking_time IS
  'Historisch. Termine sind datumsbasiert; die Uhrzeit wird wenige Tage vorher persönlich abgestimmt.';
COMMENT ON COLUMN public.bookings.preferred_contact IS
  'Bevorzugter Kontaktweg des Kunden für die Uhrzeit-Absprache.';
COMMENT ON COLUMN public.bookings.offer_alt_dates IS
  'Bis zu drei Ersatztermine aus dem Gegenangebot, aus denen der Kunde wählen kann.';

-- ---------------------------------------------------------------------
-- 3. Statuswerte
-- ---------------------------------------------------------------------
-- Bestandsdaten auf die neue Benennung heben, bevor die Regel greift.
UPDATE public.bookings SET status = 'Wartend auf Prüfung' WHERE status = 'Angefragt';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname  = 'bookings_status_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_status_check
      CHECK (status IN (
        'Wartend auf Prüfung',
        'Gegenangebot gesendet',
        'Bestätigt',
        'Ausstehend',
        'Bezahlt',
        'Storniert'
      ));
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4. Tageskapazität
-- ---------------------------------------------------------------------
-- Eine stornierte Buchung belegt keinen Platz. Alles andere schon, auch
-- eine noch ungeprüfte Anfrage: sonst könnten drei offene Anfragen den
-- Tag überbuchen, sobald sie nacheinander bestätigt werden.
CREATE OR REPLACE FUNCTION public.bookings_per_day(p_date date)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::integer
    FROM public.bookings
   WHERE booking_date = p_date
     AND status <> 'Storniert';
$$;

COMMENT ON FUNCTION public.bookings_per_day(date) IS
  'Belegte Plätze an einem Kalendertag. Maximal drei, siehe MAX_BOOKINGS_PER_DAY.';

GRANT EXECUTE ON FUNCTION public.bookings_per_day(date) TO anon, authenticated;

-- Trigger für alle Wege, die nicht über create_booking_public laufen:
-- Anlage durch den Betrieb, Datumsänderung, Reaktivierung einer Stornierung.
CREATE OR REPLACE FUNCTION public.enforce_daily_booking_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c_max constant integer := 3;
  v_used integer;
BEGIN
  -- Stornierte Buchungen belegen nichts und dürfen immer geschrieben werden.
  IF NEW.status = 'Storniert' THEN
    RETURN NEW;
  END IF;

  -- Nur prüfen, wenn sich am belegten Platz tatsächlich etwas ändert.
  IF TG_OP = 'UPDATE'
     AND NEW.booking_date = OLD.booking_date
     AND OLD.status <> 'Storniert' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('booking_day:' || NEW.booking_date::text));

  SELECT count(*) INTO v_used
    FROM public.bookings
   WHERE booking_date = NEW.booking_date
     AND status <> 'Storniert'
     AND id <> NEW.id;

  IF v_used >= c_max THEN
    RAISE EXCEPTION 'Für den % sind bereits % Termine vergeben. Bitte wählen Sie einen anderen Tag.',
      to_char(NEW.booking_date, 'DD.MM.YYYY'), c_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_daily_booking_limit ON public.bookings;
CREATE TRIGGER enforce_daily_booking_limit
  BEFORE INSERT OR UPDATE OF booking_date, status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_daily_booking_limit();

-- ---------------------------------------------------------------------
-- 5. Öffentliche Buchungsfunktion ohne Uhrzeit
-- ---------------------------------------------------------------------
-- WICHTIG: p_booking_time bleibt in der Signatur, obwohl keine Uhrzeit mehr
-- erhoben wird. Grund ist die Auslieferungslücke — solange auf dem Server noch
-- ein älterer Stand der Anwendung läuft, ruft dieser mit zehn Argumenten
-- inklusive Uhrzeit auf. Ohne den Parameter hätte der Aufruf dieselbe
-- Argumentzahl und dieselben Typen, aber alle Werte ab dem Datum wären um eine
-- Stelle verschoben: der Name landete in der E-Mail-Spalte und so fort.
DROP FUNCTION IF EXISTS public.create_booking_public(
  text, text, text[], date, text, text, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.create_booking_public(
  p_vehicle_id        text,
  p_package_id        text,
  p_add_on_ids        text[],
  p_booking_date      date,
  p_booking_time      text,
  p_customer_name     text,
  p_customer_email    text,
  p_customer_phone    text,
  p_customer_plate    text,
  p_pickup_city       text DEFAULT NULL,
  p_preferred_contact text DEFAULT 'E-Mail'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c_vehicles  constant text[] := ARRAY['kompakt','suv','transporter'];
  c_packages  constant text[] := ARRAY['basis','premium','keramik'];
  c_addons    constant text[] := ARRAY['felgen','ozon','motor','leder','scheinwerfer','hol'];
  c_contacts  constant text[] := ARRAY['WhatsApp','Telefon','E-Mail'];
  c_max_day   constant integer := 3;

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

  c_invoice_prefix  constant text    := 'WGD-';
  c_deposit_rate    constant numeric := 0.2;

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

  v_used            integer;
  v_is_new_customer boolean;
  v_invoice_number  text;
  v_deposit_amount  numeric;
  v_deposit_status  text;
  v_row             public.bookings;
BEGIN
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
  IF NOT (COALESCE(p_preferred_contact, 'E-Mail') = ANY(c_contacts)) THEN
    RAISE EXCEPTION 'Invalid preferred_contact: %', p_preferred_contact;
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

  -- Tagessperre: gleiche Sperre wie im Trigger, damit zwei gleichzeitige
  -- Anfragen für denselben Tag nicht beide durchrutschen.
  PERFORM pg_advisory_xact_lock(hashtext('booking_day:' || p_booking_date::text));

  SELECT count(*) INTO v_used
    FROM public.bookings
   WHERE booking_date = p_booking_date
     AND status <> 'Storniert';

  IF v_used >= c_max_day THEN
    RAISE EXCEPTION 'Dieser Tag ist bereits ausgebucht. Bitte wählen Sie ein anderes Datum.';
  END IF;

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
    CONTINUE WHEN v_addon_id = c_pickup_addon;

    SELECT amount INTO v_addon_price
    FROM public.service_prices
    WHERE item_type = 'addon' AND item_id = v_addon_id;

    IF FOUND AND v_addon_price IS NOT NULL THEN
      v_total := v_total + ROUND(v_addon_price * v_vehicle_factor);
    END IF;
  END LOOP;

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

    v_total := v_total + v_pickup_price;
  ELSE
    v_pickup_city := NULL;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE lower(customer_email) = lower(p_customer_email)
       OR upper(replace(replace(customer_plate, ' ', ''), '-', ''))
          = upper(replace(replace(p_customer_plate, ' ', ''), '-', ''))
  ) INTO v_is_new_customer;

  v_invoice_number := c_invoice_prefix
                   || to_char(current_date, 'YYYY')
                   || '-'
                   || nextval('public.invoice_number_seq')::text;

  IF v_is_new_customer THEN
    v_deposit_amount := ROUND(v_total * c_deposit_rate * 100.0) / 100.0;
    v_deposit_status := 'offen';
  ELSE
    v_deposit_amount := 0;
    v_deposit_status := 'nicht_erforderlich';
  END IF;

  INSERT INTO public.bookings (
    invoice_number,  vehicle_id,     package_id,     add_on_ids,
    booking_date,    booking_time,   pickup_city,    preferred_contact,
    customer_name,   customer_email, customer_phone, customer_plate,
    total,           status,         is_new_customer,
    deposit_amount,  deposit_status
  ) VALUES (
    v_invoice_number, p_vehicle_id,  p_package_id,   p_add_on_ids,
    p_booking_date,   NULLIF(trim(COALESCE(p_booking_time, '')), ''),
    v_pickup_city,    COALESCE(p_preferred_contact, 'E-Mail'),
    trim(p_customer_name),  lower(trim(p_customer_email)),
    trim(p_customer_phone), upper(trim(p_customer_plate)),
    v_total,          'Wartend auf Prüfung', v_is_new_customer,
    v_deposit_amount, v_deposit_status
  )
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'id',                v_row.id,
    'invoice_number',    v_row.invoice_number,
    'created_at',        v_row.created_at,
    'vehicle_id',        v_row.vehicle_id,
    'package_id',        v_row.package_id,
    'add_on_ids',        v_row.add_on_ids,
    'booking_date',      v_row.booking_date,
    'booking_time',      v_row.booking_time,
    'pickup_city',       v_row.pickup_city,
    'preferred_contact', v_row.preferred_contact,
    'customer_name',     v_row.customer_name,
    'customer_email',    v_row.customer_email,
    'customer_phone',    v_row.customer_phone,
    'customer_plate',    v_row.customer_plate,
    'total',             v_row.total,
    'agreed_price',      v_row.agreed_price,
    'status',            v_row.status,
    'is_new_customer',   v_row.is_new_customer,
    'deposit_amount',    v_row.deposit_amount,
    'deposit_status',    v_row.deposit_status,
    'offer_note',        v_row.offer_note,
    'offer_alt_dates',   v_row.offer_alt_dates,
    'access_token',      v_row.access_token
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_booking_public(
  text, text, text[], date, text, text, text, text, text, text, text
) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Auslastung eines Zeitraums für Kalender und Dashboard
-- ---------------------------------------------------------------------
-- Liefert je Tag die Zahl der belegten Plätze. Der Buchungsassistent
-- sperrt damit ausgebuchte Tage, das Dashboard zeigt „2 von 3".
CREATE OR REPLACE FUNCTION public.booking_day_load(p_from date, p_to date)
RETURNS TABLE (day date, used integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT booking_date AS day, count(*)::integer AS used
    FROM public.bookings
   WHERE booking_date BETWEEN p_from AND p_to
     AND status <> 'Storniert'
   GROUP BY booking_date;
$$;

GRANT EXECUTE ON FUNCTION public.booking_day_load(date, date) TO anon, authenticated;
