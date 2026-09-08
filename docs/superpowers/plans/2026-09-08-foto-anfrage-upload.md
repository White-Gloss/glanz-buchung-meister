# Foto-Anfrage Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Öffentliche Foto-Anfrage (Fahrzeug-Zustand / Dellen) lädt echte Dateien nach Supabase Storage; Admin sieht Thumbs im Posteingang und auf `/admin/foto-anfragen`.

**Architecture:** `createPublicPhotoInquiry` speichert weiterhin eine `inbox_messages`-Zeile, lädt parallel Dateien in Bucket `condition-photos` unter Prefix `photo-inquiries/{inboxMessageId}/…` und schreibt Metadaten in `photo_inquiry_photos`. Admin holt Listen + zeitlich begrenzte Signed URLs serverseitig. Wiederverwendung von Magic-Sniff, Limits und Upload-HTTP aus `booking-photos.ts`.

**Tech Stack:** TanStack Start (`createServerFn`), Postgres `migrations/`, Supabase Storage, React Admin-UI, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-08-foto-anfrage-upload-design.md` (PR #157)

## Global Constraints

- Echte Uploads nur bei Foto-Anfrage Zustand/Dellen — **kein** Upload im Buchungskonfigurator, **kein** WhatsApp-Versand der Fotos.
- Bucket: `condition-photos`; Prefix: `photo-inquiries/{inboxMessageId}/{32hex}.{ext}`.
- Limits: max. **8** Dateien, **12 MB** pro Datei, MIME wie `UPLOAD_MIME_TYPES`.
- Bei Storage-/Insert-Fehler nach Inbox-Insert: **Fail + Cleanup** (Photo-Rows + Storage-Objekte + Inbox-Zeile); keine „halbe Anfrage ohne Bilder“.
- Service-Role nur serverseitig; nie im Client-Bundle.
- UI-Copy und Fehlermeldungen auf **Deutsch**; „nur Dateinamen / bleiben auf dem Gerät“ entfernen.
- Tests: `node --experimental-strip-types --test`; neue Testfiles in `package.json` `test`-Script.
- Migration nächste freie Nummer: `migrations/0010_photo_inquiry_photos.sql` (bestehenden Doppel-`0006_*` nicht anfassen).

## File map

| File | Role |
|------|------|
| `migrations/0010_photo_inquiry_photos.sql` | Tabelle `photo_inquiry_photos` |
| `src/lib/booking-photos.ts` | Prefix-Cleanup + Signed-URL-Helfer für `photo-inquiries/` |
| `src/lib/booking-photos.test.ts` | Tests Path-Validierung / Signed-URL |
| `src/lib/photo-inquiry-upload.ts` | Orchestrierung: validate → inbox → upload → rows; Cleanup |
| `src/lib/photo-inquiry-upload.test.ts` | TDD Orchestrierung mit Stubs |
| `src/lib/bookings.functions.ts` | `createPublicPhotoInquiry` mit Base64-Dateien |
| `src/components/photo-inquiry.tsx` | Echte Base64-Uploads; Copy anpassen |
| `src/routes/fahrzeug-zustand.tsx` | Hint-Text |
| `src/routes/dellen-hagelschaden.tsx` | Hint-Text |
| `src/lib/admin.functions.ts` | Inbox-Photos; `listPhotoInquiries`; Signed URLs |
| `src/routes/admin.posteingang.tsx` | Thumbs + Download |
| `src/routes/admin.foto-anfragen.tsx` | Neue Übersicht |
| `src/lib/admin-nav.ts` | Nav-Eintrag „Foto-Anfragen“ |
| `package.json` | Test-Script erweitern |


### Task 1: Migration

Create migrations/0010_photo_inquiry_photos.sql with table photo_inquiry_photos linked to inbox_messages.

### Task 1 details
- create table photo_inquiry_photos with FK to inbox_messages
- commit migration 0010
### Task 2: storage helpers
- path helpers for photo-inquiries prefix
- signed URL helper for admin thumbs
- extend storage cleanup for inquiry paths
- TDD then commit storage helpers
### Task 3: upload orchestration
- new photo-inquiry-upload module with rollback
- empty files inbox only; with files validate upload insert
- on failure delete rows storage and inbox message
- TDD then commit orchestration
### Task 4: public form
- createPublicPhotoInquiry accepts real file payloads
- PhotoInquiry UI uploads like booking photos
- remove filename-only copy on zustand and dellen pages
- commit public upload UI
### Task 5: inbox thumbs
- listInbox attaches signed photo URLs
- admin posteingang shows thumbs under body
- commit inbox thumbs
### Task 6: admin overview page
- listPhotoInquiries for zustand and dellen channels
- new route admin/foto-anfragen with gallery cards
- add Foto-Anfragen to admin-nav after Posteingang
- commit overview page
### Task 7: verify
- run test suite and typecheck
- deploy note: migration 0010 plus existing condition-photos bucket
## Spec coverage
- upload storage table cleanup inbox overview limits copy signed URLs covered by tasks 1-7
