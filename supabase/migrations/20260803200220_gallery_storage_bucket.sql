-- =====================================================================
-- Vorher/Nachher-Galerie: Speicherort für hochgeladene Fahrzeugfotos
-- =====================================================================
--
-- Oeffentlicher Bucket, weil die Bilder auf der Website fuer alle
-- Besucher sichtbar sein sollen (das ist der Sinn der Galerie).
-- Schreibrechte bleiben trotzdem auf Admins beschraenkt.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gallery',
  'gallery',
  true,
  8388608, -- 8 MB je Bild
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

CREATE POLICY "Jeder darf Galeriebilder ansehen"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery');

CREATE POLICY "Admins duerfen Galeriebilder hochladen"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins duerfen Galeriebilder loeschen"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gallery' AND public.has_role(auth.uid(), 'admin'::public.app_role));
