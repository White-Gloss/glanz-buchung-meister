# Design: Website-Buchung → RO App Push

Datum: 2026-09-10  
Repo: White-Gloss/glanz-buchung-meister  
Status: freigegeben (Ansatz A, „alles“)

## Ziel

Auf white-gloss.de bleibt die Buchungsmaske. Nach erfolgreicher lokaler Speicherung werden Kontakt, Termin (Booking) und Auftrag (Order) in **RO App** (`roapp.io`, API `https://api.roapp.io/v2`) angelegt. RO App übernimmt den weiteren Betrieb (Bestätigung, Ablauf, Rechnung). Der bestehende **Odoo-Sync bleibt** parallel.

## Entscheidungen

| Thema | Entscheidung |
| --- | --- |
| Ansatz | A — Website speichert, Queue pusht nach RO |
| Umfang v1 | Kontakt + Booking + Order („alles“) |
| Odoo | unverändert zusätzlich |
| Browser-Redirect | nein — rein serverseitig |
| Rücksync Status/Mails | nicht in v1 |

## API (Kurz)

- Auth: `Authorization: Bearer ROAPP_API_KEY` (Settings → API)
- Basis: `https://api.roapp.io/v2`
- Relevant: `POST /contacts/people`, `POST /bookings`, `POST /bookings/{id}/items`, `POST /orders`, `POST /orders/{id}/items`
- Rate limit: 3 req/s
- Docs: https://roapp.readme.io/reference/getting-started-with-api

Einmalig aus RO zu konfigurieren (Env oder Admin-Settings): `branch_id`, `assignee_id` (Booking erfordert Zuweisung), Service-/Produkt-`entity_id`-Mapping für Pakete/Extras.

## Verhalten

### Trigger

Neue Buchung (`booking.created` / nach Insert in `bookings`), idempotent über Queue (wie Odoo-Sync: durable queue + lease + Retry).

### Sequenz (Worker)

1. **Kontakt:** Lookup Person per Telefon/E-Mail; sonst `POST /contacts/people` (`first_name`, `phones[]`, `email`). Speichere `ro_contact_id`.
2. **Booking:** `POST /bookings` mit `client_id`, `branch_id`, `assignee_id`, `scheduled_for`/`scheduled_to` aus Wunschtermin/-slot, Kommentar inkl. `WG-{id}`. Optional Positionen via booking items (Paket `entity_id`, Preis, Menge). Speichere `ro_booking_id`.
3. **Order:** `POST /orders` mit Client, Beschreibung/Kommentar `WG-{id}`, geschätzter Preis; Positionen aus Paket/Extras. Speichere `ro_order_id`.

Bei Teilfehler: bereits angelegte IDs behalten, fehlenden Schritt retryen (keine Doppel-Kontakte).

### Lokal

Migration: Spalten an `bookings` (oder Sync-Tabelle analog Odoo):

- `ro_contact_id`, `ro_booking_id`, `ro_order_id`
- `ro_sync_status` (`pending` / `synced` / `failed`)
- `ro_sync_error`, `ro_synced_at`

Admin: kurzer Status an der Buchung / Automatisierung (ähnlich Odoo), Retry-Button.

### Env

```
ROAPP_API_KEY=
ROAPP_BRANCH_ID=
ROAPP_ASSIGNEE_ID=
ROAPP_API_BASE=https://api.roapp.io/v2   # optional
```

Paket→`entity_id`-Mapping: Config/DB oder Env-JSON (in Spec-Umsetzung festlegen).

## Nicht in v1

- Status von RO zurück nach white-gloss (Webhooks möglich, später)
- Website-Mails durch RO ersetzen
- Odoo abschalten
- Öffentliche Kunden-Weiterleitung zu roapp.io
- Lead/`/inquiries` zusätzlich (Redundanz zu Booking+Order)

## Tests

- Kontakt finden vs. neu anlegen (Mock HTTP)
- Idempotenz / Retry nach Teil-Erfolg
- Booking ohne Slot → klarer Fehlerstatus, Buchung lokal bleibt
- Rate-limit 429 → Retry mit Backoff
- Odoo-Pfad unverändert

## Erfolgskriterium

Live-Testbuchung erscheint in RO App als Kontakt + Termin + Auftrag mit Bezug `WG-{id}`; lokal Mapping und Status sichtbar; Odoo-Sync weiter funktionsfähig.
