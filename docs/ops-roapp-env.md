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

## Übertragung nach RO: Schalter, Hinweise, Diagnose

- Zusätzlich zu `BOOKING_OPERATIONS=roapp` muss die Übertragung eingeschaltet sein (`shop_settings.roapp_sync_enabled`, Standard: aus). Der Inhaber schaltet sie im Betriebspanel unter „Übertragung nach RO“ ein oder hält sie an. Einschalten ist nur mit vollständigen Zugangsdaten möglich. Wartende Anfragen werden danach automatisch übertragen.
- Angehalten (Inhaberpause): Anfragen bleiben auf der Website vorgemerkt und werden nach dem Einschalten übertragen. Es gibt dann keinen zusätzlichen RO-Hinweis; die normale Website-Mail „Neue Buchungsanfrage“ geht weiter an den Inhaber. Wartet eine Anfrage dagegen länger als zehn Minuten, weil Zugangsdaten fehlen oder ungültig sind, geht einmalig ein Hinweis an buchung@white-gloss.de. Dasselbe gilt für jede Anfrage, die RO ablehnt („Prüfung erforderlich“). Die Mail enthält nur WG-Nummer und Fehlercode.
- Schreibjournal: Jeder Schreibvorgang nach RO wird vorher vermerkt. Lehnt RO ihn eindeutig ab (HTTP 4xx außer 408/429) oder wurde er nie gesendet (Kontoprüfung, Zeitbudget, Ratenlimit), wird der Vermerk gelöscht und der echte Grund gespeichert, z. B. `roapp_request_failed:422 POST /orders|Felder: branch_id`. Nach der Korrektur genügt „Erneut übertragen“. Nur bei unklarem Ausgang (Zeitüberschreitung, Serverfehler, verlorene Antwort) bleibt der Schritt gesperrt (`roapp_write_needs_reconciliation POST /orders|roapp_unreachable`). Dann in RO nachsehen: Fehlt der Auftrag, „In RO geprüft – neu übertragen“ wählen. Bereits erledigte Schritte (Kontakt, Auftrag, Positionen) werden dabei nicht wiederholt.
- Diagnose ohne Datenbankzugang: Der read-only Inspect-Job („Deploy to IONOS VPS“ per workflow_dispatch) fragt `http://127.0.0.1:3000/api/ro-diagnostics?probe=1` auf dem Server ab und gibt `roapp_diagnostics=` aus. Der Endpunkt antwortet nur auf direkte Loopback-Anfragen ohne Proxy-Header (sonst 404). Er liefert ausschließlich Summen: Betriebsart, Schalter, Konfigurationsstatus (fehlende Variablennamen, nicht zugeordnete Katalogpositionen), Anzahlen je Status und Fehlercode (ohne RO-Detailtext), offene Schreibschritte (`openWrites`), Stunden seit dem letzten Ereignis und das Ergebnis eines lesenden `GET /company`. Das Actions-Log ist öffentlich; deshalb erscheinen dort keine WG-Nummern, Zeitpunkte oder Kundendaten.

## Rechnungsautomatik (standardmäßig aus)

Ohne `ROAPP_INVOICE_ENABLED=true` bleibt alles wie bisher: keine Tabellenänderung, keine Rechnung, kein Versand. Wird die Automatik später auf `false` gesetzt (Notstopp), entstehen keine neuen Rechnungen und keine Rechnungsmails mehr; ausgestellte Rechnungen bleiben im Betriebspanel sichtbar, Zahlungen erfassbar und Quittungen zustellbar. Die Release-Prüfung (`/`-Gate) verlangt diese Werte nicht; eine unvollständige Rechnungskonfiguration legt die Website nicht lahm, sondern stoppt nur die Rechnungserstellung und meldet das einmalig an buchung@white-gloss.de.

- ROAPP_INVOICE_ENABLED=true
- ROAPP_INVOICE_FROM: Aktivierungszeitpunkt mit Zeitzone. Nur Aufträge, deren Termin nach diesem Zeitpunkt „Termin verbindlich“ bestätigt wurde, erhalten eine Website-Rechnung (Nachweis, dass der Abschluss danach lag). Früher bestätigte Aufträge werden manuell abgerechnet.
- ROAPP_INVOICE_DELAY_MINUTES: Wartezeit nach „Erledigt“ (0–1440, Standard 15) für versehentliche Statuswechsel.
- ROAPP_INVOICE_BANK_HOLDER, ROAPP_INVOICE_BANK_NAME, ROAPP_INVOICE_IBAN (Prüfziffer wird geprüft), ROAPP_INVOICE_BIC.
- ROAPP_INVOICE_TAX_NUMBER: optional. Die USt-IdNr. DE465024196 steht bereits auf jeder Rechnung; § 14 UStG verlangt nur eine der beiden Angaben.

Schema: `migrations/0023_roapp_invoices.sql` ist rein additiv und wird von der Anwendung beim ersten Rechnungslauf identisch angelegt (`ensureRoInvoiceSchema`). Die Datei ist deshalb – wie 0015–0018 – nicht Teil des Release-Gates; GitHub-CI kann die IONOS-Datenbank nicht migrieren. Die Anwendung trägt 0023 dabei in `_migrations` ein, damit Inventur und `db:migrate` übereinstimmen. Ein Rollback auf einen älteren Release ist schemakompatibel: ältere Stände ignorieren die zusätzlichen Tabellen, und die CRM-Konfiguration bleibt RO.

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
