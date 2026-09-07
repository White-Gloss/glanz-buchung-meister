# Buchungen, Benachrichtigungen und Betrieb

Stand dieser Umsetzung: Der neue Code ist lokal geprüft. Die neuen
Datenbankmigrationen, der Node-Runner und Timer sowie die Anbindung des neuen
Webhooks wurden in diesem Auftrag nicht produktiv aktiviert. Das vorhandene
Meta-Konto bleibt bestehen; ein echter Nachrichtenversand wurde nicht geprüft.

## Verbindlicher Ablauf

Eine Anfrage wird mit `neu` (Wartet auf Bestätigung) gespeichert. Das Formular
erhält sofort die Vorgangsnummer. Der Nachrichtenversand beginnt nach dem Commit
im Hintergrund; der minütliche Timer übernimmt offene Arbeiten nach Neustarts.
Eine Providerstörung löscht keine Buchung.

Nur das angemeldete Inhaberkonto kann `confirmBooking` auslösen. Der Server prüft
zuerst die Berechtigung; aktuelle Version, Datum und Abgabeplatz prüft er
anschließend innerhalb einer Transaktion. Ein Datenbanktrigger verweigert Bestätigungen ohne diesen expliziten
Bestätigungskontext. KI-Befehle, Webhooks, Timer und öffentliche Formulare können
keine Termine bestätigen. Der alte öffentliche PIN-Befehlseingang `/api/operator`
ist deaktiviert; Meta-Zustellmeldungen haben einen eigenen signierten Endpunkt.

Der Inhaber wird über die feste `OWNER_USER_ID` identifiziert, sofern gesetzt.
Andernfalls muss seine verifizierte Login-E-Mail exakt `OWNER_EMAIL` entsprechen
(bestehender Standard: öffentliche Betriebsadresse). Allgemeiner Betriebszugang
über Domain, Adminliste oder Providerliste erteilt kein Bestätigungsrecht.
`OWNER_USER_ID` bezeichnet eine vorhandene interne Better-Auth-Benutzer-ID und
verleiht diesem Benutzer auch Betriebszugang. Keine Zugangsdaten in Git ablegen.

Die Uhrzeiten sind auf ausdrückliche Vorgabe des Inhabers **Abgabezeiten**.
Die Bearbeitung wird persönlich geplant. Die vorhandenen Grenzen bleiben:
höchstens zwei reservierte Abgaben pro Tag, kein identischer bestätigter
Abgabeplatz und bei Keramik ein exklusiver Abgabetag. Als erledigt oder nicht
erschienen markierte Vorgänge behalten ihre Tagesreservierung. Offene Anfragen können
denselben Wunsch nennen; erst die persönliche Freigabe reserviert Kapazität.
Aus der geschätzten Leistungsdauer entsteht kein automatischer Abschluss.

Datum, Abgabezeit, Paket, Fahrzeugklasse oder Extras eines bestätigten Vorgangs
zu ändern, setzt ihn auf `neu` zurück und gibt die bisherige Reservierung frei.
Er muss erneut persönlich bestätigt werden. Reine Kontakt-/Notizänderungen
erhalten den Status. Alte ausstehende Erinnerungen werden bei Änderungen
ungültig. Eine Ablehnung oder Stornierung ist endgültig für diesen Vorgang;
eine neue Anfrage erhält einen neuen Vorgang. Historie, Akteur und Version
bleiben nachvollziehbar.

Der vorhandene Qonto-Ablauf bleibt an die bewusst ausgelöste Aktion „Als erledigt
markieren“ gebunden. Das System kann die tatsächliche Fahrzeugfertigstellung
nicht aus einem Kalenderdatum ableiten. Der bestehende manuelle Rechnungsversand
und dessen Fehleranzeige bleiben erhalten; es gibt keinen neuen automatischen
Qonto-Retry, der nach einer ungewissen Antwort eine Doppelrechnung riskieren würde.
Der Kalenderexport enthält bestätigte Abgabezeiten ohne erfundene Bearbeitungsdauer.
Ein externer Kalenderdienst wird nicht automatisch verbunden.

## Idempotenz und Versand

Das Formular bewahrt eine zufällige Anfrage-ID für Wiederholungen. Gespeichert
werden nur deren Hash und ein Inhaltsfingerabdruck. Gleiche ID und gleicher
Inhalt liefern denselben Vorgang; anderer Inhalt mit derselben ID wird abgewiesen.
Im Browser liegt nur die ID, kein Kundendatensatz. Versionsprüfungen verhindern
das Überschreiben zwischenzeitlicher Änderungen im Adminbereich.

