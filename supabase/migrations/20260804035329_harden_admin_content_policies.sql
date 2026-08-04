-- Keep public gallery files directly readable without exposing bucket listings.
DROP POLICY IF EXISTS "Jeder darf Galeriebilder ansehen" ON storage.objects;

-- Split public and authenticated reads so each role evaluates only one policy.
DROP POLICY IF EXISTS "Anyone can read published custom services" ON public.custom_services;
DROP POLICY IF EXISTS "Admins can read all custom services" ON public.custom_services;

CREATE POLICY "Anyone can read published custom services"
  ON public.custom_services FOR SELECT TO anon
  USING (is_published = true);

CREATE POLICY "Authenticated users read visible custom services"
  ON public.custom_services FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins can insert custom services" ON public.custom_services;
CREATE POLICY "Admins can insert custom services"
  ON public.custom_services FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update custom services" ON public.custom_services;
CREATE POLICY "Admins can update custom services"
  ON public.custom_services FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete custom services" ON public.custom_services;
CREATE POLICY "Admins can delete custom services"
  ON public.custom_services FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Jeder darf veroeffentlichte Galeriebilder lesen" ON public.gallery_items;
DROP POLICY IF EXISTS "Admins sehen auch unveroeffentlichte Galeriebilder" ON public.gallery_items;

CREATE POLICY "Jeder darf veroeffentlichte Galeriebilder lesen"
  ON public.gallery_items FOR SELECT TO anon
  USING (is_published = true);

CREATE POLICY "Angemeldete Nutzer sehen sichtbare Galeriebilder"
  ON public.gallery_items FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins duerfen Galeriebilder anlegen" ON public.gallery_items;
CREATE POLICY "Admins duerfen Galeriebilder anlegen"
  ON public.gallery_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins duerfen Galeriebilder bearbeiten" ON public.gallery_items;
CREATE POLICY "Admins duerfen Galeriebilder bearbeiten"
  ON public.gallery_items FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins duerfen Galeriebilder loeschen" ON public.gallery_items;
CREATE POLICY "Admins duerfen Galeriebilder loeschen"
  ON public.gallery_items FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins duerfen Galeriebilder hochladen" ON storage.objects;
CREATE POLICY "Admins duerfen Galeriebilder hochladen"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gallery'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins duerfen Galeriebilder loeschen" ON storage.objects;
CREATE POLICY "Admins duerfen Galeriebilder loeschen"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'gallery'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

CREATE INDEX IF NOT EXISTS custom_services_created_by_idx
  ON public.custom_services (created_by);

CREATE INDEX IF NOT EXISTS gallery_items_created_by_idx
  ON public.gallery_items (created_by);
