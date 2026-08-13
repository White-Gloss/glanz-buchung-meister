-- Evaluate the authenticated user once per statement rather than once per row.
-- This preserves the existing admin-only and owner-only access rules while
-- removing Supabase's auth_rls_initplan performance warnings.

ALTER POLICY "Admins can read audit log"
  ON public.booking_audit_log
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admins can read bookings"
  ON public.bookings
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admins can update bookings"
  ON public.bookings
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admins can delete bookings"
  ON public.bookings
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admins can create own token"
  ON public.calendar_feed_tokens
  WITH CHECK (
    (select auth.uid()) = user_id
    AND has_role((select auth.uid()), 'admin'::app_role)
  );

ALTER POLICY "Admins can read own token"
  ON public.calendar_feed_tokens
  USING (
    (select auth.uid()) = user_id
    AND has_role((select auth.uid()), 'admin'::app_role)
  );

ALTER POLICY "Admins can regenerate own token"
  ON public.calendar_feed_tokens
  USING (
    (select auth.uid()) = user_id
    AND has_role((select auth.uid()), 'admin'::app_role)
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    AND has_role((select auth.uid()), 'admin'::app_role)
  );

ALTER POLICY "Admins can read customer notes"
  ON public.customer_notes
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admins can write customer notes"
  ON public.customer_notes
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admins can update customer notes"
  ON public.customer_notes
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admins can insert service prices"
  ON public.service_prices
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admins can update service prices"
  ON public.service_prices
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Users can read own roles"
  ON public.user_roles
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Admins can insert roles"
  ON public.user_roles
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admins can update roles"
  ON public.user_roles
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admins can delete roles"
  ON public.user_roles
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- Cover the only application-owned foreign key without a supporting index.
CREATE INDEX IF NOT EXISTS customer_notes_updated_by_idx
  ON public.customer_notes (updated_by);
