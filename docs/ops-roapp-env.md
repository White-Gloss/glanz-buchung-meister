# RO App: neues White-Gloss-Konto betreiben

Stand 29.09.2026. Kein lokales Hosting. Veröffentlichung nur über den freigegebenen IONOS-Weg (`main` → CI → „Deploy to IONOS VPS“ → Live-Smoke). Das RO-Konto ist seit 2026-09-28T22:27:15.023Z für neue Website-Anfragen aktiv.

## Erforderliche Konfiguration

- BOOKING_OPERATIONS=roapp
- ROAPP_API_KEY: neuer Schlüssel, nur serverseitig und niemals im Repository.
- ROAPP_EXPECTED_COMPANY_CREATED_AT=2026-09-28T13:56:33Z
- ROAPP_ACCOUNT_SCOPE=white-gloss-20260928
- ROAPP_CUTOVER_AT: tatsächlicher Aktivierungszeitpunkt als ISO-Zeit mit Zeitzone.
- ROAPP_BRANCH_ID=234698
- ROAPP_ASSIGNEE_ID=336589
- ROAPP_ORDER_TYPE_ID=358349
- ROAPP_REVIEW_STATUS_ID=5706133
- ROAPP_APPROVED_STATUS_ID=5706367
- ROAPP_FIRM_STATUS_ID=5706483
- ROAPP_CONFIRMED_STATUS_IDS=5706483,5706160
- ROAPP_COMPLETED_STATUS_IDS=5706130,5706131,5706151,5706152
- ROAPP_ENTITY_MAP: vollständige JSON-Zuordnung der 50 Positionen. Fehlende Zuordnung stoppt die Übertragung.
- ROAPP_WEBHOOK_SECRET: geschützter Wert, mindestens 20 Zeichen.
- ROAPP_LIFECYCLE_MAIL_ENABLED=true (Erinnerung und Bewertung; aktiviert).

API-Basis ist ausschließlich https://api.roapp.io/v2. API-Schlüssel, Webhook-Secret und Bankdaten liegen nur im geschützten Server-Environment bzw. im DPAPI-Deployment-Profil des Betreibers außerhalb des Repositories.

## Rechnungsautomatik (standardmäßig aus)

Ohne `ROAPP_INVOICE_ENABLED=true` bleibt alles wie bisher: keine Tabellenänderung, keine Rechnung, kein Versand. Die Release-Prüfung (`/`-Gate) verlangt diese Werte nicht; eine unvollständige Rechnungskonfiguration legt die Website nicht lahm, sondern stoppt nur die Rechnungserstellung und meldet das einmalig an buchung@white-gloss.de.

- ROAPP_INVOICE_ENABLED=true
- ROAPP_INVOICE_FROM: Aktivierungszeitpunkt mit Zeitzone. Nur Aufträge, die danach „Erledigt“ werden, erhalten eine Website-Rechnung.
- ROAPP_INVOICE_DELAY_MINUTES: Wartezeit nach „Erledigt“ (0–1440, Standard 15) für versehentliche Statuswechsel.
- ROAPP_INVOICE_BANK_HOLDER, ROAPP_INVOICE_BANK_NAME, ROAPP_INVOICE_IBAN (Prüfziffer wird geprüft), ROAPP_INVOICE_BIC.
- ROAPP_INVOICE_TAX_NUMBER: optional. Die USt-IdNr. DE465024196 steht bereits auf jeder Rechnung; § 14 UStG verlangt nur eine der beiden Angaben.

Schema: `migrations/0023_roapp_invoices.sql` ist rein additiv und wird von der Anwendung beim ersten Rechnungslauf identisch angelegt (`ensureRoInvoiceSchema`). Die Datei ist deshalb – wie 0015–0018 – nicht Teil des Release-Gates; GitHub-CI kann die IONOS-Datenbank nicht migrieren. Ein Rollback auf einen älteren Release ist schemakompatibel: ältere Stände ignorieren die zusätzlichen Tabellen, und die CRM-Konfiguration bleibt RO.

Aktivierung:

1. Datensicherung wie gewohnt; aktiven Release und Dienstzustand prüfen.
2. Werte im geschützten Server-Environment ergänzen, Dienst über den vorhandenen Helfer neu starten.
3. Im Betriebspanel (`/admin/bitrix` → „Rechnungen und Zahlungen“) prüfen, dass keine Konfigurationsprobleme angezeigt werden.
4. Ab `ROAPP_INVOICE_FROM` in RO keine Rechnungen mehr anlegen. Zahlungen ausschließlich im Betriebspanel nach tatsächlichem Eingang erfassen.

## Rechnungssteller in RO und Handelsregister

Mit der Website-Rechnung ist ein RO-Rechnungssteller (juristische Person) nicht erforderlich. Im früheren RO-Konto (Prüfung vom 19.09.2026) waren Rechnungen auch ohne hinterlegte juristische Person möglich; im neuen Konto ist das nicht erneut geprüft und wird mit der Website-Rechnung nicht benötigt. Der RO-Entwurf bleibt ungespeichert. Für ein nicht eingetragenes Einzelunternehmen gibt es keine Handelsregisternummer; sie ist keine Pflichtangabe nach § 14 UStG. Die Steuernummer wird nie als Registernummer verwendet. Nur falls künftig doch RO-native Rechnungen gewünscht sind und RO das Feld erzwingt: Registereintrag bzw. „nicht eingetragen“ beim Inhaber erfragen.

## Eigener Absender für native RO-Angebotsmails

Offen. RO versendet Angebots-/Auftragsmails derzeit über den RO App Gateway. Die Einrichtung eines Firmenabsenders erfolgt im RO-Konto (E-Mail-Einstellungen) und erfordert die von RO vorgegebenen DNS-Einträge für white-gloss.de bei IONOS. Danach eine Testnachricht ausschließlich an eine eigene Adresse senden. Website-Mails (Erinnerung, Bewertung, Rechnung, Quittung) verwenden bereits buchung@white-gloss.de über die verifizierte Versanddomain.

## Prüfungen ohne Kundenaktionen

Website, Statusroute, geschützte Fotos, Kalender, authentifizierter Cron und Webhook-Signaturprüfung. Der isolierte Prozessnachweis liegt in `src/lib/roapp-process.test.ts` (eingebettete Datenbank, simulierte RO-API und simulierter Mailversand; läuft in `npm test` und im Linux-CI). Keine fremde Unterschrift oder Zahlung stellvertretend abgeben. Alte Aufträge werden nicht automatisch übernommen.

Der Webhook liest Preise und Status erneut über die API; Nutzdaten des eingehenden Webhooks setzen weder Preise noch eine Unterschrift oder Zahlung.
