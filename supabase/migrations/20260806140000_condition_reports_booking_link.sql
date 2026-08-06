-- =====================================================================
-- Zustandsmeldungen aus dem Buchungsassistenten
-- =====================================================================
--
-- Der Fahrzeugzustand wird jetzt direkt im Buchungsablauf abgefragt -
-- als letzter Schritt vor den Kontaktdaten. Die Meldung entsteht dann
-- gemeinsam mit einer Buchung und soll ihr zugeordnet bleiben, damit im
-- Admin-Bereich sofort sichtbar ist, zu welchem Termin die Fotos gehoeren.

ALTER TABLE public.condition_reports
  ADD COLUMN booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;

-- Fuer die Rueckrichtung: welche Meldung gehoert zu dieser Buchung?
CREATE INDEX condition_reports_booking_id_idx
  ON public.condition_reports (booking_id)
  WHERE booking_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Beschreibungstext wird optional, sobald Fotos dabei sind
-- ---------------------------------------------------------------------
--
-- Auf der eigenstaendigen Seite /fahrzeug-zustand ist die Beschreibung
-- der Kern der Anfrage und bleibt Pflicht. Im Buchungsablauf dagegen hat
-- der Kunde Fahrzeug, Paket und Termin bereits ausgewaehlt - dort waere
-- ein Pflichttext eine unnoetige Huerde kurz vor dem Abschluss. Wer nur
-- vier Fotos anhaengt, soll das duerfen.
--
-- Voellig leer darf eine Meldung aber weiterhin nicht sein: Entweder
-- Text ODER mindestens ein Foto muss vorhanden sein.

ALTER TABLE public.condition_reports
  DROP CONSTRAINT condition_reports_text_not_blank;

ALTER TABLE public.condition_reports
  ADD CONSTRAINT condition_reports_text_or_photo
  CHECK (
    length(btrim(condition_text)) > 0
    OR coalesce(array_length(photo_paths, 1), 0) > 0
  );
