-- =====================================================================
-- Der Vorgabewert der Statusspalte war ein Wort, das es nicht mehr gibt
-- =====================================================================
--
-- `20260807230000_booking_workflow.sql` hat die Statusbezeichnungen
-- umbenannt: bestehende Zeilen von 'Angefragt' auf 'Wartend auf Prüfung'
-- gehoben, die Prüfbedingung auf das neue Vokabular gesetzt und die
-- Einfügefunktion angepasst. Nur der DEFAULT der Spalte blieb stehen.
--
-- Damit widersprach die Spalte sich selbst: Ihr Vorgabewert war ein Wert,
-- den ihre eigene Prüfbedingung verbietet. Jede Einfügung ohne
-- ausdrücklichen Status scheiterte mit
-- „violates check constraint bookings_status_check".
--
-- WIE SCHLIMM: Heute nicht schlimm. Buchungen entstehen ausschließlich über
-- `create_booking_public`, und die setzt den Status ausdrücklich. Es ist
-- eine Falle, kein Ausfall — sie schnappt zu bei einem Datenimport, einer
-- Reparatur von Hand in der Oberfläche oder dem nächsten Codepfad, der sich
-- auf die Vorgabe verlässt. Gefunden beim Aufbau der Datenbank aus den
-- Migrationen; im Lesen des Codes war es nicht zu sehen, weil dort niemand
-- die Vorgabe benutzt.
--
-- 'Wartend auf Prüfung' ist der richtige Ersatz: genau dorthin hebt die
-- Umbenennungsmigration die alten 'Angefragt'-Zeilen, und genau den setzt
-- die Einfügefunktion.

ALTER TABLE public.bookings
  ALTER COLUMN status SET DEFAULT 'Wartend auf Prüfung';

COMMENT ON COLUMN public.bookings.status IS
  'Arbeitsstand der Buchung. Erlaubte Werte siehe bookings_status_check; der Vorgabewert muss einer davon sein.';
