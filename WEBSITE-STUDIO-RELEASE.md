# Website Studio: Freigabe und Betrieb

Stand: 7. November 2026. Diese Anleitung bereitet eine spätere Veröffentlichung vor. Sie erteilt keine Freigabe für Merge, Deployment, Datenbankänderungen, Aktivierung oder Veröffentlichung von Inhalten. In diesem Arbeitspaket werden keine produktiven Buchungen, Nachrichten oder Kundendaten verändert.

Die endgültige Commit-ID, CI-Ergebnisse, Browserberichte und Screenshots gehören in den Abschlussbericht des Pull Requests. Die folgenden Voraussetzungen sind Abnahmepunkte, keine Behauptung bereits abgeschlossener Prüfungen.

## 1. Getrennte Freigaben

**Merge kann ein Deployment auslösen:** `.github/workflows/deploy-hostinger.yml` reagiert nach erfolgreicher Push-CI auf `main`, sofern `HOSTINGER_DEPLOY_ENABLED=true` ist. Der aktuelle Wert und die tatsächlichen Freigaberegeln des Environments `production` sind vor einem Merge zu prüfen. Deshalb keinen Merge als rein technische Ablage behandeln: Entweder ist die automatische Auslieferung nachweislich gesperrt, oder die ausdrückliche Freigabe umfasst auch genau dieses Deployment. Eine Änderung dieser Einstellungen benötigt ebenfalls eine konkrete Freigabe; dieser PR verändert sie nicht.

1. **Code:** Den konkreten Commit und seine bestandenen Prüfungen freigeben; anschließend ausschließlich den bestätigten, bestehenden Veröffentlichungsweg verwenden. Aktives Hostingziel und Releasepfade vorab abgleichen: ältere Betreiberregeln und Skriptnamen nennen IONOS, während ein Hostinger-Workflow vorhanden ist. Daraus allein folgt keine Freigabe für einen Anbieterwechsel. Branch Protection und den bestehenden Buchungs-Releasevertrag beibehalten.
2. **Einrichtung:** Datenbankziel, Sicherungen, Migration `0025_website_studio.sql`, dauerhaften Bildspeicher und Konfiguration ausdrücklich freigeben. Ein genehmigtes Code-Deployment allein erlaubt diese Änderungen nicht.
3. **Aktivierung:** `WEBSITE_STUDIO_ENABLED=true` erst nach bestätigter Einrichtung und gesonderter Freigabe setzen.
4. **Inhalte:** Tatsächliche Texte, Bildrechte und Vorschau prüfen. Erst „Jetzt veröffentlichen“ macht eine gespeicherte Fassung öffentlich. Fehlende persönliche Angaben bleiben unveröffentlichte Entwürfe.

Der Code kann zunächst mit deaktiviertem Studio ausgeliefert werden. `0025_website_studio.sql` ist im Release-Manifest ausdrücklich als optionale Erweiterung geführt; unbekannte künftige Migrationen bleiben erforderlich. Die Produktions-Readiness-Prüfung und der PostgreSQL-Zugriff führen diese Studio-Migration nicht automatisch aus.

Die bisherigen CMS-Verwaltungsseiten öffnen denselben neuen Studio-Editor. Bei deaktiviertem Studio ist dort keine redaktionelle Bearbeitung möglich; veröffentlichte Bestandsinhalte bleiben sichtbar. Für unterbrechungsfreie redaktionelle Nutzung müssen Codefreigabe, Einrichtung und Aktivierung deshalb gemeinsam vorbereitet werden. Flag aus ist ein Rückweg für die öffentliche Website, kein Ersatz für einen verfügbaren Editor.

## 2. Vor der Einrichtung prüfen

| Bereich | Voraussetzung und Nachweis |
| --- | --- |
| Datenbank | Tatsächliches produktives PostgreSQL-Ziel und Schema bestätigen. Keine neue Datenbank und kein PGlite-Ersatz für den Betrieb. `_migrations` und die noch ausstehenden Dateien vorab nur lesen. |
| Sicherung | Konsistente Datenbanksicherung einschließlich `cms_items`, Authentifizierung und Buchungsdaten; später zusätzlich `cms_revisions` und `cms_media`. Sicherungszeitpunkt, Aufbewahrung, Zugriffsschutz und Wiederherstellungsweg dokumentieren. Wiederherstellung in einer getrennten Umgebung nachweisen. |
| Bildspeicher | Separates, dauerhaftes Verzeichnis, das weder Releasewechsel noch Bereinigung alter Releases löschen. Sicherung der WebP-Dateien zusammen mit der zugehörigen Datenbank planen. |
| Zugriff | Bestehende Betreiber-Anmeldung mit gültiger Sitzung prüfen. Nichtbetreiber und abgelaufene Sitzungen müssen weiter abgewiesen werden. `OPERATOR_ENFORCE=0` und produktive Entwicklungsanmeldung sind unzulässig. |
| Laufzeit | Vorhandene Node-/Sharp-Abhängigkeiten und das gebaute Artefakt prüfen. Keine neue Bibliothek oder Systeminstallation allein wegen dieser Anleitung. |
| Rückweg | Aktuellen und letzten kompatiblen Release-Commit notieren. Beim späteren Wechsel den tatsächlich erwarteten aktuellen Commit und die geprüfte Artefakt-Prüfsumme verwenden. |

