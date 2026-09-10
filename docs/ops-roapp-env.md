# RO App-Umgebung (VPS)

Website-Buchungen bleiben lokal. Die durable Queue legt Kontakt, Termin und Auftrag in RO App an. Odoo-Sync bleibt parallel unveraendert.

## Variablen in /etc/white-gloss/environment

Werte mit Leerzeichen immer quoten. Niemals Secrets committen.

Required:
ROAPP_API_KEY
ROAPP_BRANCH_ID
ROAPP_ASSIGNEE_ID
ROAPP_ORDER_TYPE_ID

Optional:
ROAPP_API_BASE (default https://api.roapp.io/v2, no trailing slash)
ROAPP_ENTITY_MAP (JSON: Website package/extra id -> RO entity_id)

Auth: Authorization Bearer token from RO App Settings > API.
Rate limit: 3 requests/second; client throttles and retries on HTTP 429.

## Entity-Mapping

ROAPP_ENTITY_MAP='""basis":101"'
ROAPP_ENTITY_MAP='""premium":102"'
ROAPP_ENTITY_MAP='""keramik":103"'
ROAPP_ENTITY_MAP='""felgen":201"'

Ohne Mapping werden Kontakt/Booking/Order trotzdem angelegt; Positionen entfallen fuer unbekannte Katalog-IDs. Kommentar enthaelt WG-{id}.

## Deploy-Check
1. Env speichern und quoten
2. Migration 0013_roapp_sync.sql einspielen
3. systemctl restart white-gloss.service
4. Im Admin RO-App-Uebertragung einschalten
5. Testbuchung mit Wunschtermin/-slot anlegen
6. Automation-Cron ausfuehren; in RO App WG-{id} pruefen
7. Odoo-Sync unveraendert smoke-testen

## Nicht tun
- Secrets committen
- Odoo abschalten
- Website-Mails durch RO ersetzen
- Webhooks von RO zurueck (v1 out of scope)
- Browser-Redirect zu roapp.io
