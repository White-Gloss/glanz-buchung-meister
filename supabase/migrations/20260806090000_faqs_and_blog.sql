-- =====================================================================
-- SEO-Inhalte: FAQs, Ratgeber-Beitraege und deren Verknuepfung
-- =====================================================================
--
-- Zwei redaktionelle Bereiche, die im Admin-Panel gepflegt werden:
--
--   faqs        Einzelne Frage/Antwort-Paare mit Kategorie. Sie erscheinen
--               auf /faq und koennen zusaetzlich unter einzelnen
--               Ratgeber-Beitraegen ausgespielt werden.
--   blog_posts  Ratgeber-Artikel inkl. aller Felder, die Google und die
--               sozialen Netzwerke fuer Rich Results bzw. Link-Vorschauen
--               auswerten (meta_*, og_image_url, focus_keywords).
--   blog_faqs   Verknuepfungstabelle: n FAQs je Beitrag, ein FAQ darf in
--               mehreren Beitraegen stehen. Bewusst als eigene Tabelle
--               statt als Array-Spalte, damit die Fremdschluessel echte
--               referenzielle Integritaet erzwingen - ein geloeschtes FAQ
--               kann so keine tote Referenz im Beitrag hinterlassen.
--
-- Sichtbarkeit folgt dem Muster der bestehenden Inhaltstabellen
-- (custom_services, gallery_items): oeffentlich lesbar sind nur
-- veroeffentlichte Zeilen, geschrieben wird ausschliesslich von Admins.

-- ---------------------------------------------------------------------
-- FAQs
-- ---------------------------------------------------------------------

CREATE TABLE public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  -- Freitext statt ENUM: die Kategorien ("Keramikversiegelung",
  -- "Innenraumreinigung", "Kosten", "Dauer" ...) sollen im Admin-Panel
  -- ohne Migration erweiterbar bleiben.
  category text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Leere Fragen/Antworten wuerden in der FAQPage-Auszeichnung als
-- unvollstaendiges Rich-Result-Snippet landen - Google wertet das als
-- Fehler. Deshalb schon auf Datenbankebene ausschliessen.
ALTER TABLE public.faqs
  ADD CONSTRAINT faqs_question_not_blank CHECK (length(btrim(question)) > 0),
  ADD CONSTRAINT faqs_answer_not_blank CHECK (length(btrim(answer)) > 0);

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jeder darf veroeffentlichte FAQs lesen"
  ON public.faqs FOR SELECT TO anon
  USING (is_published = true);

CREATE POLICY "Angemeldete Nutzer sehen sichtbare FAQs"
  ON public.faqs FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

CREATE POLICY "Admins duerfen FAQs anlegen"
  ON public.faqs FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Admins duerfen FAQs bearbeiten"
  ON public.faqs FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Admins duerfen FAQs loeschen"
  ON public.faqs FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE TRIGGER faqs_set_updated_at
  BEFORE UPDATE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Deckt die Standardabfrage der FAQ-Seite ab (Sortierung der sichtbaren FAQs).
CREATE INDEX faqs_published_sort_idx
  ON public.faqs (sort_order, created_at)
  WHERE is_published = true;

CREATE INDEX faqs_category_idx ON public.faqs (category);
CREATE INDEX faqs_created_by_idx ON public.faqs (created_by);

-- ---------------------------------------------------------------------
-- Ratgeber-Beitraege
-- ---------------------------------------------------------------------

CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  -- Markdown. Die Website rendert daraus HTML (siehe src/lib/blogContent.ts);
  -- roher HTML-Code wird beim Rendern escaped, damit ein kompromittierter
  -- Admin-Zugang kein Skript auf der oeffentlichen Seite platzieren kann.
  content text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  featured_image_url text,
  author text NOT NULL DEFAULT 'White Gloss Detailing',

  -- NULL = Entwurf. Ein Datum in der Zukunft plant die Veroeffentlichung
  -- vor; die oeffentlichen Abfragen filtern zusaetzlich auf published_at
  -- <= now(), sodass geplante Beitraege erst zum Termin sichtbar werden.
  published_at timestamptz,

  -- SEO-/Social-Felder. Leer lassen ist erlaubt - die Website faellt dann
  -- auf title bzw. excerpt zurueck, statt ein leeres Meta-Tag auszugeben.
  meta_title text NOT NULL DEFAULT '',
  meta_description text NOT NULL DEFAULT '',
  og_image_url text,
  focus_keywords text[] NOT NULL DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Slug-Format wie bei custom_services, damit die URL /ratgeber/<slug>
