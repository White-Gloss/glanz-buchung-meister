# RO App: neues White-Gloss-Konto aktivieren

Stand 28.09.2026. Kein lokales Hosting. Veröffentlichung nur über den freigegebenen IONOS-Weg. Der Server war während dieser Vorbereitung per SSH nicht erreichbar; diese Anleitung ist kein Nachweis einer Aktivierung.

## Erforderliche Konfiguration

- BOOKING_OPERATIONS=roapp
- ROAPP_API_KEY: neuer Schlüssel, nur serverseitig und niemals im Repository.
- ROAPP_EXPECTED_COMPANY_CREATED_AT=2026-09-28T13:56:33Z
- ROAPP_ACCOUNT_SCOPE=white-gloss-20260928
- ROAPP_CUTOVER_AT: tatsächlicher Aktivierungszeitpunkt als ISO-Zeit mit Zeitzone; nicht vorab schätzen.
- ROAPP_BRANCH_ID=234698
- ROAPP_ASSIGNEE_ID=336589
- ROAPP_ORDER_TYPE_ID=358349
- ROAPP_REVIEW_STATUS_ID=5706133
- ROAPP_APPROVED_STATUS_ID=5706367
- ROAPP_FIRM_STATUS_ID=5706483
- ROAPP_CONFIRMED_STATUS_IDS=5706483,5706160
- ROAPP_COMPLETED_STATUS_IDS=5706130,5706131,5706151,5706152
- ROAPP_ENTITY_MAP: vollständige JSON-Zuordnung der 50 Positionen. Schlüssel z.B. basis:kompakt, felgen:suv, pickup:tier_20. Fehlende Zuordnung stoppt die Übertragung.
- ROAPP_WEBHOOK_SECRET: geschützter neuer Wert, mindestens 20 Zeichen.
- ROAPP_LIFECYCLE_MAIL_ENABLED=false bis Versandweg, Datenbankmigration, Statusablauf und Empfängerprüfung verifiziert sind; danach gezielt true.

API-Basis ist ausschließlich https://api.roapp.io/v2. Der API-Schlüssel und das Webhook-Secret liegen lokal nur im für den Betreiber geschützten DPAPI-Deployment-Profil außerhalb des Repositories.

## Aktivierung

1. Backup und aktuellen Releasezustand auf IONOS prüfen.
2. Migration 0022 mit dem regulären Release anwenden. Bestehende RO-Zeilen erhalten den Scope legacy und dürfen nicht zurückgesetzt werden.
3. Neue Umgebung installieren; shop_settings.roapp_sync_enabled für white-gloss einschalten. Bitrix-Schlüssel werden im RO-Modus nicht verwendet.
4. Release nach den vorhandenen Deployment-Verträgen aktivieren und Dienstzustand prüfen.
5. Ohne Kundenaktionen prüfen: Website, Statusroute, geschützte Fotos, Kalender, authentifizierter Cron und Webhook-Signaturprüfung.
6. Isolierten Prozessnachweis für Anfrage, Fotos, Besitzerfreigabe, echte Testkundenannahme, finale Terminfreigabe, Umbuchung/Storno und Abschluss durchführen. Keine fremde Unterschrift stellvertretend abgeben.
7. Versand erst nach Prüfung des Absenders und der Warteschlange aktivieren. Frühere RO-/Bitrix-/ERP-Nachrichten bleiben gesperrt.
8. Alte Aufträge werden nicht automatisch übernommen. Einen gewünschten Altfalltransfer gesondert prüfen.

Der Webhook liest Preise und Status erneut über die API; Nutzdaten des eingehenden Webhooks setzen weder Preise noch eine Unterschrift oder Zahlung. Die Rechnungsautomatik ist noch offen; keine Buchhaltung anhand von Statusnamen simulieren.
