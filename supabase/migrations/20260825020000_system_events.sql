-- =====================================================================
-- Störungsprotokoll: Ereignisse, die der Betrieb sehen muss
-- =====================================================================
--
-- Bisher landeten Störungen ausschließlich im Prozessprotokoll des Servers.
-- Wer keinen SSH-Zugang hat, erfuhr von einem fehlgeschlagenen Mailversand
-- erst durch die Rückfrage der Kundschaft. Diese Tabelle hält dieselben
-- Zeilen fest, die `src/lib/serverLog.ts` ohnehin schreibt, damit sie im
-- Adminbereich sichtbar sind.
--
-- KEINE PERSONENBEZOGENEN DATEN. Die schreibende Stelle redigiert Adressen,
-- Telefonnummern und Schlüssel, bevor etwas hier ankommt. Die Rechnungsnummer
-- bleibt als Zuordnung erhalten.

CREATE TABLE IF NOT EXISTS public.system_events (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  -- Grobe Einordnung, z. B. 'mail', 'erpnext', 'automation-cron'.
  area text NOT NULL,
  -- Was passiert ist, in einem Satzfragment.
  event text NOT NULL,
  -- 'fehler' verlangt Aufmerksamkeit, 'hinweis' nicht.
  severity text NOT NULL DEFAULT 'fehler',
  -- Bereits redigierte Zusatzangaben und Fehlerbeschreibung.
  context text,
  error text,
  CONSTRAINT system_events_severity_check CHECK (severity IN ('fehler', 'hinweis'))
);

-- Die Ansicht zeigt immer die jüngsten Einträge zuerst.
CREATE INDEX IF NOT EXISTS system_events_occurred_at_idx
  ON public.system_events (occurred_at DESC);

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

-- Lesen ausschließlich für Administratoren. Geschrieben wird über den
-- direkten Datenbankzugang des Anwendungsservers, nicht über die
-- öffentliche REST-Schnittstelle.
DROP POLICY IF EXISTS "Admins duerfen Stoerungen lesen" ON public.system_events;
CREATE POLICY "Admins duerfen Stoerungen lesen"
  ON public.system_events
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

GRANT SELECT ON public.system_events TO authenticated;
GRANT ALL ON public.system_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.system_events_id_seq TO service_role;

-- Aufbewahrung: Ein Störungsprotokoll ist eine Betriebshilfe, kein Archiv.
-- Einträge älter als 90 Tage werden beim Schreiben gelegentlich mit
-- abgeräumt (siehe serverLog.ts) — so bleibt die Tabelle ohne zusätzlichen
-- Zeitplandienst klein.
COMMENT ON TABLE public.system_events IS
  'Redigiertes Störungsprotokoll für den Adminbereich. Aufbewahrung 90 Tage.';