-- ohne Kodierung auskommt.
ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_slug_format
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 80);

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_title_not_blank CHECK (length(btrim(title)) > 0);

-- Bilder duerfen nur aus dem eigenen Storage oder von einer https-Quelle
-- kommen. Verhindert javascript:-URLs in src/og:image-Attributen.
ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_featured_image_url_scheme
  CHECK (featured_image_url IS NULL OR featured_image_url ~ '^https://'),
  ADD CONSTRAINT blog_posts_og_image_url_scheme
  CHECK (og_image_url IS NULL OR og_image_url ~ '^https://');

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jeder darf veroeffentlichte Beitraege lesen"
  ON public.blog_posts FOR SELECT TO anon
  USING (published_at IS NOT NULL AND published_at <= now());

CREATE POLICY "Angemeldete Nutzer sehen sichtbare Beitraege"
  ON public.blog_posts FOR SELECT TO authenticated
  USING (
    (published_at IS NOT NULL AND published_at <= now())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

CREATE POLICY "Admins duerfen Beitraege anlegen"
  ON public.blog_posts FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Admins duerfen Beitraege bearbeiten"
  ON public.blog_posts FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Admins duerfen Beitraege loeschen"
  ON public.blog_posts FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE TRIGGER blog_posts_set_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Uebersichtsseite: neueste veroeffentlichte Beitraege zuerst.
CREATE INDEX blog_posts_published_at_idx
  ON public.blog_posts (published_at DESC NULLS LAST);

CREATE INDEX blog_posts_created_by_idx ON public.blog_posts (created_by);

-- ---------------------------------------------------------------------
-- Verknuepfung Beitrag <-> FAQ (Many-to-Many)
-- ---------------------------------------------------------------------

CREATE TABLE public.blog_faqs (
  blog_post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  faq_id uuid NOT NULL REFERENCES public.faqs(id) ON DELETE CASCADE,
  -- Reihenfolge innerhalb des Beitrags. Unabhaengig von faqs.sort_order,
  -- weil dieselbe Frage in einem anderen Beitrag anders einsortiert sein darf.
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blog_post_id, faq_id)
);

ALTER TABLE public.blog_faqs ENABLE ROW LEVEL SECURITY;

-- Die Verknuepfung selbst ist unkritisch: sie enthaelt nur zwei IDs. Ob
-- der Beitrag bzw. das FAQ dahinter sichtbar ist, entscheiden weiterhin
-- die Policies der beiden Haupttabellen beim Join.
CREATE POLICY "Jeder darf FAQ-Zuordnungen lesen"
  ON public.blog_faqs FOR SELECT TO anon
  USING (true);

CREATE POLICY "Angemeldete Nutzer duerfen FAQ-Zuordnungen lesen"
  ON public.blog_faqs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins duerfen FAQ-Zuordnungen anlegen"
  ON public.blog_faqs FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Admins duerfen FAQ-Zuordnungen bearbeiten"
  ON public.blog_faqs FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE POLICY "Admins duerfen FAQ-Zuordnungen loeschen"
  ON public.blog_faqs FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

-- Der Primaerschluessel deckt Abfragen nach blog_post_id bereits ab; fuer
-- die Gegenrichtung (welche Beitraege nutzen dieses FAQ?) braucht es einen
-- eigenen Index, sonst wird beim Loeschen eines FAQ sequenziell gescannt.
CREATE INDEX blog_faqs_faq_id_idx ON public.blog_faqs (faq_id);

-- ---------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------

GRANT SELECT ON public.faqs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faqs TO authenticated;
GRANT ALL ON public.faqs TO service_role;

GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;

GRANT SELECT ON public.blog_faqs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_faqs TO authenticated;
GRANT ALL ON public.blog_faqs TO service_role;

-- ---------------------------------------------------------------------
-- Speicherort fuer Beitragsbilder
-- ---------------------------------------------------------------------
--
-- Oeffentlicher Bucket, weil die Bilder im Artikel und als og:image von
-- Google, Facebook und Instagram ohne Anmeldung abrufbar sein muessen.
-- Geschrieben wird weiterhin nur von Admins.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-images',
  'blog-images',
  true,
  8388608, -- 8 MB je Bild
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

CREATE POLICY "Admins duerfen Beitragsbilder hochladen"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'blog-images'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

CREATE POLICY "Admins duerfen Beitragsbilder ersetzen"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'blog-images'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  )
  WITH CHECK (
    bucket_id = 'blog-images'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

CREATE POLICY "Admins duerfen Beitragsbilder loeschen"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'blog-images'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );
