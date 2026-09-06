# Qonto-Rechnungen Design

- Status: Approved (2026-09-06)
- Repo: White-Gloss/glanz-buchung-meister
- Owner: Lars Hägele / White Gloss

## Ziel

Wenn eine Buchung auf `erledigt` gesetzt wird, entsteht in Qonto eine **finalisierte** Kundenrechnung. Der Admin kann die Rechnung mit einem Klick per E-Mail an den Kunden senden. Die lokale Datenbank speichert nur Mapping und Status — **Qonto ist die verbindliche Rechnungsquelle**.

## Genehmigte Entscheidungen

| Thema | Entscheidung |
| --- | --- |
| System | Rechnungen in Qonto erstellen (Lexware wird nicht mehr genutzt) |
| Steuer | Regelbesteuerung mit MwSt.; Default 19 % auf Leistungen, sofern Position nichts anderes vorgibt |
| Finalisieren | Automatisch nach Anlegen |
| Kunden-Mail | Erst nach manuellem Admin-Klick |
| Trigger | Buchungsstatus → `erledigt` |
| Architektur | Ansatz A schlank: Qonto = Source of Truth, lokal nur IDs/Status |

## Abgrenzung zu ADR-001

ADR-001 nannte Lexware als alleinige Finanz-/Rechnungsquelle. Das gilt für **Rechnungen nicht mehr**. ERPNext bleibt rein operativ (Kunde/Fahrzeug/Order) und darf weiterhin keine Sales Invoice / Payment Entry / GL-Buchungen erzeugen. Bank- und Rechnungsautorität für ausgehende Kundenrechnungen liegt bei Qonto.

## Ablauf

1. Admin setzt Buchung auf `erledigt` (bestehender Status-Flow).
2. Idempotenz: existiert bereits `qonto_invoice_id` → kein zweites Create.
3. Qonto-Client per Kunden-E-Mail suchen; fehlt er → anlegen (Name, E-Mail, Währung EUR).
4. Positionen aus Buchung (Paket, Add-ons, Abholung …) mit MwSt. bauen.
5. `POST /v2/client_invoices` (Draft) → `POST /v2/client_invoices/{id}/finalize`.
6. Lokal speichern: `qonto_client_id`, `qonto_invoice_id`, offizielle `invoice_number`, Status `unpaid`.
7. Admin-Button „Per E-Mail senden“ → Qonto Send (E-Mail an Kundenadresse) → lokal `sent_at` / Status vermerken.

## Datenmodell (v1)

Neue Spalten an `bookings` (einfacher als parallele `documents`-Wahrheit):

- `qonto_client_id text`
- `qonto_invoice_id text`
- `qonto_invoice_number text`
- `qonto_invoice_status text` — z. B. `pending` \| `unpaid` \| `sent` \| `failed`
- `qonto_invoice_error text` — letzte Fehlermeldung (ohne Secrets)
- `qonto_sent_at timestamptz`

Migration unter `migrations/` bzw. bestehendem SQL-Pfad des Projekts.

Bestehende `documents`-Entwürfe (`kind=rechnung`) bleiben optional sichtbar, sind aber **nicht** mehr die Steuerquelle; UI-Copy „Lexware“ entfernen.

## Konfiguration (Server only)

In `/etc/white-gloss/environment` (systemd EnvironmentFile, Werte mit Leerzeichen quoten):

- `QONTO_SECRET_KEY` — Business API Secret Key (Scope u. a. `client.read`, `client.write`, `client_invoice.read`, `client_invoice.write`)
- `QONTO_IBAN` — IBAN des Qonto-Kontos für `payment_methods` (muss zur Org gehören)
- optional Staging: `QONTO_STAGING_TOKEN` nur für Sandbox

Nie ins Repo committen. `mailConfigured`-Analog: `qontoConfigured()` prüft Key + IBAN.

## UI

`/admin/unterlagen` und ggf. Buchungsdetail:

- Lexware-Hinweis entfernen / durch Qonto ersetzen
- Anzeige: Rechnungsnummer, Status, Fehler
- Buttons: **Per E-Mail senden** (nur wenn `unpaid`/`failed`-nach-Send), **Erneut versuchen** (Create/Finalize bei `failed`)

## Fehlerbehandlung

- Qonto-API-Fehler: Buchung bleibt `erledigt`; `qonto_invoice_status=failed`; Retry ohne Doppel-Finalize wenn ID schon da
- Fehlende Kunden-E-Mail: `failed` mit klarer Meldung
- Logs: nur Statuscodes / gekürzte Responses, keine Keys

## Out of Scope (v1)

- Paid-Webhooks / Status `paid` zurückschreiben
- Angebote / Credit Notes in Qonto
- Lexware, ERPNext-Finanzbelege
- Automatischer Mailversand ohne Klick

## Erfolgskriterien

1. Einmal `erledigt` → genau eine finalisierte Qonto-Rechnung.
2. Admin-Klick sendet die Kunden-Mail über Qonto.
3. Keine Secrets im Repo; Env analog zu Resend auf dem VPS.
4. UI ohne Lexware-Behauptung; Status im Admin nachvollziehbar.
