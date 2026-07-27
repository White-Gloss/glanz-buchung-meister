/**
 * Initialises the Replit-managed Postgres database.
 * Applies the essential schema without Supabase-specific roles/auth.
 * Safe to run multiple times (idempotent).
 */
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ------------------------------------------------------------------
    // set_updated_at trigger function
    // ------------------------------------------------------------------
    await client.query(`
      CREATE OR REPLACE FUNCTION public.set_updated_at()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
    `);

    // ------------------------------------------------------------------
    // bookings
    // ------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.bookings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number text NOT NULL UNIQUE,
        vehicle_id text NOT NULL,
        package_id text NOT NULL,
        add_on_ids text[] NOT NULL DEFAULT '{}',
        booking_date date NOT NULL,
        booking_time text NOT NULL,
        customer_name text NOT NULL,
        customer_email text NOT NULL,
        customer_phone text NOT NULL,
        customer_plate text NOT NULL,
        total numeric(10,2) NOT NULL,
        status text NOT NULL DEFAULT 'Angefragt',
        is_new_customer boolean NOT NULL DEFAULT true,
        deposit_amount numeric(10,2) NOT NULL DEFAULT 0,
        deposit_status text NOT NULL DEFAULT 'nicht_erforderlich',
        deposit_reference text,
        access_token uuid NOT NULL DEFAULT gen_random_uuid(),
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS bookings_email_idx
        ON public.bookings (lower(customer_email));
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS bookings_plate_idx
        ON public.bookings (upper(replace(customer_plate, ' ', '')));
    `);

    // Unique partial index: one booking per slot, excluding cancelled
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS bookings_date_time_unique_idx
        ON public.bookings (booking_date, booking_time)
        WHERE status <> 'Storniert';
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS bookings_set_updated_at ON public.bookings;
      CREATE TRIGGER bookings_set_updated_at
        BEFORE UPDATE ON public.bookings
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    `);

    // ------------------------------------------------------------------
    // service_prices
    // ------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.service_prices (
        id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        item_type text NOT NULL CHECK (item_type IN ('package','addon','vehicle')),
        item_id text NOT NULL,
        label text NOT NULL,
        amount numeric NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (item_type, item_id)
      )
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS service_prices_set_updated_at ON public.service_prices;
      CREATE TRIGGER service_prices_set_updated_at
        BEFORE UPDATE ON public.service_prices
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    `);

    // Seed prices (idempotent)
    await client.query(`
      INSERT INTO public.service_prices (item_type, item_id, label, amount) VALUES
        ('package','basis','Basis Pflege',149),
        ('package','premium','Premium Glanz',349),
        ('package','keramik','High-End Keramik',899),
        ('addon','felgen','Felgen-Spezial',89),
        ('addon','ozon','Innenraum-Ozon',59),
        ('addon','motor','Motorwäsche',69),
        ('addon','leder','Lederpflege Deluxe',119),
        ('addon','scheinwerfer','Scheinwerfer-Aufbereitung',79),
        ('addon','hol','Hol- & Bringservice (Abholservice)',60),
        ('vehicle','kompakt','Kompaktklasse (Faktor)',1),
        ('vehicle','suv','SUV / Limousine (Faktor)',1.25),
        ('vehicle','transporter','Transporter (Faktor)',1.55)
      ON CONFLICT (item_type, item_id) DO NOTHING;
    `);

    // ------------------------------------------------------------------
    // booking_audit_log
    // ------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.booking_audit_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id uuid NOT NULL,
        invoice_number text,
        action text NOT NULL,
        field text,
        old_value text,
        new_value text,
        actor_id uuid,
        actor_email text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_booking_audit_log_booking_id
        ON public.booking_audit_log (booking_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_booking_audit_log_created_at
        ON public.booking_audit_log (created_at DESC);
    `);

    // ------------------------------------------------------------------
    // create_booking_public (SECURITY DEFINER not needed on Replit Postgres,
    // but kept for schema parity)
    // ------------------------------------------------------------------
    await client.query(`
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
      AS $$
      DECLARE
        c_vehicles  constant text[] := ARRAY['kompakt','suv','transporter'];
        c_packages  constant text[] := ARRAY['basis','premium','keramik'];
        c_addons    constant text[] := ARRAY['felgen','ozon','motor','leder','scheinwerfer','hol'];
        c_timeslots constant text[] := ARRAY['08:00','10:00','12:00','14:00','16:00','18:00'];
        c_flat_addons     constant text[] := ARRAY['hol'];
        c_included_map    constant jsonb  := '{"hol":["keramik"]}';
        c_invoice_prefix  constant text    := 'WGD-2026-';
        c_invoice_start   constant int     := 1001;
        c_deposit_rate    constant numeric := 0.2;

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
        IF trim(p_customer_name) = '' OR length(trim(p_customer_name)) < 2 THEN
          RAISE EXCEPTION 'customer_name too short';
        END IF;
        IF trim(p_customer_email) = '' OR p_customer_email NOT LIKE '%%@%%.%%' THEN
          RAISE EXCEPTION 'customer_email invalid';
        END IF;
        IF trim(p_customer_phone) = '' OR length(trim(p_customer_phone)) < 6 THEN
          RAISE EXCEPTION 'customer_phone too short';
        END IF;
        IF trim(p_customer_plate) = '' OR length(trim(p_customer_plate)) < 3 THEN
          RAISE EXCEPTION 'customer_plate too short';
        END IF;

        -- Slot availability: advisory lock serialises concurrent requests
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

        -- Price computation
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
          v_is_included := (
            c_included_map ? v_addon_id
            AND (c_included_map -> v_addon_id) @> to_jsonb(p_package_id)
          );
          IF NOT v_is_included THEN
            SELECT amount INTO v_addon_price
            FROM public.service_prices
            WHERE item_type = 'addon' AND item_id = v_addon_id;
            IF FOUND AND v_addon_price IS NOT NULL THEN
              IF v_addon_id = ANY(c_flat_addons) THEN
                v_total := v_total + v_addon_price;
              ELSE
                v_total := v_total + ROUND(v_addon_price * v_vehicle_factor);
              END IF;
            END IF;
          END IF;
        END LOOP;

        -- New-customer check
        SELECT NOT EXISTS (
          SELECT 1 FROM public.bookings
          WHERE lower(customer_email) = lower(p_customer_email)
             OR upper(replace(replace(customer_plate, ' ', ''), '-', ''))
                = upper(replace(replace(p_customer_plate, ' ', ''), '-', ''))
        ) INTO v_is_new_customer;

        -- Invoice number
        SELECT COUNT(*) INTO v_booking_count FROM public.bookings;
        v_invoice_number := c_invoice_prefix || (c_invoice_start + v_booking_count)::text;

        -- Deposit
        IF v_is_new_customer THEN
          v_deposit_amount := ROUND(v_total * c_deposit_rate * 100.0) / 100.0;
          v_deposit_status := 'offen';
        ELSE
          v_deposit_amount := 0;
          v_deposit_status := 'nicht_erforderlich';
        END IF;

        -- Insert
        INSERT INTO public.bookings (
          invoice_number, vehicle_id,   package_id,    add_on_ids,
          booking_date,   booking_time,
          customer_name,  customer_email, customer_phone, customer_plate,
          total,          status,        is_new_customer,
          deposit_amount, deposit_status
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
    `);

    await client.query("COMMIT");
    console.log("✓ Database schema initialised successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("✗ DB init failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
