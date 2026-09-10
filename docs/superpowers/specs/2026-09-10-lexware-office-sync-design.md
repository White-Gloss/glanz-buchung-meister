# Lexware Office Kontakt- und Rechnungsentwurf

Datum: 2026-09-10

## Ziel

Kundenbuchungen der Website in Lexware Office (Public API) als Kontakt anlegen und bei Status `erledigt` eine **Entwurfsrechnung** erzeugen. Freigabe und Versand bleiben manuell in Lexware.

## Nicht-Ziele

- Lexware Desktop (keine REST-API)
- `finalize=true`, E-Mail-Versand, Mahnung
- Qonto oder Odoo ersetzen
- Backfill bestehender Buchungen
- Automatisches Einschalten

## Verhalten

1. Durable Queue analog RO/Odoo (`lexware_sync_queue`), Schalter `lexware_sync_enabled` default false, nur Inhaber.
2. Jedes Workflow-Event reiht die Buchung ein; der Cron (`/api/automation-cron`) arbeitet nur bei eingeschaltetem Schalter.
3. Kontakt: GET `/v1/contacts?email=` sonst POST Person mit Rolle `customer`.
4. Rechnung nur wenn `status=erledigt` und noch keine `lex_invoice_id`: POST `/v1/invoices` ohne finalize.
5. 19 % MwSt. netto aus gespeichertem Brutto, EUR, `shippingType=service`, Vermerk `WG-{id}`.
6. Auth: `LEXWARE_API_KEY` Bearer gegen `https://api.lexware.io/v1`. 2 req/s.

## Migration

Das Schema wird beim ersten Speichern/Übertragen mit `CREATE/ALTER … IF NOT EXISTS` angelegt, damit das Release ohne neue Manifest-Migration live gehen kann.
