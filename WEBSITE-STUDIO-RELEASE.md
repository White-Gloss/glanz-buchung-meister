# Website Studio: Freigabe und Betrieb

Stand: 9. November 2026. PR #323 wurde inzwischen als `e4d5fca` gemergt; der heutige Produktionsstand ist in dieser Sitzung mangels Serverzugang nicht erneut bestätigt. Diese Anleitung beschreibt die noch nachzuweisende Einrichtung. Ein GitHub-Merge belegt weder Backup/Restore noch Migration oder Studio-Aktivierung. In diesem Reparaturpaket werden keine produktiven Buchungen, Nachrichten oder Kundendaten verändert.

Die vorausgehende Entwicklungsprüfung für `05f3066f7c86dbe5658835ef86368cb896517f27` sowie die aktuelle Recovery mit fehlgeschlagenem Lighthouse-Gate, reproduzierter Registrierungslücke und deren Branch-Korrektur sind in [docs/WHITE-GLOSS-HANDOFF.md](docs/WHITE-GLOSS-HANDOFF.md) dokumentiert. Maßgeblich für die Freigabe sind der endgültige PR-Head und seine vollständigen Checks; der frühere grüne Lauf allein genügt nicht. Die folgenden Voraussetzungen bleiben Abnahmepunkte für eine spätere Produktionseinrichtung; bestandene isolierte CI ist keine Produktionsfreigabe.

## Zuletzt gelesener Produktionsstand – 8. November 2026

Am 8. November 2026 lesend bestätigt: aktiver Release `d20a8e1`, Dienstnutzer `deploy`, Studio-Flag und `CMS_MEDIA_DIR` nicht gesetzt. Effektiv erlaubt die mit `ProtectSystem=strict` gehärtete Unit nur Schreibzugriffe auf `/srv/white-gloss-current`. Ein Medienordner außerhalb der Releases braucht deshalb zusätzlich zu 0700/0600 eine konkret genehmigte systemd-Schreibfreigabe; die Härtung nicht pauschal abschalten.

Die tatsächliche App-Datenbankrolle ist kein Superuser und hat kein BYPASSRLS; sie besitzt die Legacy-CMS-Tabelle. Registry bis 0022, keine Studio-Tabellen; 0023/0024/0025 nicht registriert. 0023/0024 sind im Release-Manifest runtime-ensured und 0025 optional. Dennoch verarbeitet `db:migrate` alle drei fehlenden Dateien; die Einrichtung ist daher kein pauschal freigegebener Einzelschritt.

`HOSTINGER_DEPLOY_ENABLED=true` ist tatsächlich gesetzt. Environment production verlangt weder Reviewer noch Wartezeit; keine Branch-/Tagbeschränkung. Der aktive main-Ruleset verlangt weder PR noch Statuschecks noch Force-Push-Schutz. Diese Einstellungen wurden nicht verändert. Konsistentes Websitebackup, isolierter Restore und der Abgleich bestehender Betreiberidentitäten bleiben offen. Vollständige Nachweise und erfolgreiche Code-CI: [Übergabe](docs/WHITE-GLOSS-HANDOFF.md).

## 1. Getrennte Freigaben

**Freigabeweg repariert, produktive Übernahme noch offen:** Die neue Fassung von `.github/workflows/deploy-hostinger.yml` entfernt den automatischen `workflow_run`-Auslöser. Auslieferung erfolgt ausschließlich manuell auf main mit vollständigem freigegebenem Commit und erwartetem bisherigen Produktionscommit, nach erfolgreicher CI. Bis diese Fassung auf main liegt, gilt der alte Automatismus weiter; bereits gestartete Jobs werden dadurch nicht beendet. Aktuelle Jobs, `HOSTINGER_DEPLOY_ENABLED` und tatsächliche Freigaberegeln des Environments `production` vor der Übernahme prüfen. Erforderliche Reviewer und verpflichtende Branchchecks sind externe Einstellungen und werden durch diese Codeänderung nicht eingerichtet.

1. **Code:** Den konkreten Commit und seine bestandenen Prüfungen freigeben; anschließend ausschließlich den bestätigten, bestehenden Veröffentlichungsweg verwenden. Aktives Hostingziel und Releasepfade vorab abgleichen: ältere Betreiberregeln und Skriptnamen nennen IONOS, während ein Hostinger-Workflow vorhanden ist. Daraus allein folgt keine Freigabe für einen Anbieterwechsel. Branch Protection und den bestehenden Buchungs-Releasevertrag beibehalten.
2. **Einrichtung:** Datenbankziel, Sicherungen, Migration `0025_website_studio.sql`, dauerhaften Bildspeicher und Konfiguration ausdrücklich freigeben. Ein genehmigtes Code-Deployment allein erlaubt diese Änderungen nicht.
3. **Aktivierung:** `WEBSITE_STUDIO_ENABLED=true` erst nach bestätigter Einrichtung und gesonderter Freigabe setzen.
4. **Inhalte:** Tatsächliche Texte, Bildrechte und Vorschau prüfen. Erst „Jetzt veröffentlichen“ macht eine gespeicherte Fassung öffentlich. Fehlende persönliche Angaben bleiben unveröffentlichte Entwürfe.

Der Code kann zunächst mit deaktiviertem Studio ausgeliefert werden. `0025_website_studio.sql` ist im Release-Manifest ausdrücklich als optionale Erweiterung geführt; unbekannte künftige Migrationen bleiben erforderlich. Die Produktions-Readiness-Prüfung und der PostgreSQL-Zugriff führen diese Studio-Migration nicht automatisch aus.

Die bisherigen CMS-Verwaltungsseiten wählen den Editor anhand der serverseitigen Freischaltung. Bei deaktiviertem Studio bleiben unveränderte, noch nicht im Studio versionierte FAQ-, Blog-, Galerie- und Zusatzleistungs-Einträge über die bestehende Bearbeitung verfügbar; Migration 0025 ist dafür nicht erforderlich. Speichern veröffentlicht dort wie bisher unmittelbar und wird ausdrücklich so beschriftet. Betreiberrechte und eine Versionsprüfung schützen die Schreibvorgänge. Bereits versionierte oder archivierte Studio-Inhalte bleiben im Legacy-Editor gesperrt, damit Abschaltung oder alte Browserfenster keine Fassungen umgehen. Deren weitere Bearbeitung benötigt die kontrollierte Reaktivierung des Studios.

## 2. Vor der Einrichtung prüfen

| Bereich | Voraussetzung und Nachweis |
| --- | --- |
| Datenbank | Tatsächliches produktives PostgreSQL-Ziel und Schema bestätigen. Keine neue Datenbank und kein PGlite-Ersatz für den Betrieb. `_migrations` und die noch ausstehenden Dateien vorab nur lesen. |
| Sicherung | Konsistente Datenbanksicherung einschließlich `cms_items`, Authentifizierung und Buchungsdaten; später zusätzlich `cms_revisions` und `cms_media`. Sicherungszeitpunkt, Aufbewahrung, Zugriffsschutz und Wiederherstellungsweg dokumentieren. Wiederherstellung in einer getrennten Umgebung nachweisen. |
| Bildspeicher | Separates, dauerhaftes Verzeichnis, das weder Releasewechsel noch Bereinigung alter Releases löschen. Sicherung der WebP-Dateien zusammen mit der zugehörigen Datenbank planen. |
| Zugriff | Öffentliche Passwortregistrierung muss serverseitig gesperrt sein. Bestehende Betreiberkonten und Sitzungen lesend gegen freigegebene Identitäten abgleichen; die Sperre neuer Registrierungen bereinigt keine vorhandenen Konten. Bestehende Betreiber-Anmeldung mit gültiger Sitzung prüfen. Nichtbetreiber und abgelaufene Sitzungen müssen weiter abgewiesen werden. `OPERATOR_ENFORCE=0` und produktive Entwicklungsanmeldung sind unzulässig. |
| Laufzeit | Vorhandene Node-/Sharp-Abhängigkeiten und das gebaute Artefakt prüfen. Keine neue Bibliothek oder Systeminstallation allein wegen dieser Anleitung. |
| Rückweg | Aktuellen und letzten kompatiblen Release-Commit notieren. Beim späteren Wechsel den tatsächlich erwarteten aktuellen Commit und die geprüfte Artefakt-Prüfsumme verwenden. |

Keine Produktionsgeheimnisse in Repository, Tickets, Screenshots oder Protokolle übernehmen. Die vorhandene Panel-, Buchungs-, Preis-, E-Mail- und Storage-Konfiguration nicht aus `.env.example` überschreiben; die Vorlage enthält auch historische Integrationsbeispiele.

### Sicherung und Wiederherstellung tatsächlich belegen

Das bestehende `scripts/backup-production.mjs` erstellt einen konsistenten PostgreSQL-Dump, schützt ihn vor Überschreiben und gibt Prüfsumme und Archivlesbarkeit aus. Sein `archiveListValid: true` bedeutet nur, dass `pg_restore --list` funktioniert hat. Das Skript sichert keine Studio-Dateien und führt keinen Restore aus.

Vor Einrichtung oder Aktivierung werden deshalb diese zusammengehörigen Nachweise benötigt:

1. Tatsächlichen DB-Host, Datenbanknamen, Schema, Toolversion und Sicherungsziel im geschützten Serverkontext bestätigen. Dump, Prüfsumme, Zeitpunkt und Servercommit festhalten; keine Zugangsdaten oder Inhalte in die Übergabe kopieren.
2. Bereits vorhandene Studio-Dateien einschließlich Prüfsummen und Dateirechten gemeinsam mit dem DB-Stand sichern. Dazu ein abgestimmtes Snapshotverfahren oder eine bestätigte Schreibpause verwenden; voneinander unabhängige Kopien bei laufenden Änderungen sind kein Konsistenznachweis. Falls noch kein Studio-Bestand existiert, das ausdrücklich lesend bestätigen.
3. Das Backup in ein **vorher bestätigtes separates, leeres Restoreziel** wiederherstellen. Niemals die produktive `DATABASE_URL` verwenden, kein `--clean` gegen Produktion und keine Website, Timer, Mail- oder Buchungsworker im Restoreziel starten. `pg_restore --exit-on-error --single-transaction` muss erfolgreich enden; erforderliche Eigentümer/Rollen vorab separat abbilden.
4. Registry, Schema, Constraints/Sequenzen und tabellenweise Bestandszahlen sowie bei vorhandenen Medien sämtliche DB-Dateiverweise und Prüfsummen am wiederhergestellten Stand vergleichen. Ergebnis, Zielidentität, Backup-Prüfsumme und Zeitpunkt dokumentieren. Erst dieser Durchlauf belegt Wiederherstellbarkeit.

Der Betreiberabgleich muss alle gemäß aktueller Betreiberregel berechtigten Konten und aktiven Sitzungen umfassen. Die reine OWNER-Zusammenfassung in `inspect-production.mjs` ist dafür nicht vollständig. Keine Kennwörter oder Sitzungstokens ausgeben; keine unbekannten Konten automatisch löschen oder Sitzungen widerrufen. Die freigegebenen Identitäten und ein funktionierender vorhandener Zugang müssen tatsächlich bestätigt werden.

## 3. Konfiguration und Migration

| Einstellung | Vorgabe |
| --- | --- |
| `DATABASE_URL` | Bereits bestätigte persistente Anwendungsdatenbank, ausschließlich serverseitig. Datenbankrolle und Tabellenbesitz vor Aktivierung prüfen. Die neue RLS-Konfiguration ist auf den bisherigen serverseitigen Datenbankzugriff ausgelegt. |
| `CMS_MEDIA_DIR` | Absoluter Pfad außerhalb des Anwendungs-Checkouts, sämtlicher Deployment-Releases und aller öffentlich ausgelieferten Web-Verzeichnisse. Keine Webserver-Aliasregel und kein Symlink darf das Verzeichnis öffentlich machen. |
| Dienst-Sandbox | Effektive Unit einschließlich Drop-ins prüfen: Der private externe Medienpfad muss gezielt in `ReadWritePaths` erlaubt sein. Bestehendes `ProtectSystem=strict` erhalten; keine breite Schreibfreigabe auf `/srv` oder `/var`. |
| Dateirechte | Nur der notwendige Laufzeitbenutzer und die gesicherte Administration dürfen zugreifen. Der Code erzeugt neue Verzeichnisse mit `0700`, Dateien mit `0600`; bestehende Verzeichnisrechte werden dadurch nicht automatisch korrigiert. |
| `WEBSITE_STUDIO_ENABLED` | Zunächst `false`. Aktivierung nur mit dem exakten Wert `true`; den Dienst anschließend über den vorhandenen freigegebenen Betriebsweg neu starten. |

Die vorbereitete Vorlage [`ops/white-gloss-studio.conf.example`](ops/white-gloss-studio.conf.example) ergänzt ausschließlich `ReadWritePaths=/var/lib/white-gloss/studio-media` und `UMask=0077`. Sie wird nicht automatisch installiert. Vor Verwendung muss genau dieser Pfad samt Dienstnutzer bestätigt sein; Verzeichnis `deploy:deploy` mit 0700, Dateien mit 0600. Die Vorlage ersetzt weder die Basis-Unit noch andere Drop-ins und setzt das Studio-Flag nicht. Effektive Rechte nach einem kontrollierten Neustart erneut prüfen; die Konfiguration allein beweist keine Schreibbarkeit im Dienst.

Der Bildspeicher lehnt bekannte Release-/Stagingbäume, gängige Webroots und Symlinkpfade auch bei bereits vorhandenem Verzeichnis ab. Eigentümer sowie 0700/0600 werden vor Zugriff kontrolliert, unsichere Rechte nicht automatisch verändert. Benutzerdefinierte Webserver-Aliase oder Bind-Mounts können daraus nicht zuverlässig erkannt werden und müssen weiterhin am Server geprüft werden.

`0025_website_studio.sql` ergänzt die bestehenden CMS-Einträge um Dokumentkennungen, Fassungsverweise und Archivstatus. Hinzu kommen private Tabellen für Fassungen und Medien. Es werden keine Buchungstabellen migriert und keine Kundenfotos übernommen.

Vor einer Ausführung den Plan im bestätigten Serverkontext mit vorhandener geschützter Datenbankkonfiguration lesen:

```sh
npm run db:migrate -- --dry-run
```

Nur wenn der frisch gelesene Plan tatsächlich genau die drei am 8. November festgestellten Dateien enthält und ausschließlich Studio freigegeben ist:

```sh
npm run db:migrate -- --only=0025_website_studio.sql --expect-pending=0023_roapp_invoices.sql,0024_qonto_webhook.sql,0025_website_studio.sql
```

`--expect-pending` wird unter der Migrationssperre gegen die vollständige ausstehende Dateiliste geprüft. Bei Abweichung, bereits angewandter Auswahl oder unbekannter Option stoppt der Befehl vor DDL. Die zurückgestellten 0023/0024 werden nicht mit ausgeführt. Abhängigkeiten der freigegebenen Datei müssen weiterhin fachlich geprüft sein. Ohne Auswahl verarbeitet `npm run db:migrate` aus Kompatibilitätsgründen weiterhin **alle** ausstehenden Dateien. Jede ausgeführte Datei wird mit ihrem Registry-Eintrag in einer Transaktion angewendet; vorher erfolgreich ausgeführte Dateien werden bei einem späteren Fehler nicht zurückgerollt. Keine SQL-Ausschnitte mehrfach manuell anwenden und keine Migrationshistorie fingieren.

Nach der genehmigten Migration nur lesend bestätigen:

- Die neuen Spalten, Fremdschlüssel, Tabellen und der Registry-Eintrag sind vorhanden.
- `cms_revisions` und `cms_media` haben RLS aktiviert; `PUBLIC`, `anon` und `authenticated` erhalten keine direkten Tabellen-/Sequenzrechte. Weitere tatsächlich eingerichtete API-Rollen mitprüfen; keine öffentlichen Lesepolicies für Entwürfe ergänzen.
- Der bestehende serverseitige Datenbankbenutzer kann die erforderlichen Studio-Operationen ausführen. RLS nicht zur Fehlerbehebung abschalten.
- Die bisherigen Buchungs- und Authentifizierungsprüfungen bleiben unverändert erfolgreich.

## 4. Sichtbarkeit, Fassungen und Bilder

