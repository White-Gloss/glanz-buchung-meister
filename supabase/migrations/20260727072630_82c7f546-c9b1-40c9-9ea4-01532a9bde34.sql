CREATE OR REPLACE FUNCTION public.current_actor_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email::text FROM auth.users u WHERE u.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_actor_email() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_booking_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_mail text := public.current_actor_email();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_audit_log (booking_id, invoice_number, action, field, old_value, new_value, actor_id, actor_email)
    VALUES (NEW.id, NEW.invoice_number, 'Buchung erstellt', 'Status', NULL, NEW.status, actor, COALESCE(actor_mail, NEW.customer_email));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.booking_audit_log (booking_id, invoice_number, action, field, old_value, new_value, actor_id, actor_email)
    VALUES (OLD.id, OLD.invoice_number, 'Buchung gelöscht', 'Status', OLD.status, NULL, actor, actor_mail);
    RETURN OLD;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.booking_audit_log (booking_id, invoice_number, action, field, old_value, new_value, actor_id, actor_email)
    VALUES (NEW.id, NEW.invoice_number, 'Status geändert', 'Status', OLD.status, NEW.status, actor, actor_mail);
  END IF;

  IF NEW.deposit_status IS DISTINCT FROM OLD.deposit_status THEN
    INSERT INTO public.booking_audit_log (booking_id, invoice_number, action, field, old_value, new_value, actor_id, actor_email)
    VALUES (NEW.id, NEW.invoice_number, 'Anzahlung geändert', 'Anzahlung', OLD.deposit_status, NEW.deposit_status, actor, actor_mail);
  END IF;

  IF NEW.deposit_amount IS DISTINCT FROM OLD.deposit_amount THEN
    INSERT INTO public.booking_audit_log (booking_id, invoice_number, action, field, old_value, new_value, actor_id, actor_email)
    VALUES (NEW.id, NEW.invoice_number, 'Anzahlung geändert', 'Anzahlungsbetrag', OLD.deposit_amount::text, NEW.deposit_amount::text, actor, actor_mail);
  END IF;

  IF NEW.total IS DISTINCT FROM OLD.total THEN
    INSERT INTO public.booking_audit_log (booking_id, invoice_number, action, field, old_value, new_value, actor_id, actor_email)
    VALUES (NEW.id, NEW.invoice_number, 'Preis geändert', 'Gesamtpreis', OLD.total::text, NEW.total::text, actor, actor_mail);
  END IF;

  IF NEW.booking_date IS DISTINCT FROM OLD.booking_date OR NEW.booking_time IS DISTINCT FROM OLD.booking_time THEN
    INSERT INTO public.booking_audit_log (booking_id, invoice_number, action, field, old_value, new_value, actor_id, actor_email)
    VALUES (NEW.id, NEW.invoice_number, 'Termin geändert', 'Termin',
      OLD.booking_date::text || ' ' || OLD.booking_time,
      NEW.booking_date::text || ' ' || NEW.booking_time, actor, actor_mail);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_booking_audit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bookings_audit_insert ON public.bookings;
CREATE TRIGGER trg_bookings_audit_insert
AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.log_booking_audit();

DROP TRIGGER IF EXISTS trg_bookings_audit_update ON public.bookings;
CREATE TRIGGER trg_bookings_audit_update
AFTER UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.log_booking_audit();

DROP TRIGGER IF EXISTS trg_bookings_audit_delete ON public.bookings;
CREATE TRIGGER trg_bookings_audit_delete
AFTER DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.log_booking_audit();