Keine Produktionsgeheimnisse in Repository, Tickets, Screenshots oder Protokolle übernehmen. Die vorhandene Panel-, Buchungs-, Preis-, E-Mail- und Storage-Konfiguration nicht aus `.env.example` überschreiben; die Vorlage enthält auch historische Integrationsbeispiele.

## 3. Konfiguration und Migration

| Einstellung | Vorgabe |
| --- | --- |
| `DATABASE_URL` | Bereits bestätigte persistente Anwendungsdatenbank, ausschließlich serverseitig. Datenbankrolle und Tabellenbesitz vor Aktivierung prüfen. Die neue RLS-Konfiguration ist auf den bisherigen serverseitigen Datenbankzugriff ausgelegt. |
| `CMS_MEDIA_DIR` | Absoluter Pfad außerhalb des Anwendungs-Checkouts, sämtlicher Deployment-Releases und aller öffentlich ausgelieferten Web-Verzeichnisse. Keine Webserver-Aliasregel und kein Symlink darf das Verzeichnis öffentlich machen. |
| Dateirechte | Nur der notwendige Laufzeitbenutzer und die gesicherte Administration dürfen zugreifen. Der Code erzeugt neue Verzeichnisse mit `0700`, Dateien mit `0600`; bestehende Verzeichnisrechte werden dadurch nicht automatisch korrigiert. |
| `WEBSITE_STUDIO_ENABLED` | Zunächst `false`. Aktivierung nur mit dem exakten Wert `true`; den Dienst anschließend über den vorhandenen freigegebenen Betriebsweg neu starten. |

`0025_website_studio.sql` ergänzt die bestehenden CMS-Einträge um Dokumentkennungen, Fassungsverweise und Archivstatus. Hinzu kommen private Tabellen für Fassungen und Medien. Es werden keine Buchungstabellen migriert und keine Kundenfotos übernommen.

Vor einer genehmigten Ausführung alle ausstehenden Migrationen vergleichen: `npm run db:migrate` verarbeitet **alle** noch ausstehenden Dateien, nicht ausschließlich `0025`. Bei zusätzlichen unerwarteten Dateien stoppen und den tatsächlichen Umfang erneut prüfen. Die bestehende Migrationsroutine führt jede Datei mit ihrem Eintrag in `_migrations` in einer Transaktion aus. Keine SQL-Ausschnitte mehrfach manuell anwenden und keine Migrationshistorie fingieren.

Nach der genehmigten Migration nur lesend bestätigen:

- Die neuen Spalten, Fremdschlüssel, Tabellen und der Registry-Eintrag sind vorhanden.
- `cms_revisions` und `cms_media` haben RLS aktiviert; `PUBLIC`, `anon` und `authenticated` erhalten keine direkten Tabellen-/Sequenzrechte. Weitere tatsächlich eingerichtete API-Rollen mitprüfen; keine öffentlichen Lesepolicies für Entwürfe ergänzen.
- Der bestehende serverseitige Datenbankbenutzer kann die erforderlichen Studio-Operationen ausführen. RLS nicht zur Fehlerbehebung abschalten.
- Die bisherigen Buchungs- und Authentifizierungsprüfungen bleiben unverändert erfolgreich.

## 4. Sichtbarkeit, Fassungen und Bilder

- **Speichern:** erzeugt einen neuen Entwurf. Öffentliche Seiten verwenden ausschließlich eine veröffentlichte Fassung; vorhandene feste Inhalte bleiben sonst erhalten.
- **Ältere CMS-Inhalte:** Der erste Studio-Schreibvorgang sichert die bestehende veröffentlichte Textfassung als Ausgangsversion. Das bloße Öffnen des Editors oder ein öffentlicher Seitenaufruf legt keine Fassung an.
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
- Flag aus und fehlendes Studio-Schema lassen bestehende öffentliche Seiten mit ihren festen Inhalten verfügbar. Über uns bleibt unveröffentlicht; die Sitemap enthält keinen entsprechenden 404-Eintrag.
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
