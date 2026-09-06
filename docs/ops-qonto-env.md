# Qonto-Umgebung (VPS)

Qonto ist die verbindliche Quelle fuer ausgehende Kundenrechnungen. Lokal speichern wir nur Mapping/Status.

## Variablen in /etc/white-gloss/environment

Werte mit Leerzeichen immer quoten. Niemals Secrets committen.

Required:
QONTO_LOGIN
QONTO_SECRET_KEY
QONTO_IBAN

Optional:
QONTO_API_BASE (default https://thirdparty.qonto.com/v2, no trailing slash)
QONTO_STAGING_TOKEN (sandbox only)

Auth header format: login:secret (no Bearer, no base64).

## Scopes
client.read, client.write, client_invoice.read / client_invoices.read, client_invoice.write

## Deploy-Check
1. Env speichern und quoten
2. systemctl restart white-gloss.service
3. Rebuild so migration 0006_qonto_invoice.sql runs
4. Booking auf erledigt -> Qonto finalize
5. Admin Unterlagen: Per E-Mail senden
6. Logs ohne Secrets

## Nicht tun
- Secrets committen
- ERPNext Finanzbelege
- Auto-Mail ohne Admin-Klick

Example:
QONTO_LOGIN="org-login"
QONTO_SECRET_KEY="org-secret"
QONTO_IBAN="DE00..."
