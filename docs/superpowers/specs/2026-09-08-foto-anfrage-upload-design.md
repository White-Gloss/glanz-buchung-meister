# Foto-Anfrage Upload Design

- Status: Approved (2026-09-08)
- Repo: White-Gloss/glanz-buchung-meister
- Owner: Lars Hägele / White Gloss

## Ziel

Auf den öffentlichen Seiten **Fahrzeug-Zustand** und **Dellen/Hagelschaden** sollen Kunden bei der Foto-Anfrage **echte Dateien** hochladen können. Die Fotos landen in Supabase Storage und sind im Admin **im Posteingang** sowie auf einer **eigenen Übersicht** sichtbar.

Heute werden nur Dateinamen übermittelt („Dateien bleiben auf dem Gerät“). Das ändert sich.

## Genehmigte Entscheidungen

| Thema | Entscheidung |
| --- | --- |
| Ort öffentlich | Foto-Anfrage vor der Buchung (Zustand / Dellen), nicht Buchungskonfigurator |
| Speicher | Supabase Storage (wie Buchungsfotos, Bucket `condition-photos`) |
| Admin | Beides: Thumbs im Posteingang **und** eigene Übersicht `/admin/foto-anfragen` |
| Architektur | Ansatz A: Inbox-Nachricht + verknüpfte `photo_inquiry_photos` |
| Limits | max. 8 Dateien, ~12 MB, gleiche MIME-Policy wie Buchungsfotos |
| Out of Scope | Upload im Buchungskonfigurator; WhatsApp-Versand der Fotos |

## Ablauf

1. Kunde öffnet `/fahrzeug-zustand` oder `/dellen-hagelschaden`, füllt `PhotoInquiry` aus und wählt Dateien.
2. Client liest Dateien als Base64 (gleiches Muster wie `BookingPhotoUpload` / `attachBookingPhotos`).
3. Server `createPublicPhotoInquiry`:
   - Validierung (Name, Telefon, Privacy, Dateien, Rate-Limit, Honeypot)
   - optional: Kunde upserten
   - `inbox_messages`-Zeile anlegen (Kanal `zustand` bzw. `dellen`)
   - Dateien nach Magic-Bytes prüfen, in Storage legen unter `photo-inquiries/{inboxMessageId}/{uuid}.{ext}`
   - Metadaten in `photo_inquiry_photos` speichern
4. Bei teilweisem Storage-Fehler: bereits geschriebene Objekte/Zeilen aufräumen (analog Booking-Fotos-Cleanup).
5. Erfolg → bestehende Erfolgs-UI; Hinweis „nur Dateinamen“ entfernen.

## Datenmodell (v1)

Neue Tabelle `photo_inquiry_photos`:

- `id serial primary key`
- `shop_id text not null default 'white-gloss'`
- `inbox_message_id integer not null references inbox_messages(id) on delete cascade`
- `storage_path text not null`
- `mime text not null`
- `size_bytes integer not null`
- `original_name text not null`
- `created_at timestamptz not null default now()`

Index: `(shop_id, inbox_message_id, created_at desc)`.

Migration als nächste freie Nummer unter `migrations/` (aktuell bis `0009_…`; Nummerierung mit bestehendem Konflikt `0006_*` abstimmen — neue Datei z. B. `0010_photo_inquiry_photos.sql`).

Kein Upload-Capability-Token nötig: ein Submit = eine Anfrage.

`inbox_messages.body` kann weiterhin Kurztext + Dateinamen enthalten; die Autorität für die Dateien ist die neue Tabelle + Storage.

## Server / Storage

- Wiederverwenden: Magic-Sniff, MIME-Allowlist, Größenlimits aus `booking-photos` / `upload-policy`.
- Bucket: `condition-photos` (bereits für Buchungsfotos); Prefix `photo-inquiries/` trennt klar von `bookings/…`.
- Signed URLs oder Admin-Proxy zum Anzeigen/Downloaden (nie öffentlichen Bucket).
- Service-Role nur serverseitig (`SUPABASE_SERVICE_ROLE_KEY`).

## UI öffentlich

- `src/components/photo-inquiry.tsx`: echte Uploads; Copy „kein Datei-Upload / nur Dateinamen“ entfernen.
- Routen `fahrzeug-zustand.tsx` / `dellen-hagelschaden.tsx`: Hint-Text anpassen.
- Validierung: mindestens sinnvolles Medium **oder** Beschreibung (bestehende Regel beibehalten, aber bei Dateien Inhalt prüfen).

## UI Admin

1. **Posteingang** (`channel-inbox` / `admin.posteingang`): bei Nachrichten mit Fotos Vorschaubilder (Thumbs) und Download-Links.
2. **Neue Seite** `/admin/foto-anfragen`: Liste Foto-Anfragen (Datum, Kanal, Name, Telefon, Kurztext, Anzahl Fotos) + Galerie/Lightbox pro Eintrag. Navigation im Admin-Chrome ergänzen.

## Fehlerbehandlung

- Ungültige MIME / zu groß → 400 mit klarer Meldung, keine Inbox-Zeile.
- Storage-Fehler nach Inbox-Insert → Cleanup Storage + Photo-Rows; Anfrage fehlgeschlagen melden (oder Inbox ohne Fotos markieren — **v1: lieber Fail + Cleanup**, kein „halbe Anfrage ohne Bilder“).
- Logs ohne Dateiinhalte und ohne Service-Role-Key.

## Out of Scope (v1)

- Foto-Upload im Buchungskonfigurator vor Absenden
- WhatsApp-Versand / Auto-Mail der Fotos an den Kunden
- Verknüpfung Foto-Anfrage → spätere Buchung (`booking_id`)
- Neue Storage-Buckets (wir nutzen `condition-photos`)

## Erfolgskriterien

1. Zustand/Dellen: gewählte Fotos liegen nach Submit in Storage und in `photo_inquiry_photos`.
2. Posteingang zeigt Thumbs zur zugehörigen Inbox-Nachricht.
3. `/admin/foto-anfragen` listet Anfragen mit Galerie.
4. Keine „nur Dateinamen“-Copy mehr auf den öffentlichen Formularen.
5. Unit-/Handler-Tests für Validierung, Persistenz und Cleanup bei Fehler.