-- =====================================================================
-- Zustandsmeldungen: Kunde schickt Fotos und Beschreibung vor der Buchung
-- =====================================================================
--
-- Ablauf: Ein Interessent laedt auf /fahrzeug-zustand Fotos seines Autos
-- hoch und beschreibt den Zustand. Im Admin-Bereich sind die Meldungen
-- danach einsehbar, um vorab eine belastbare Einschaetzung zu geben.
--
-- ZUGRIFFSWEG (wichtig fuer das Verstaendnis der Policies):
-- Diese Tabelle wird ausschliesslich ueber Server-Functions gelesen und
-- geschrieben, die - wie schon bei den Buchungen - ueber die direkte
-- PostgreSQL-Verbindung (DATABASE_URL, siehe src/lib/db.server.ts)
-- arbeiten. Dieser Weg umgeht RLS.
--
-- Deshalb bekommt die Tabelle bewusst KEINE Policies: RLS ist aktiv und
-- ohne Policy verweigert PostgREST jeden Zugriff. Damit sind die Daten
-- ueber die oeffentliche REST-Schnittstelle nicht erreichbar - weder
-- lesend noch schreibend. Das ist hier besonders wichtig, weil die
-- Meldungen Kontaktdaten und Fahrzeugfotos enthalten.

CREATE TABLE public.condition_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Kontaktdaten, damit auf die Meldung geantwortet werden kann.
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL DEFAULT '',

  -- Fahrzeugangaben. Das Kennzeichen ist freiwillig - es ist ein
  -- personenbezogenes Datum und fuer die Einschaetzung nicht noetig.
  vehicle text NOT NULL DEFAULT '',
  plate text NOT NULL DEFAULT '',

  -- Die eigentliche Zustandsbeschreibung des Kunden.
  condition_text text NOT NULL,

  -- Pfade der hochgeladenen Fotos im privaten Bucket "condition-photos".
  -- Als Array statt eigener Tabelle: die Fotos gehoeren untrennbar zur
  -- Meldung, werden immer gemeinsam angezeigt und nie einzeln verknuepft.
  photo_paths text[] NOT NULL DEFAULT '{}',

  -- Bearbeitungsstand im Admin-Bereich.
  status text NOT NULL DEFAULT 'Neu',
  admin_note text NOT NULL DEFAULT '',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.condition_reports
  ADD CONSTRAINT condition_reports_name_not_blank
    CHECK (length(btrim(customer_name)) > 0),
  ADD CONSTRAINT condition_reports_text_not_blank
    CHECK (length(btrim(condition_text)) > 0),
  -- Einfache Formpruefung, damit keine offensichtlich unbrauchbare
  -- Adresse gespeichert wird. Die inhaltliche Pruefung passiert im Code.
  ADD CONSTRAINT condition_reports_email_shape
    CHECK (customer_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  ADD CONSTRAINT condition_reports_status_valid
    CHECK (status IN ('Neu', 'Gesehen', 'Beantwortet', 'Erledigt')),
  -- Obergrenze auch auf Datenbankebene, damit ein manipulierter Aufruf
  -- die Liste nicht mit hunderten Pfaden fuellen kann.
  ADD CONSTRAINT condition_reports_photo_limit
    CHECK (coalesce(array_length(photo_paths, 1), 0) <= 8);

ALTER TABLE public.condition_reports ENABLE ROW LEVEL SECURITY;

-- Bewusst keine Policies (siehe Kopfkommentar). Zusaetzlich werden die
-- Rechte fuer anon und authenticated entzogen, damit auch eine spaeter
-- versehentlich hinzugefuegte Policy nicht sofort Zugriff gewaehrt.
REVOKE ALL ON public.condition_reports FROM anon, authenticated;
GRANT ALL ON public.condition_reports TO service_role;

CREATE TRIGGER condition_reports_set_updated_at
  BEFORE UPDATE ON public.condition_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Die Admin-Liste zeigt neueste zuerst und filtert haeufig nach Status.
CREATE INDEX condition_reports_created_at_idx
  ON public.condition_reports (created_at DESC);
CREATE INDEX condition_reports_status_idx
  ON public.condition_reports (status);

-- ---------------------------------------------------------------------
-- Speicherort fuer die Fahrzeugfotos
-- ---------------------------------------------------------------------
--
-- PRIVATER Bucket - anders als bei Galerie und Ratgeberbildern. Die Fotos
-- zeigen fremde Fahrzeuge, moeglicherweise mit Kennzeichen, und gehen
-- niemanden ausser den Betrieb etwas an. Der Admin-Bereich zeigt sie
-- ueber kurzlebige signierte Links an.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'condition-photos',
  'condition-photos',
  false, -- nicht oeffentlich abrufbar
  8388608, -- 8 MB je Bild
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Hochladen muss ohne Anmeldung moeglich sein, weil Interessenten keinen
-- Zugang haben. Die Server-Function prueft vorher Dateityp, Groesse und
-- Dateisignatur; Supabase erzwingt zusaetzlich Groesse und MIME-Typ am
-- Bucket. Weil der Bucket privat ist, laesst sich damit kein oeffentlich
-- abrufbarer Speicher missbrauchen.
CREATE POLICY "Interessenten duerfen Zustandsfotos hochladen"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'condition-photos');

-- Lesen und Loeschen ausschliesslich fuer Admins. Das Anzeigen im
-- Admin-Bereich laeuft ueber signierte Links, die diese Policy voraussetzen.
CREATE POLICY "Admins duerfen Zustandsfotos ansehen"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'condition-photos'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

CREATE POLICY "Admins duerfen Zustandsfotos loeschen"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'condition-photos'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );
