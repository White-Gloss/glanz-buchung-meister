# Zoho als Betriebssystem

Stand: implementiert im Code, **nicht live verbunden**. Es gibt in dieser Umgebung
keinen Zoho-OAuth-Zugang. CRM-Deals, Kalenderereignisse und Books-Rechnungen
werden erst erzeugt, wenn Client-ID, Secret, Refresh-Token und die
Books-Organisations-ID gesetzt sind.

## Führende Systeme

| Aufgabe | System |
| --- | --- |
| Anfrage, Prüfung, Reservierung | Website-Postgres (eine Shop-Sperre) |
| Operative Vorgänge | Zoho CRM: Contacts, Deals, Events, Attachments |
| Rechnung und Zahlung | Zoho Books Deutschland |
| Kundenmail Anfrage/Bestätigung | vorhandene `outbound_queue` / Resend, bis Zoho Mail angebunden ist |
| DATEV | Export in der Zoho-Books-Oberfläche, nicht über eine von uns erfundene API |

Zoho Bookings wird nicht genutzt: der Ablauf ist Anfrage zuerst, nicht Sofortbuchung.

## Ablauf

1. Website speichert `neu` / `anfrage_eingegangen`. Fotos vor oder mit Absenden.
2. Eingangsmail ohne PDF, ohne Rechnung.
3. Inhaber prüft Fotos, setzt Preis und Bearbeitungsintervall, bestätigt.
4. Erst nach erfolgreicher Reservierung: Buchungsbestätigung-PDF („Keine Rechnung“).
5. Kalendereintrag lautet `White Gloss · Werkstatt belegt` ohne Kundennamen.
6. Rechnung nur nach explizitem „Dienstleistung abgeschlossen“ mit Bar (Betrag+Datum)
   oder Überweisung 7 Tage. Bestehende Rechnungen werden nicht gelöscht oder neu erzeugt.

Preissteigerung oder Terminabweichung gegenüber Wunsch/Schätzung verlangt die
dokumentierte Kundenannahme. Ohne sie bleibt der Vorgang `kundenrueckmeldung`
und die Werkstatt ungesperrt.

## Steuer und DATEV – ehrlich

- `site.vatId` ist leer. Es wird keine USt-IdNr. erfunden.
- Im Code steht 19 % MwSt. als deutscher Regelsatz. Die echte `tax_id` kommt aus
  Zoho Books (`/books/v3/settings/taxes`). Fehlt der 19-%-Satz, geht der Job auf
  `review` statt eine Steuer-ID zu erfinden.
- IBAN/Bankkonto stehen nicht im Repository. Überweisungsrechnungen nutzen die
  Zahlungsdaten der Books-Organisation.
- DATEV-Export ist in Zoho Books Deutschland eine Produktfunktion der Oberfläche.
  Es gibt keine von uns geprüfte, dokumentierte Public-API, die DATEV-Dateien
  erzeugt. Ob DATEV in eurem Mandanten aktiv und GoBD-tauglich ist, muss in
  Zoho Books selbst geprüft werden.

## Kontrollierter Wechsel

`ZOHO_OPS_ENABLED=true` oder `shop_settings.zoho_ops_enabled`:

- neue Odoo-/RO-App-/Lexware-Jobs entfallen
- Lexware-Rechnungsabgleich läuft nicht mehr
- Leistungsabschluss im alten Admin ohne Zahlungsvariante wird verweigert

Bis dahin bleiben die alten Automatiken. Historische Rechnungen bleiben unberührt.

## Webhook

`POST /api/zoho-webhook` mit Bearer- oder Query-Token `ZOHO_WEBHOOK_SECRET`
(mindestens 24 Zeichen). Payload-Beispiel:

```json
{
  "action": "confirm",
  "reference": "WG-12",
  "actor": "<OWNER_USER_ID>",
  "confirm": {
    "startDate": "2026-11-02",
    "startTime": "09:00",
    "durationMinutes": 180,
    "agreedCents": 14900,
    "customerAccepted": false
  }
}
```

`complete` braucht `"payment": "bar"|"ueberweisung"` und bei Bar `cashCents` plus `cashDate`.

Ohne gesetztes Secret bleibt der Endpunkt zu. Ein CRM-Button in eurem Zoho-Mandanten
kann hier erst eingerichtet werden, wenn OAuth und Secret vorliegen.