- **Speichern:** erzeugt einen neuen Entwurf. Öffentliche Seiten verwenden ausschließlich eine veröffentlichte Fassung; vorhandene feste Inhalte bleiben sonst erhalten.
- **Ältere CMS-Inhalte:** Veröffentlichten und unveröffentlichten Altinhalt beim ersten Öffnen unverändert anzeigen. Der erste Studio-Schreibvorgang sichert die vorhandene Textfassung als Ausgangsversion; ein unveröffentlichter Altentwurf wird dadurch nicht veröffentlicht. Das bloße Öffnen des Editors oder ein öffentlicher Seitenaufruf legt keine Fassung an. Blog-Kurztexte werden als Teil der Fassung bearbeitet und erst beim Veröffentlichen auf die bestehende öffentliche Ausgabe übertragen; andere gespeicherte Zusatzfelder bleiben erhalten.
- **Gleichzeitige Bearbeitung:** Speichern und Veröffentlichen vergleichen Fassungskennungen innerhalb einer Transaktion. Bei einem Konflikt neu laden und Inhalte vergleichen; die Fehlermeldung nicht durch Wiederholen einer veralteten Anfrage umgehen.
- **Wiederherstellen:** erzeugt einen neuen Entwurf aus einer älteren Fassung. Die aktuelle Veröffentlichung bleibt unverändert. Referenzierte Uploads müssen weiterhin freigegeben und verfügbar sein; entzogene oder archivierte Bilder verhindern die Wiederherstellung dieser Fassung.
- **Zurückziehen:** entfernt die öffentliche Studio-Fassung und beide aktiven Fassungsverweise. Historie bleibt erhalten. Alte Speicher-/Veröffentlichungsanfragen dürfen den Inhalt nicht reaktivieren; dafür ist zuerst eine bewusste Wiederherstellung als Entwurf notwendig.
- **Über uns:** Ohne veröffentlichte Fassung bleibt die Seite 404 und `noindex`; sie darf dann weder in der Navigation noch in der Sitemap erscheinen. Das gilt auch nach Abschaltung oder Archivierung.
- **Bilder:** Neue Uploads sind zunächst nicht freigegeben. Ein Alt-Text und eine ausdrückliche Bildfreigabe sind erforderlich. Öffentlich abrufbar wird ein Upload erst, wenn ihn eine aktive veröffentlichte Fassung verwendet. Entwurfs- und historische Verweise reichen nicht aus.
- **Verarbeitung:** JPEG, PNG und WebP bis 12 MiB und 40 Megapixel; keine animierten Bilder. Die Ableitung wird maximal 2400 Pixel groß als WebP gespeichert, ohne EXIF/GPS-Metadaten. HEIC ist derzeit kein unterstütztes Uploadformat.
- **Private Kundenfotos:** Keine automatische Übernahme aus Buchungen oder aus dem privaten Kunden-Storage. Der statische Katalog enthält nur die bereits im Website-Code verwendeten öffentlichen Galeriebilder. Neue Veröffentlichungsrechte müssen für jedes zusätzlich hochgeladene Bild geprüft werden.
- **Bild entfernen:** Archivierung entzieht öffentliche und Vorschauzugriffe. Die Datei bleibt privat gespeichert; es gibt keine automatische endgültige Löschung und keine automatische Wiederfreigabe durch eine historische Seitenfassung. Aufbewahrung und spätere endgültige Löschung brauchen ein eigenes, geprüftes Verfahren.

Studio-Antworten und widerrufbare Bildrouten müssen `private, no-store` beibehalten. Bereits von Dritten heruntergeladene oder kopierte Bilder lassen sich durch eine Archivierung nicht zurückholen.

## 5. Abnahme vor Aktivierung

Am endgültigen Commit nachweisen:

- Lint, Typprüfung, Build, Fassungs-/Parallelitäts-, RLS-, Medien-, Release- und SEO-Regressionen bestehen.
- Die ausschließlich im dafür zugelassenen Linux-GitHub-CI-Job laufenden Browserprüfungen decken Betreiber, Nichtbetreiber, fehlende/abgelaufene Sitzung, Uploadfehler, Vorschau, Veröffentlichung, Entzug und Wiederherstellung ab. Keine lokale Website starten und keine CI-Umgebung auf dem Entwicklerrechner vortäuschen.
- Ein Entwurfsbild ist anonym nicht abrufbar; nach Veröffentlichung ist es abrufbar; nach Bild- oder Seitenentzug nicht mehr. Andere private Fotoquellen bleiben unzugänglich.
- Flag aus und fehlendes Studio-Schema lassen bestehende öffentliche Seiten mit ihren festen Inhalten verfügbar. Die bisherigen CMS-Verwaltungsseiten bleiben für noch nicht Studio-versionierte Inhalte bearbeitbar. Betreiber-, Konflikt- und Versionsgrenzen des Fallbacks sowie unveröffentlichte Altentwürfe und Blog-Kurztexte gesondert prüfen. Über uns bleibt unveröffentlicht; die Sitemap enthält keinen entsprechenden 404-Eintrag.
- Ungespeicherte Bildangaben und laufende Medienoperationen müssen denselben Navigationsschutz wie Seiteninhalte auslösen; Speichern der Seite darf Bildangaben nicht fälschlich als gespeichert anzeigen.
- Eine erneute Aktivierung darf vorhandene gespeicherte Veröffentlichungen wieder sichtbar machen. Vorher deshalb deren aktuellen Inhalt und Bildfreigaben prüfen.

