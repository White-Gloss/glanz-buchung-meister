-- =====================================================================
-- Lebenszeichen der Automationsläufe
-- =====================================================================
--
-- Der Adminbereich konnte bisher nur anzeigen, ob `REMINDER_CRON_SECRET`
-- hinterlegt ist. Das sagt aus, dass die Tür ein Schloss hat — nicht, dass
-- jemand hindurchgeht. Ob der Zeitgeber den Endpunkt tatsächlich anstößt,
-- war ohne SSH-Zugang nicht festzustellen.
--
-- WARUM NICHT IN `system_events`
-- Dort landet jede Zeile einzeln, und die Ansicht zeigt die jüngsten 100.
-- Ein stündliches Lebenszeichen wären 24 Zeilen am Tag; nach vier Tagen
-- bestünde das Störungsprotokoll fast nur noch aus „alles in Ordnung" und
-- verdeckte genau die Fehler, für die es da ist.
--
-- Deshalb eine Zeile je Bereich, die überschrieben wird. Die Tabelle wächst
-- nicht, und die Frage „wann lief das zuletzt?" ist eine einzige Abfrage.

CREATE TABLE IF NOT EXISTS public.automation_heartbeat (
  -- Ein Bereich, eine Zeile. Derzeit nur 'automation-cron'.
  area text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  -- Kurzfassung des Ergebnisses, z. B. 'kandidaten=3 versendet=3'.
  -- Ausschließlich Zähler, nichts Personenbezogenes.
  detail text
);

ALTER TABLE public.automation_heartbeat ENABLE ROW LEVEL SECURITY;

-- Lesen ausschließlich für Administratoren. Geschrieben wird über den
-- direkten Datenbankzugang des Anwendungsservers, nicht über die
-- öffentliche REST-Schnittstelle.
DROP POLICY IF EXISTS "Admins duerfen Lebenszeichen lesen" ON public.automation_heartbeat;
CREATE POLICY "Admins duerfen Lebenszeichen lesen"
  ON public.automation_heartbeat
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

GRANT SELECT ON public.automation_heartbeat TO authenticated;
GRANT ALL ON public.automation_heartbeat TO service_role;

COMMENT ON TABLE public.automation_heartbeat IS
  'Eine Zeile je Automationsbereich mit dem Zeitpunkt des letzten Laufs. Waechst nicht.';
