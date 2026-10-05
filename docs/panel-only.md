# Ausschließlich White-Gloss-Panel

Betreiberauftrag vom 5. Oktober 2026: RO App und Bitrix ausschalten; das vorhandene Panel ist das einzige operative System. Bestehende Daten und historische Belege bleiben erhalten.

## Verhalten des vorbereiteten Releases

- `BOOKING_OPERATIONS=panel` unterbindet beide CRM-Queues, Transfers, API-Proben, Rückmeldungen und externe Kalenderabfragen. Vorhandene Zugangsdaten aktivieren keinen Provider im Panel-Modus.
- Website-Anfragen speichern weiter Kontakt, Fahrzeug, Paket, Extras, Abholung, Preisrahmen und Fotos im vorhandenen Bestand. Der bestehende geschützte Hub bleibt für die Übernahme ins Panel erhalten.
- Die Website sammelt Datum und Uhrzeit als Wünsche. Die Oberfläche erklärt, dass erst Terminwahl und Kundenunterschrift im persönlichen Panel-Angebot verbindlich werden. Eine leere externe Kalenderantwort beweist keine freie Werkstatt.
- Auftragsänderungen, manuelles Anlegen, Preis-/Terminfreigabe, Stornierung und Abschluss sind im alten Website-Betriebsweg gesperrt. Der vorhandene Website-CMS-Zugang bleibt verfügbar.
- Alte RO-/Bitrix-Mails und operative Website-Nachrichten werden mit `panel_only` zurückgehalten. Die Einträge bleiben erhalten. Neue Anfragen dürfen weiter ihre bestehende Eingangsbenachrichtigung versenden; die operative Korrespondenz kommt aus dem Panel.
- RO-Rechnungsversand, Zahlungsänderungen und wiederholte Rechnungsfreigaben sind ausgeschaltet. Es entstehen keine neuen Rechnungen aus dem ausgeschalteten Weg.
- Die produktive Bereitschaftsprüfung akzeptiert den expliziten Panel-Modus weiterhin nur mit der vorhandenen Datenbank, Authentifizierung, Fotoablage und Mailkonfiguration.

Die Adapter bleiben als historische Implementierungen erhalten. Sie können nur durch einen ausdrücklichen Wechsel der geschützten Serverkonfiguration wieder aktiv werden. Standard ohne Konfiguration ist `panel`; produktives Hosting verlangt dennoch eine explizite geprüfte Konfiguration.

## Veröffentlichung über den vorhandenen IONOS-Weg

Ein neuer Code-Stand allein schaltet einen bereits mit `BOOKING_OPERATIONS=roapp` gestarteten Prozess nicht um. Aktuell gemessener Produktionsstand vor Veröffentlichung: Release `8e900aa082fa2f502290a85a6036fcc9a0b3a95a`, Backend `roapp`, Sync aktiviert.

1. Root-Zugang über die bestehende IONOS-Serververwaltung verwenden. Aktiven Website-Release und Timerzustände erneut prüfen. Keine sudo-Berechtigung erweitern und den Website-Deploymenthelfer nicht für das Panel verwenden.
2. Die vorhandenen Website- und Panel-Sicherungen ausführen und überprüfen. Die Serverkonfiguration als root-private Kopie sichern. Den Website-Automationstimer `white-gloss-reminder.timer` und den zugehörigen Lauf für die Umstellung anhalten.
3. Mit `scripts/stage-panel-environment.mjs --source=/etc/white-gloss/environment --output=<neue-root-private-Datei>` eine getrennte Konfiguration vorbereiten. Das Skript ersetzt ausschließlich `BOOKING_OPERATIONS`; es aktiviert nichts, gibt keine Geheimnisse aus und überschreibt keine vorhandene Datei. Die unveränderte Quelle und alle übrigen Einstellungen werden geprüft.
4. Das geprüfte Website-Archiv mit dem bestehenden `/usr/local/sbin/white-gloss-deploy activate` unter Angabe des erwarteten bisherigen Releases und der Archivprüfsumme aktivieren. Der Helper kann keine Umgebungsvariablen ändern. Beide Schritte müssen deshalb durch den bestehenden Serveradministrator zusammen ausgeführt werden.
5. Erst nach bestätigter Aktivierung dieses Panel-fähigen Releases die vorbereitete Konfiguration atomar übernehmen und `white-gloss.service` neu starten. Bei fehlgeschlagener Gesundheitsprüfung die gesicherte Konfiguration wiederherstellen; Automation bis zur Prüfung angehalten lassen.
6. Tatsächlich laufenden Prozess mit der vorhandenen redigierten Prüfung kontrollieren. Direkte serverseitige Diagnose muss `backend: panel, disabled: true` zeigen; `/api/availability` muss `requestOnly: true` liefern. Die Diagnose bleibt öffentlich verborgen.
7. Hub und Panel aus dem persönlich angemeldeten Panel heraus prüfen. Keine echte Kundenanfrage, Nachricht oder Datei als Test erzeugen. Alle vorhandenen Protokoll-, Kundenlink-/PIN-, Foto- und Mailwege müssen im Panel erhalten bleiben.
8. Den Website-Timer erst nach diesen Nachweisen wieder starten. Der Lauf verarbeitet dann die erlaubten Eingangsbenachrichtigungen und Foto-Aufräumarbeiten; beide CRM-Wege bleiben gesperrt.

Die gesonderte ChatGPT-Erweiterung des Panels liegt auf dem veröffentlichten Terminwahl-Stand und enthält keine unveröffentlichten Lexware-Änderungen. Sie wird ausschließlich mit dem bestehenden Panel-Installer aktiviert und anschließend persönlich über OAuth verbunden.

## Nachweise

Neue Prüfungen verhindern Providerzugriff auch mit injiziertem SQL/API-Zugriff, prüfen den vorhandenen Anfragenbestand für beide ausgeschalteten Queues, Sperren operativer Änderungen, zurückgehaltene Alt-Mails und unveränderte private Konfigurationsdateien. Historische Provider-Tests setzen ihren alten Modus ausdrücklich, damit deren Regressionen weiterhin geprüft werden. Lokale Website-Server bleiben verboten.

Build, PR oder erfolgreiche CI belegen noch keine produktive Abschaltung. Erst aktiver Release, laufender Prozess im Panel-Modus und Prüfung des bestehenden Hub-/Panel-Wegs belegen die Umsetzung auf IONOS.