Nach einer späteren genehmigten Aktivierung nur die abgesprochenen lesenden Produktionsprüfungen durchführen. Keine Testbuchung, Kunden-E-Mail, Testnachricht oder Kundendatenänderung auslösen. Schreibprüfungen mit synthetischen Daten gehören in die isolierte CI; zusätzliche produktive Studio-Schreibproben benötigen eine konkrete Freigabe.

## 6. Abschalten und zurückrollen

Der erste technische Rückweg ist `WEBSITE_STUDIO_ENABLED=false` mit kontrolliertem Neustart über den vorhandenen Betriebsweg. Das stoppt Studio-Operationen, die neuen öffentlichen Inhaltsüberlagerungen und den Zugriff auf Studio-Uploads. Daten, Fassungen und Dateien bleiben erhalten. Gegebenenfalls anschließend den zuvor geprüften kompatiblen Code-Release über den bestehenden Rollback-Weg aktivieren.

**Die Abschaltung ist kein vollständiger Inhalts-Rollback.** Veröffentlichte FAQ-, Blog- und Zusatzleistungs-Texte werden für bestehende Verbraucher weiterhin aus `cms_items` gelesen. Diese Texte werden durch das Flag nicht auf ihren früheren Stand gesetzt. Ein Inhalts-Rollback erfolgt bewusst durch Wiederherstellen und erneutes Veröffentlichen einer geprüften Fassung; dafür muss das Studio verfügbar sein und eine passende Freigabe vorliegen.

Keine Tabellen, Spalten, Migrationseinträge oder Bilddateien als Rollback löschen. Keine gesamte Produktionsdatenbank über neue Buchungen hinweg zurückspielen. Eine Datenwiederherstellung ist ein gesonderter Vorgang mit eigenem Umfang, aktuellem Backup und ausdrücklicher Freigabe.

## 7. Noch gesondert zu belegen

- Endgültige CI-Ergebnisse, Lighthouse-Messungen, Screenshots und genaue Commit-ID; synthetische Tests ersetzen keine realen Core Web Vitals.
- Bedienung auf tatsächlichen iOS-/Android-Geräten sowie Safari/VoiceOver und Windows-Screenreader, soweit diese Geräte verfügbar sind. Browser-Engine-Tests allein belegen keine vollständige Gerätefreigabe.
- Aktuelle Search-Console-/Bing-Daten, falls ein bestätigter Zugriff verfügbar ist; keine Rankinggarantie.
- Freigegebene Inhabervorstellung, Unternehmensgeschichte, Werkstattbilder, Bildrechte und belastbare lokale Referenzen. Fehlende Fakten nicht ergänzen oder automatisch veröffentlichen.
- Tatsächliche Hostingpfade, Datenbankrechte, Backup-Wiederherstellung, verfügbare Speicherkapazität, Monitoring und Aufbewahrungsregel für archivierte Bilder.

## 8. Maßgebliche Code-Stellen

- `src/lib/cms.functions.ts`, `cms.store.ts`, `cms.availability.ts`: Freischaltung, Betreiberzugriff, Fassungen und öffentlicher Fallback.
- `src/lib/studio-media.server.ts`, `studio-media-storage.server.ts`, `studio-media-image.server.ts`: Bildfreigabe, Dateispeicher und Optimierung.
- `src/routes/api.studio-media-upload.ts`, `api.studio-media.$id.ts`: authentifizierter Upload und kontrollierte Bildauslieferung.
- `migrations/0025_website_studio.sql`: additive Schemaerweiterung und private RLS-Tabellen.
- `scripts/write-release-manifest.mjs`, `scripts/migrate.mjs`, `scripts/deploy-ionos-release.sh`: getrennte Schema-, Migrations- und Releasegrenzen.
- `src/routes/ueber-uns.tsx`, `src/lib/sitemap.server.ts`, `server/cache-policy.ts`: öffentliche Sichtbarkeit und Cache-Regeln.
