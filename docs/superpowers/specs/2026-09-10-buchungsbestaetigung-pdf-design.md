# Design: PDF bei manueller Buchungsbestätigung

Datum: 2026-09-10  
Repo: White-Gloss/glanz-buchung-meister  
Status: freigegeben (Ansatz A)

## Problem

Bei neuer Buchungsanfrage (`booking.created`) erhalten Kunde und Inhaber per E-Mail eine White-Gloss-PDF (`createBookingRequestPdf`) mit unverbindlichem Preis und Wunschtermin.

Bei manueller Terminbestätigung (`booking.confirmed`) geht die E-Mail ohne PDF. Der Kunde hat damit kein dokumentiertes Belegstück mit verbindlichem Termin und Preis.

## Ziel

Bei manueller Zusage dieselbe Versandkette nutzen (Kunde + Inhaber, E-Mail, Snapshot in `outbound_queue.attachments`), aber mit einer **eigenen Bestätigungs-PDF**: gleiches Layout, verbindlicher Preis und Termin, ausdrücklich keine Rechnung.

## Entscheidungen

| Thema | Entscheidung |
| --- | --- |
| Empfänger | Kunde und Inhaber (wie Anfrage) |
| Technik | Ansatz A: eigene `createBookingConfirmationPdf` |
| Rechtlich | Verbindliche Bestätigung; **keine** Rechnung, **keine** Zahlungsaufforderung |
| Rechnung | Weiter manuell in Odoo |
| Kanäle | Nur E-Mail-Anhang (kein WhatsApp-PDF) |

## Verhalten

### Trigger

- Nur `event === "booking.confirmed"` (manuelle Bestätigung im Betriebsbereich).
- Anhang an Owner-E-Mail und Kunden-E-Mail, analog zu `booking.created`.
- WhatsApp/Telegram unverändert ohne PDF.

### PDF-Inhalt (`createBookingConfirmationPdf`)

Gleiches White-Gloss-Layout wie die Anfrage-PDF (Logo, dunkle Tabellenkopfzeile, kompakter Footer):

- Dokumenttitel: `Buchungsbestätigung WG-{id}`
- Dateiname: `White-Gloss-Bestaetigung-WG-{id}.pdf`
- Felder: Kunde, Telefon, E-Mail, Vorgangsnummer, **bestätigter Termin** (Datum + Slot), Leistungen/Extras/Fahrzeugklasse, Gesamtpreis
- Preiszeile: **„Verbindlicher Gesamtpreis“** (nicht „Unverbindlicher Gesamtpreis“)
- Hinweisblock (sinngemäß):
  - VERBINDLICHE TERMINBESTÄTIGUNG
  - Termin und Preis sind verbindlich vereinbart
  - Dieses Dokument ist keine Rechnung und keine Zahlungsaufforderung
  - Rechnung / Zahlung erfolgt gesondert (Odoo)
- Keine Formulierungen „Wunschtermin“, „noch offen“, „unverbindlich“, „nach Prüfung“

### Mailtext

Bei `booking.confirmed` Kundenmail um Hinweis ergänzen, dass die verbindliche Bestätigung im PDF-Anhang liegt (statt Anfrage-Formulierung).

### Persistenz

PDF-Bytes unveränderlich in `outbound_queue.attachments` speichern (wie Anfrage), damit Retries denselben Anhang senden.

## Nicht in v1

- PDF-Upload nach Odoo
- Qonto / Lexware
- WhatsApp-Anhang
- Automatischer Neuversand bei späterer Terminänderung (Reschedule setzt Status zurück auf „wartet“; erst die nächste manuelle Bestätigung erzeugt wieder eine Confirmation-PDF)
- Umdeutung der PDF zur Rechnung

## Tests

- PDF-Titel und sichtbarer Text enthalten „Buchungsbestätigung“ / „verbindlich“; keine „unverbindlich“-Labels
- `booking.confirmed` queued Owner- und Kunden-E-Mail mit identischem PDF-Anhang und korrektem Dateinamen
- `booking.created` unverändert mit Anfrage-PDF
- Nicht-E-Mail-Kanäle ohne Attachments

## Erfolgskriterium

Nach Deploy: manuelle Bestätigung einer Testbuchung → Versandliste zeigt Bestätigungs-Mails; Kunde und Inhaber erhalten PDF mit verbindlichem Preis und Termin, ohne Rechnungsanspruch.
