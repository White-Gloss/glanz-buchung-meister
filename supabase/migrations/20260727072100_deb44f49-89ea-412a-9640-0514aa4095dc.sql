CREATE TABLE public.booking_audit_log (
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
);

GRANT SELECT ON public.booking_audit_log TO authenticated;
GRANT ALL ON public.booking_audit_log TO service_role;

ALTER TABLE public.booking_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log"
ON public.booking_audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_booking_audit_log_booking_id ON public.booking_audit_log (booking_id);
CREATE INDEX idx_booking_audit_log_created_at ON public.booking_audit_log (created_at DESC);