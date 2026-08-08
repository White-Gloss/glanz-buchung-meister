-- Neukundenanzahlung serverseitig auf 10 % begrenzen.
--
-- Die öffentliche Buchungsfunktion berechnet den Preis bereits geschützt auf
-- dem Server. Dieser Trigger greift unmittelbar vor dem INSERT und korrigiert
-- nur den Anzahlungsbetrag. Der aktuelle Angebots-, Termin- und Statusworkflow
-- bleibt dadurch vollständig unverändert.

CREATE OR REPLACE FUNCTION public.apply_new_customer_deposit_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_new_customer THEN
    NEW.deposit_amount := ROUND(NEW.total * 0.10 * 100.0) / 100.0;
    NEW.deposit_status := 'offen';
  ELSE
    NEW.deposit_amount := 0;
    NEW.deposit_status := 'nicht_erforderlich';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_new_customer_deposit_rate ON public.bookings;
CREATE TRIGGER apply_new_customer_deposit_rate
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_new_customer_deposit_rate();
