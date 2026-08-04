-- =====================================================================
-- Vorher/Nachher-Galerie: Metadaten je Bild
-- =====================================================================
--
-- Die eigentlichen Bilddateien liegen im Storage-Bucket "gallery"
-- (siehe vorherige Migration). Diese Tabelle haelt nur die Zuordnung
-- und Beschriftung - getrennt von den Dateien, damit sich Titel und
-- Reihenfolge aendern lassen, ohne Dateien neu hochzuladen.

CREATE TABLE public.gallery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL,
  title text NOT NULL DEFAULT '',
  vehicle text NOT NULL DEFAULT '',
  service_slug text,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jeder darf veroeffentlichte Galeriebilder lesen"
  ON public.gallery_items FOR SELECT TO anon, authenticated
  USING (is_published = true);

CREATE POLICY "Admins sehen auch unveroeffentlichte Galeriebilder"
  ON public.gallery_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins duerfen Galeriebilder anlegen"
  ON public.gallery_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins duerfen Galeriebilder bearbeiten"
  ON public.gallery_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins duerfen Galeriebilder loeschen"
  ON public.gallery_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.gallery_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_items TO authenticated;
GRANT ALL ON public.gallery_items TO service_role;
