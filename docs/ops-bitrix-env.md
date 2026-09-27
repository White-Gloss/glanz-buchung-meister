# Direkte Bitrix24-Anbindung der Website

Maßgeblicher Auftrag vom 25.09.2026: Das bestehende öffentliche Buchungsformular bleibt
erhalten. Sein eigener Server überträgt direkt in das native Bitrix24-CRM. VibeCode,
eine zusätzliche Werkstatt-App und andere CRM-Dienste sind nicht Bestandteil des Betriebs.

## Serverkonfiguration

In der geschützten Datei /etc/white-gloss/environment:

```text
BOOKING_OPERATIONS=bitrix
BITRIX_WEBHOOK_URL=<bestehender eingehender Webhook des eigenen Portals>
```

Die URL niemals im Repository, Browsercode, Chat oder Protokoll veröffentlichen.
Der vorhandene White-Gloss-Webhook (Integration 24) konnte am 25.09.2026 die CRM-Felder
und den Kalender direkt lesen. Es wurden keine Rechte geändert und keine neuen Zugänge angelegt.
Die Website benötigt CRM und Kalender; eine neue oder erweiterte Berechtigung ist nicht Teil dieses Code-Deployments.

Alternativ kann der Inhaber die REST-URL unter /admin/bitrix speichern. Die Serverumgebung
hat Vorrang. Der bisherige Datenbankspaltenname vibe_api_key bleibt zur Datenerhaltung bestehen;
VibeCode-Schlüssel werden abgewiesen. Auch die alte Umgebungsvariable VIBE_API_KEY wird nur
akzeptiert, wenn ihr Wert tatsächlich eine native Bitrix24-REST-URL ist. VIBE_API_BASE und
das frühere Release-Overlay werden nicht mehr verwendet.

## Übertragungsverhalten

- Kontaktabgleich zuerst anhand der E-Mail; bei vorhandener E-Mail kein Rückfall auf eine
  gemeinsam genutzte Telefonnummer. Mehrdeutige Treffer benötigen Prüfung.
- Ein Kontakt und ein verknüpfter Auftrag mit Website-Referenz WG-…; Paket, Extras,
  Fahrzeugklasse, Fahrzeug, Ort/Abholung, Wunschtermin, Hinweis und Richtpreis bleiben erhalten.
- Die Erstübertragung hält Auftrag und Produktpositionen in der technischen Warteschlange
  fest. Unpassende Preis-/Positionssummen werden zur Prüfung angehalten.
- Nach der Übergabe bestimmt Bitrix24 die fachlichen Werte. Wiederholungen und nachgereichte
  Fotos überschreiben keine Preise, Positionen, Phasen, Rechnungen oder Termine.
- Neue Fotos und Videos werden über crm.item.update ergänzt; vorhandene Bitrix-Datei-IDs bleiben erhalten.
  Bei unklarer Schreibantwort bleibt der Vorgang zur Prüfung stehen. Für bereits übertragene
  Altfotos ohne Dateizuordnung ist vor Ergänzung eine Zuordnung nötig.
- Die Kundenstatusseite liest den zugeordneten nativen Auftrag nach Prüfung des Kundentokens.
  Bei Ausfall wird keine alte lokale Bestätigung als aktuell ausgegeben.
- Öffentliche Verfügbarkeit liest ausschließlich den nativen Kalender (Nutzer 1, Kalender 2).
  Altdaten aus lokalen Zeitblöcken überstimmen keine Bitrix-Änderung. Fehler sperren die Anzeige
  freier Termine; ungeklärte Serienregeln werden nicht als freie Zeit interpretiert.
- Die Website versendet weiterhin die Eingangsbestätigung. Spätere Bestätigungen, Signaturen,
  Rechnungen und Erinnerungen gehören in den nativen Bitrix-Ablauf und sind separat abzunehmen.
  Alte lokale Kundenbestätigungen/Rechnungen werden nicht aus einer veralteten Queue versendet.

## Veröffentlichung und Rückweg

Migration 0021 ergänzt nur das technische Übertragungsjournal. Bestehende Daten und Belege
werden weder gelöscht noch automatisch aus einem anderen CRM migriert. Alte Website-CRM-
Oberflächen führen zur Verbindungskonfiguration; alte Schreibendpunkte antworten mit 410.
Die separat betriebenen Supabase-Endpunkte müssen ebenfalls mit ihren 410-Fassungen ausgerollt werden.

Vor der freigegebenen Umschaltung: offene RO-Aufträge fachlich zuordnen, wartende Jobs klären,
REST-Zugang auf dem Website-Server prüfen, Kalender aktivieren, Daten sichern und die Migration
auf PostgreSQL prüfen. Anschließend einen freigegebenen Testauftrag vollständig nachweisen.
Das Umschalt-Skript ist standardmäßig lesend; --apply benötigt die Live-Freigabe.
Ein Rollback braucht das vorherige Release und dessen Umgebung, weil dieser Stand keine alten Adapter enthält.

Die Prüfmatrix und offenen Punkte stehen in docs/bitrix-direct-audit-2026-09-21.md.
