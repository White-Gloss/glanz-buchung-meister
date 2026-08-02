-- =====================================================================
-- Audit-Log: handelnde Person zuverlässig erfassen
--
-- Admin-Änderungen laufen über den direkten Postgres-Pool (db.server.ts)
-- und nicht über die Supabase-API. Dort ist auth.uid() immer NULL, weshalb
-- actor_email bisher bei jedem Eintrag leer blieb. Die Anwendung setzt jetzt
-- vor jedem Schreibzugriff die transaktionslokale Variable app.actor_email;
-- der Trigger bevorzugt diesen Wert und fällt sonst auf auth.uid() zurück.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.log_booking_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor      uuid := auth.uid();
  actor_mail text;
BEGIN
  actor_mail := NULLIF(trim(COALESCE(current_setting('app.actor_email', true), '')), '');
  IF actor_mail IS NULL THEN
    actor_mail := public.current_actor_email();
  END IF;

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