Buchung, Kundenabgleich, Audit und Versandaufträge werden gemeinsam gespeichert.
Die vorhandene `outbound_queue` trägt eindeutige Ereignisschlüssel und atomare
Arbeitsreservierungen. Mehrere Worker beanspruchen unterschiedliche Nachrichten.
Providerzugriffe erfolgen außerhalb der Buchungstransaktion, mit Zeitgrenzen.

Resend erhält einen stabilen Idempotenzschlüssel. Automatische Wiederholungen
sind auf sechs Versuche und ein konservatives Fenster von 23 Stunden ab dem
ersten Versuch begrenzt. Temporäre Fehler nutzen zunehmende Wartezeiten.
Für den verwendeten Meta-Send-Endpunkt wird keine allgemeine
Idempotenzgarantie vorausgesetzt: Eine ungewisse Antwort oder abgelaufene WhatsApp-Versandreservierung kommt
in `review`, statt blind erneut gesendet zu werden. Signierte Zustellmeldungen
können den Zustand auflösen. Das ist keine Behauptung einer universellen
Genau-einmal-Zustellung. Bei `blocked`, `failed` oder `review` wird ein
deduplizierter Inhaberhinweis vorgemerkt: WhatsApp-Probleme per E-Mail,
E-Mail-Probleme per WhatsApp, sofern konfiguriert, sonst per E-Mail.
Fehlermeldungen erzeugen keine Alarm-Endlosschleife. Die tatsächliche Zustellung
des Hinweises setzt einen funktionierenden Versandkanal voraus.

`queued` wartet auf Versand/Backoff, `processing` ist reserviert, `sent` wurde
vom Provider angenommen. WhatsApp-Zustellung und Lesen werden getrennt
gespeichert. `blocked` benötigt Konfiguration, bei `failed` enden automatische Wiederholungen,
`review` benötigt eine Prüfung beim Provider, `cancelled` ist überholt.
Später eintreffende signierte `delivered`- oder `read`-Meldungen können auch einen
WhatsApp-Ausgang mit `failed` noch als zugestellt kennzeichnen.
Die Automatisierungsseite zeigt Konfigurationslücken und Zustellprobleme.
Nach Korrektur der Serverkonfiguration und Neustart des Hauptdiensts werden
wegen fehlender E-Mail-/WhatsApp-Konfiguration blockierte Aufträge beim nächsten
Workerlauf wieder freigegeben. „Versandliste jetzt prüfen“ auf der
Automatisierungsseite startet denselben Worker; `review` und `failed` werden
dadurch nicht blind erneut gesendet.

WhatsApp verwendet die vorhandene Meta Cloud API und eine passende genehmigte
Vorlage. Den vollständigen Variablen- und Vorlagenvertrag beschreibt
[whatsapp-setup.md](whatsapp-setup.md). `.env.example` enthält ausschließlich
leere Konfigurationsfelder. Keine realen Tokens im Chat oder im Repository.

## Einmalige Einrichtung auf IONOS

Diese Schritte wurden nicht auf dem Produktivserver ausgeführt. Zuerst den
tatsächlich verwendeten `DATABASE_URL` und `_migrations` lesend prüfen und eine
aktuelle Sicherung der richtigen Anwendungsdatenbank bestätigen. Das ältere
UUID-Schema im verbundenen Supabase-Projekt ist nicht das Integer-Schema dieser
Anwendung und darf diese Migrationen nicht erhalten. Dass E-Mails und Qonto zuvor
funktioniert haben, ist vom Inhaber bestätigt; daraus folgt keine Kenntnis der
konkreten heutigen Datenbankverbindung.

Die neuen Migrationen `0007_booking_workflow.sql`,
`0008_notification_delivery.sql` und `0009_whatsapp_receipts.sql` ergänzen den
vorhandenen Root-Migrationspfad. Der separate Migrator wendet jede Datei atomar
an. Bestehende Terminüberschneidungen lassen die Kapazitätsmigration scheitern,
statt Daten zu löschen oder eigenmächtig zu stornieren. Diese Vorgänge müssen
vorher anhand des tatsächlichen Betriebs geprüft werden. Historische
Bestätigungen bekommen keinen erfundenen Bestätiger oder Zeitpunkt.

