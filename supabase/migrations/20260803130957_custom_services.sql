-- =====================================================================
-- Eigene Dienstleistungen (Admin-verwaltet)
-- =====================================================================
--
-- Die ursprünglichen 7 Leistungen bleiben im Code (src/lib/servicePages.ts) -
-- für sie existieren handgeschriebene Local-SEO-Texte je Entfernungsband
-- (28 individuelle Absätze, damit Google keinen Duplicate Content sieht).
-- Diese Tabelle ergänzt zusätzliche, vom Admin selbst angelegte
-- Dienstleistungen. Sie erscheinen auf /leistungen und bekommen eine
-- eigene Detailseite - aber (bewusst) KEINE 91-Kombinationen mit allen
-- Staedten, weil dafür die handgeschriebenen Entfernungstexte fehlen
-- wuerden. Stattdessen verlinkt jede eigene Leistung auf den normalen
-- Abholservice.

CREATE TABLE public.custom_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text NOT NULL,
  eyebrow text NOT NULL DEFAULT '',
  lead text NOT NULL,
  detail text NOT NULL DEFAULT '',
  benefits text[] NOT NULL DEFAULT '{}',
  meta_title text NOT NULL DEFAULT '',
  meta_description text NOT NULL DEFAULT '',
  related_package_ids text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Slug-Format erzwingen: Kleinbuchstaben, Ziffern, Bindestriche - passend
-- zur URL-Struktur der bestehenden Leistungsseiten.
ALTER TABLE public.custom_services
  ADD CONSTRAINT custom_services_slug_format
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 60);

ALTER TABLE public.custom_services ENABLE ROW LEVEL SECURITY;

-- Oeffentlich lesbar (nur veroeffentlichte) - fuer die Website selbst.
CREATE POLICY "Anyone can read published custom services"
  ON public.custom_services FOR SELECT TO anon, authenticated
  USING (is_published = true);

-- Admins sehen zusaetzlich unveroeffentlichte Entwuerfe.
CREATE POLICY "Admins can read all custom services"
  ON public.custom_services FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert custom services"
  ON public.custom_services FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update custom services"
  ON public.custom_services FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete custom services"
  ON public.custom_services FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER custom_services_set_updated_at
  BEFORE UPDATE ON public.custom_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.custom_services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_services TO authenticated;
GRANT ALL ON public.custom_services TO service_role;
