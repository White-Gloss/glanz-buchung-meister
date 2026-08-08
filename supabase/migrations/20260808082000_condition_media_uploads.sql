-- Fahrzeugzustand: Fotos UND kurze Videos im bestehenden privaten Bucket.
-- Große Handyaufnahmen werden im Browser vor dem Upload verkleinert; der
-- Storage akzeptiert deshalb maximal 12 MB pro bereits optimierter Datei.

update storage.buckets
set file_size_limit = 12582912,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/quicktime'
    ]::text[]
where id = 'condition-photos';