Alte Ausgänge ohne Ereignisschlüssel mit Status `queued` oder `failed` werden
in `review` übernommen; ihr ursprünglicher Status bleibt in `legacy_status`
erhalten. Die erste Aktivierung versendet keine
historische WhatsApp-Warteschlange unkontrolliert.

Im bekannten IONOS-Betrieb werden Secrets über `/etc/white-gloss/environment`
geladen. Zusätzlich zur bestehenden Datenbank/Auth/Resend/Storage-Konfiguration
sind Meta-Konfiguration und `REMINDER_CRON_SECRET` mit mindestens 32 Zeichen
erforderlich. Die Anwendung muss lokal unter Port 3000 erreichbar sein.

Vor der erstmaligen `0007` ist ein Schreibwartungsfenster erforderlich. Alte
Bestätigungsaufrufe sind nach dieser Migration nicht mehr kompatibel.
Automatische Deployments zunächst über `IONOS_DEPLOY_ENABLED=false` pausieren,
bereits laufende Aktivierungen beenden lassen und alte Buchungs-/Erinnerungsjobs
sowie den Hauptdienst kontrolliert anhalten. Nach Ende der Schreibzugriffe die
richtige Datenbank konsistent sichern. Den neuen root-eigenen Deployment-Helfer
vor der Migration installieren; bestehende Secrets und Hauptdienst-Units bleiben
erhalten. Die genaue Reihenfolge steht im
[Deployment-Wartungsfenster](deployment.md#erstmaliges-wartungsfenster-für-migration-0007).

Dann die Root-Migrationen mit `npm run db:migrate` im geschützten Kontext der
bestätigten Anwendungsdatenbank ausführen, `npm run check:release` bestehen lassen
und den neuen Anwendungsrelease gemäß [deployment.md](deployment.md) aktivieren.
Der Neustart des Hauptdiensts übernimmt die neue Serverkonfiguration. Den Timer
erst für diesen neuen Stand aktivieren.

Der neue Helfer akzeptiert ausschließlich Releases mit dem vom erfolgreichen
Build erzeugten `.output/booking-workflow.contract`. Ohne gesunden kompatiblen
Rückfall stoppt ein fehlgeschlagener lokaler Start den Dienst. Ein explizites
Rollback auf Altcode wird ohne Änderung des aktuellen Diensts abgewiesen.
Die Wartung bleibt bei einer fehlgeschlagenen Wiederherstellung bestehen,
bis ein geprüfter kompatibler Stand läuft. Keine automatische Rückmigration
oder Datenlöschung erfolgt; einen Marker niemals in Altcode nachtragen.

Der automatische Anwendungsdeploy überträgt ausschließlich `.output/`.
Deshalb den Runner und die Units separat aus dem freigegebenen Quellstand
installieren; sie liegen nicht im Release-Artefakt. `/usr/bin/node` muss Node 24
bereitstellen. Nach Prüfung von Datenbank, Sicherung, Migrationen und
Release-Checks werden der Hilfsaufruf und der Timer einmalig installiert:

```sh
sudo install -d -m 0755 /usr/local/lib/white-gloss
sudo install -m 0755 ops/run-notifications.mjs /usr/local/lib/white-gloss/run-notifications.mjs
sudo install -m 0644 ops/white-gloss-reminder.service /etc/systemd/system/white-gloss-reminder.service
sudo install -m 0644 ops/white-gloss-reminder.timer /etc/systemd/system/white-gloss-reminder.timer
sudo systemctl daemon-reload
sudo systemctl enable --now white-gloss-reminder.timer
sudo systemctl start white-gloss-reminder.service
sudo systemctl status white-gloss-reminder.timer --no-pager
sudo journalctl -u white-gloss-reminder.service -n 30 --no-pager
```

Der Hilfsaufruf liest das Geheimnis ausschließlich aus der Umgebung und ruft die
feste Loopback-Adresse auf. Der HTTP-Aufruf ist auf 55 Sekunden begrenzt; die Unit hat
ein Zeitlimit von 70 Sekunden. Das Journal enthält nur feste Statusmeldungen
und begrenzte numerische Zähler. Der regelmäßige Job bestätigt keine Termine.
Meta-Webhook und Vorlage müssen zum vorhandenen Konto passen. Erst danach wird
eine ausdrücklich freigegebene eigene Testanfrage durch den echten Betrieb
verfolgt: Anfrage → Inhaberhinweis → persönliche Freigabe → Kundenmail →
Zustellstatus. Lokale Tests verwenden ausschließlich isolierte Daten und
abgefangene Providerzugriffe.
