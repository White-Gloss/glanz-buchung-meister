# Bitrix24-Direktanbindung: Teilprüfung und begrenzte Adapterkorrektur

Stand: 21.09.2026. Geprüfte Repository-Basis: `6489ddf27a008ac702dd9b7b9c6a510009740a1f`.

**Keine vollständige Integration, keine Produktivfreigabe und keine Einrichtung im Bitrix24-Konto.** Diese Änderung behebt ausschließlich eine reproduzierte Lücke im REST-Rechnungsabgleich. Der bestehende Entwurf #195 bleibt unverändert.

## Auftrag und Zielarchitektur

Lars möchte das bestehende Buchungsformular erhalten und den Alltag ausschließlich in Bitrix24 bedienen: Fotos persönlich prüfen, Leistungen/Preis/Arbeitszeit festlegen, manuell freigeben, Kundenunterschrift erhalten, beide Parteien zwei Kalendertage vorher erinnern, nach manueller Fertigmeldung die bestätigte Zahlungsvariante abrechnen. Allgemeine E-Mails dürfen keine neuen CRM-Aufträge erzeugen.

Geplante Architektur: Website-Formular → vorhandener serverseitiger Website-Code → Bitrix24-REST; Rückmeldungen aus Bitrix24 müssen authentifiziert und versionsgebunden verarbeitet werden. Die vorhandene Datenbank bleibt für Zustellung, Wiederaufnahme und Kapazitätssicherung nutzbar, nicht als zweiter täglich bedienter Leitstand. Nach Übernahme muss Bitrix24 für fachliche Änderungen führend sein.

Eine zusätzliche Integrationsplattform wird nicht eingeführt. Der vorhandene VibeCode-Zugang wird nicht ungeprüft abgeschaltet. Ob ergänzend eine lokale Bitrix24-App benötigt wird, bleibt von der nachgewiesenen nativen Signatur-, Freigabe- und Ressourcenfunktion im tatsächlichen Konto abhängig. Webhooks allein sind für den gesamten Auftrag noch nicht als ausreichend nachgewiesen.

## Tatsächlich geprüft

- GitHub meldet `main` auf der oben genannten Basis. Der vorhandene Production-Smoke-Lauf `35563451229` meldet Erfolg vom 21.09.2026. Das ist ein bestehender CI-Befund, kein in dieser Arbeit ausgeführter Ende-zu-Ende-Test und kein selbstständig abgeglichener Live-Release-Nachweis.
- `src/lib/bitrix.ts` unterstützt VibeCode sowie erkannte direkte REST-Webhook-Adressen. Der produktiv verwendete Zugang wurde nicht ausgelesen.
- `src/lib/bitrix-sync.ts` verwaltet eine dauerhafte Übertragungswarteschlange, kennzeichnet unklare Anlagevorgänge als prüfpflichtig und schützt bei `bitrix_workshop_managed` bereits Teile der in Bitrix bearbeiteten Daten vor erneutem Formularüberschreiben. Phasen und Teile des Rechnungsabgleichs werden weiterhin aus Website-Zuständen abgeleitet; die vollständig führende Rolle von Bitrix ist damit nicht nachgewiesen.
- Der bestehende Rechnungsabgleich ruft `GET /invoices/:id` und `PATCH /invoices/:id` auf. Der bisherige direkte REST-Adapter unterstützt diese Aktionen nicht und wirft `bitrix_unsupported`. Der Fehler wurde mit dem tatsächlichen Adaptercode lokal reproduziert.
- `docs/bitrix-workshop.md` beschreibt eine eingebettete App und Resend-Versand. Diese Beschreibung beweist weder die aktuelle Kontoeinrichtung noch den geforderten vollständigen Kunden-Signaturablauf.
- Der offene Entwurf #195 verändert ebenfalls die Integration. Sein Patch an `bitrix-rest.ts` ergänzt benutzerdefinierte Feldzuordnungen, nicht die hier fehlenden Rechnungsaktionen. Er wurde weder geändert noch zusammengeführt.
- Supabase-Zugriff funktioniert. Beide angezeigten Projekte sind `ACTIVE_HEALTHY`. Die Repository-Konfiguration verweist öffentlich auf `mvlhoibkkvmudxlevtlt`; dessen gelistetes `public`-Schema enthält nicht die aktuellen Bitrix-Warteschlangen-/Shop-Tabellen. Dort sind weiterhin ältere ERPNext-/Odoo-Funktionen bereitgestellt. Bereitgestellt bedeutet nicht nachweislich operativ aufgerufen. Das zweite Projekt `axsrirrlospxdutvwnyy` enthält ein anderes kleines Schema.
- Der aktuelle Datenbankcode verwendet die serverseitige `DATABASE_URL` über den PostgreSQL-Treiber, andernfalls PGLite. Die Bezeichnung `neon` im Code beweist nicht den tatsächlichen Datenbankanbieter. Keines der Supabase-Projekte wurde als aktive Produktionsdatenbank der aktuellen Website bestätigt. Keine Datenbankänderung wurde vorgenommen.
- In dieser Sitzung war kein aufrufbarer authentifizierter Bitrix24-Kontozugang verfügbar. Die App-Suche fand keine passende Bitrix24-Verbindung und keinen nutzbaren Browser-/Computer-Zugang. Dokumentationszugriff ist kein Kontozugriff.

## Implementierte, begrenzte Änderung

`src/lib/bitrix-rest.ts` bildet nun das Lesen einer bestehenden Rechnung auf `crm.item.get` und ausschließlich deren Phasenänderung auf `crm.item.update` ab, jeweils mit `entityTypeId: 31`.

Die Antwort muss den richtigen Rechnungsdatensatz mit einem Status enthalten. Eine Aktualisierung muss zusätzlich den angeforderten Status bestätigen. Fehlende, widersprüchliche oder unklare Antworten werden prüfpflichtig, nicht als Erfolg behandelt. Ungültige IDs, nicht unterstützte Rechnungsoperationen sowie Änderungen an Betrag, Rechnungsnummer oder sonstigen Inhalten über diesen Statuspfad werden abgewiesen.

Es gibt hier keine Rechnungsanlage, Zahlungsbuchung, Dokumentänderung, neuen Versand oder automatische Wiederholung eines fehlgeschlagenen Schreibaufrufs. Die bereits vorhandenen, kontospezifischen Phasenkennungen des aufrufenden Codes werden nicht als geprüft ausgegeben. Sie müssen vor Aktivierung im richtigen Portal abgeglichen werden. Ein Phasenwechsel ersetzt keinen Nachweis eines Zahlungseingangs.

`src/lib/bitrix-rest.test.ts` prüft die Adapterverträge mit injizierten Antworten. `package.json` nimmt diese Tests in den vorhandenen Testbefehl auf; keine Abhängigkeit wird geändert.

## Ausgeführte Nachweise und Grenzen

- Originalkopien von Adapter, Fehlerklasse und `package.json` wurden gegen ihre Git-Blob-SHAs abgeglichen.
- Vor Korrektur: 13 gezielte Tests, davon 8 fehlgeschlagen und 5 bestanden. Die erwarteten Rechnungsaufrufe scheiterten am fehlenden Adapterpfad.
- Nach Korrektur: dieselben 13 Tests bestanden. Enthalten sind Antwortprüfung, unerlaubte Änderungen, falsche IDs, Berechtigungs-/Netzwerkfehler und bestehende Auftrags-/Kontaktzuordnungen.
- Separate strenge Typprüfung dieser drei TypeScript-Dateien mit TypeScript 5.8.3 und vorhandenen Node-Typen bestanden. Dies ist ausdrücklich nicht der vollständige Projekt-Typecheck mit allen Projektabhängigkeiten.
- Ausführung: `node --experimental-strip-types --test src/lib/bitrix-rest.test.ts` mit Node 22.16.0.
- Alle API-Antworten in diesen Tests sind kontrollierte Testdaten. Kein echter Bitrix-Auftrag, kein Rechnungsnummernkreis, keine Zahlung und keine Kunden-E-Mail wurden angesprochen.
- Vollständiger Build, vollständige Testsuite, Projekt-Lint und authentifizierte Desktop-/Smartphone-Praxistests wurden hier nicht ausgeführt. Der lokale vollständige Checkout/Abhängigkeitsbezug war durch fehlende Netzwerkauflösung blockiert. GitHub-Lese-/Schreibzugriff über den verbundenen Dienst funktionierte unabhängig davon.

## Offene Abnahme nach dem Kundenauftrag

| Nachweis                                                                     | Stand dieser Arbeit                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| A: Buchung mit mehreren nutzbaren Fotos, keine Doppelanlage                  | Code teilweise geprüft; kein vollständiger Praxistest                          |
| B: Keine Annahme/Rechnung ohne persönliche Freigabe                          | Bestehender Ablauf nur teilweise geprüft; Kontoregeln offen                    |
| C: E-Mail, echte Kundenunterschrift, richtige Version und Rückmeldung        | Kontozugang und native Kanalprüfung fehlen; nicht eingerichtet                 |
| D: Gleiche Leistungen/Preise/Termine und konkurrierende Reservierung         | Keine vollständige systemübergreifende Abnahme                                 |
| E: Zwei-Tage-Erinnerungen, Umbuchung, Storno, kurzfristige Termine           | Nicht praktisch geprüft; Vorbereitungstext von Lars fehlt weiterhin            |
| F: Genau eine Rechnung, tatsächliche Barzahlung oder sieben Tage Überweisung | Nur der begrenzte REST-Statusadapter geprüft; Rechnungs-/Zahlungsprozess offen |
| G: Keine zweite Rechnung durch erneute Fertigmeldung oder Versand            | Adapter erzeugt keine Rechnung; Ende-zu-Ende-Nachweis offen                    |
| H: Allgemeine E-Mail erzeugt keinen Auftrag, Antwort korrekt zugeordnet      | Tatsächliche Postfachregeln unzugänglich; nicht eingerichtet                   |
| I: Ausfall/Wiederaufnahme ohne Datenverlust/Duplikate                        | Einzelner Adapterfehler geprüft; gesamte Zustellung nicht abgenommen           |

Der offizielle Artikel zur Regel „Dokument zum Unterschreiben senden“ beschreibt SMS bei vorhandener Telefonnummer und E-Mail als Ausweichkanal. Das ist ein konkreter Konflikt zur geforderten E-Mail-Zustellung, kein Beweis dafür, dass jede native Signaturvariante ungeeignet ist. Im Konto ist ein geeigneter Kanal nachzuweisen; echte Telefonnummern dürfen nicht entfernt werden. Die Kundenerinnerung darf ohne freigegebenen Vorbereitungstext nicht als vollständig eingerichtet gelten und keine Platzhalter versenden.

## Reihenfolge vor einer späteren Umstellung

1. Sicheren Kontozugang herstellen und Portal, Benutzer, Rechte, Tarif, native Kundensignatur, Pipeline-/Kalender-/Rechnungskennungen und Postfachregeln lesend verifizieren. Keine Geheimnisse im Chat oder Repository hinterlegen.
2. Tatsächlichen Website-Release, `DATABASE_URL`-Ziel ohne Geheimnisoffenlegung, aktive Versand-/CRM-Worker und offene Warteschlangen im Betrieb prüfen. Nicht von alten Notizen auf die aktive Architektur schließen.
3. Offene Entwicklung einschließlich #195 abgleichen. Fachliche Zuständigkeit in Bitrix, authentifizierte Freigaben/Rückmeldungen und atomare Kapazitätssicherung vervollständigen; einen verantwortlichen Auslöser pro Nachricht/Rechnung festlegen.
4. Native Signatur per E-Mail mit gespeicherter Version und Nachweis, Postfachzuordnung sowie Erinnerungen prüfen. Vorbereitungstext und tatsächliche Unternehmens-/Steuer-/Bankdaten freigeben lassen. Benötigtes Rechnungsformat gesondert prüfen.
5. A–I mit gekennzeichneten Testaufträgen und kontrollierten Empfängern nachweisen, ohne produktive Rechnungsnummern zu verbrauchen. Erst anschließend konkrete Umschaltfreigabe einholen.

Bis dahin bleiben `main`, Produktion, Altaufträge, Rechnungen, Datenbanken und bestehende Integrationen durch diese Arbeit unverändert. Rücknahme dieses Entwurfs: nicht zusammenführen bzw. Entwurf schließen. Für einen späteren produktiven Wechsel sind Datenbank-/Konfigurationssicherung, Warteschlangenabgleich und Rückkehrplan vorab erforderlich; dieser Code-Patch allein ersetzt sie nicht.

## Quellen

- Repository-Dateien und PR #195 auf der oben genannten Basis; live gelesene Supabase-Metadaten am 21.09.2026.
- https://apidocs.bitrix24.com/api-reference/crm/universal/invoice.html
- https://apidocs.bitrix24.com/api-reference/crm/universal/crm-item-get.html
- https://apidocs.bitrix24.com/api-reference/crm/universal/crm-item-update.html
- https://helpdesk.bitrix24.de/open/24309644/

Wichtig: `crm.item.update` kann gespeicherte Automatisierungsregeln auslösen. Deshalb sind Kontoregeln vor einem echten Statuswechsel zu prüfen. Diese Arbeit führt keinen solchen Live-Aufruf aus.

## Fortsetzung 22.09.2026

Neue Session, neue Umgebung (lokaler Windows-Rechner statt Cloud-Sandbox). Git und Node.js waren hier nicht vorinstalliert und wurden für diese Arbeit installiert (Git 2.55, Node 22.16.0 portable zur Testsuite-Kompatibilität, Node 24.9.0 portable zur CI-Parität für `test:release`).

**Bestandsaufnahme:** `main` lag zu Beginn bei `605c9bc` (enthält die oben beschriebene begrenzte Rechnungsstatus-Korrektur, bereits gemergt). Einzige offene PR laut GitHub-API: **#195** (`codex/bitrix-complete-setup`, Draft, Basis `5e593b6f`). Der in einem früheren Handoff erwähnte Branch/Commit `codex/bitrix-direct-integration-complete` (`0c5da73`) existiert weder als Branch noch als Commit-Objekt auf GitHub – er wurde nie gepusht und war in dieser Session nicht verfügbar.

**Merge:** Branch `integration/bitrix-continuation-20260922` von `main` erstellt, PR #195 hinein gemergt (Commit `c176fc0`). Fünf Konflikte, konservativ aufgelöst:

- `package.json`: Test-Skript-Liste vereinigt (main hatte seither neue Tests wie `roapp-*`, `hub-sync`, `booking-selection`; PR #195 brachte `ionos-mail.server.test.ts`, `bitrix-calendar.test.ts`, `bitrix-documents.test.ts` neu).
- `src/components/configurator.tsx`: `main`s Buchungsentwurf-Persistenz (`useBookingDraft`) und Slot-Sperrlogik beibehalten statt PR #195s paralleler Neufassung – letztere nahm eine andere, unbestätigte Kapazitätsannahme an (blockiert nur wenn _beide_ Ressourcen belegt, statt bei jeder Überschneidung). Diese Annahme wurde nicht stillschweigend übernommen. `booking-slot-availability.ts` bleibt als unverdrahtete Zusatzdatei erhalten. Ein zusätzlicher, nicht in Konfliktmarkierungen sichtbarer Fehler (`setAvailability` statt `setAvailabilityState`, verwaist aus PR #195s entfernter State-Variable) wurde beim Typecheck gefunden und auf `main`s ursprüngliches `onChange` zurückgesetzt.
- `src/lib/bitrix-sync.ts`: `main`s Import von `ensureBitrixWorkshopSchema` behalten; `berlinWallToUtc`-Import entfernt, da PR #195 die bisherige `ensureCalendar`-Rückfalllogik auf Basis von `preferred_date`/`preferred_slot` durch eine strikte Pflicht auf explizit gesetzte `work_start_at`/`work_end_at` ersetzt hat (verifiziert: `main` hat diese Funktion seit dem gemeinsamen Basis-Commit nicht verändert, PR #195 ist alleiniger Urheber der Änderung).
- `src/lib/bitrix.functions.ts`: beide unabhängigen Server-Funktionen kombiniert (`repairBitrixContact` aus `main`, `enableBitrixCalendar` aus PR #195).
- `src/routes/api.availability.ts`: `main`s `roappOnlyEnabled`-Verzweigung beibehalten (seit Basis-Commit neu in `main`, in PR #195 nicht vorhanden).

**In dieser Sitzung tatsächlich ausgeführt und verifiziert** (nicht nur aus Dokumenten übernommen):

- `npm ci`: 450 Pakete, 0 Schwachstellen.
- Gezielte Bitrix-/IONOS-Tests (`bitrix-rest`, `bitrix-sync`, `bitrix-calendar`, `bitrix-documents`, `ionos-mail.server`, `bitrix-workshop-bridge`, `bitrix-agent`): 57/57 bestanden.
- `npx tsc --noEmit`: fehlerfrei (nach obiger Korrektur).
- `npx eslint` auf allen gemergten/geänderten Dateien: fehlerfrei, keine Warnungen.
- `npm test` (volle Suite, Node 22.16.0 mit `--experimental-strip-types`): **523/523 bestanden, 0 Fehler**.
- `npm run build`: erfolgreich (nach lokaler Installation des fehlenden `lightningcss-win32-x64-msvc`-Pakets; reines Umgebungsproblem dieses ARM64-Windows-Rechners mit x64-Node, keine Codeänderung nötig).
- `npm run test:release` (isolierter QA-Server: SSR, End-to-End-Flows, Sitemap): bestanden – allerdings erst unter Node 24.9.0. Unter Node 22.16.0 schlug `frontend-ssr` mit `ERR_UNKNOWN_FILE_EXTENSION ".ts"` fehl, weil `scripts/qa/run-checks.mjs` ohne `--experimental-strip-types` startet und sich auf natives TS-Stripping verlässt, das erst ab neueren Node-Versionen standardmäßig aktiv ist. CI (`.github/workflows/ci.yml`) nutzt Node 24 – das ist also eine reine Node-Versionsfrage dieser lokalen Umgebung, kein Fund an diesem Code.
- **Nicht ausgeführt:** `check:migrations`, `check:rls` (beide benötigen einen erreichbaren PostgreSQL-Server; PR #195 ändert keine Migrationsdateien, daher als nicht anwendbar für diesen Merge eingestuft statt eine vollständige lokale Postgres-Einrichtung nur dafür aufzusetzen). `lighthouse:*` nicht ausgeführt (nicht Teil der Kernverifikation, keine Layoutänderung durch diesen Merge).

**Kontozugang:** In dieser Sitzung war kein authentifizierter Bitrix24-Kontozugriff verfügbar (kein Connector, kein Browser-Login geprüft). Alle Aussagen zu Portal-Feldern, Vorlagen-IDs, Postfach-Konfiguration weiter oben in diesem Dokument stammen aus einer früheren Sitzung (Stand 13.09.2026) und wurden hier **nicht erneut verifiziert** – sie bleiben als "dokumentiert damals", nicht "geprüft jetzt" zu behandeln.

**Schreibzugriff/Push:** Dieser lokale Windows-Rechner hat über den Git Credential Manager funktionierenden GitHub-Schreibzugriff (verifiziert per `git push --dry-run`, Exit-Code 0) – anders als die in einem früheren Handoff beschriebene Cloud-Sandbox, deren Git-Proxy keine Schreib-Credentials für dieses Repository hatte. Der Branch `integration/bitrix-continuation-20260922` wurde nach `origin` gepusht, **nicht** nach `main` gemergt.

**Nicht verändert durch diese Sitzung:** `main`, Produktion, Bitrix-Kontoeinstellungen, Automatisierungsregeln, Postfachzuordnungen, Rechnungsnummernkreise. Die Aktivierungsschritte aus PR #195 (`enableBitrixCalendar`, IONOS-Mailversand) bleiben Server-Funktionen ohne UI-Verdrahtung bzw. hinter einem Standardmäßig-aus-Flag – nichts davon wurde in dieser Sitzung aktiviert.

**Offen (A–I unverändert gegenüber obiger Tabelle):** Die Tabelle "Offene Abnahme nach dem Kundenauftrag" oben bleibt in ihrem Kernaussagen gültig. Zusätzlich neu durch PR #195 vorbereitet, aber weiterhin nicht aktiviert/verifiziert: nativer Kalenderabgleich (Punkt D), native Dokumentvorlagen für Bestätigung/Rechnung (Punkt C/F), IONOS-Mailversand (Punkt C/H). Vor jeder Aktivierung: Portal-Zugang erneut lesend verifizieren (Stand 13.09.2026 ist zehn Tage alt), `enableBitrixCalendar` nur durch den Inhaber auslösen lassen, IONOS-SMTP-Anbindung an den Notification-Worker fertigstellen (siehe Lücken in `docs/bitrix-portal-setup.md`, Abschnitt zu `ionos-mail.server.ts`).

## Fortsetzung 24.09.2026: Betriebsart „nur Bitrix24“

**Entscheidung des Inhabers (im Chat, 24.09.2026):** Bitrix24 soll das alleinige Betriebssystem werden und RO App ersetzen.

**Umgesetzt (Branch `claude/elegant-dijkstra-jdeqv9`, aufbauend auf `integration/bitrix-continuation-20260922` / Entwurf #248):** Neue Betriebsart `BOOKING_OPERATIONS=bitrix`, standardmäßig **aus**. Produktion bleibt unverändert auf `roapp`, bis der Inhaber die Umschaltung ausdrücklich freigibt.

In dieser Betriebsart gilt:

- Website-Buchungen und Fotoanfragen werden ausschließlich in die Bitrix-Warteschlange gestellt. Fotoanfragen werden wie im RO-Betrieb als Vorgang gespeichert und in Bitrix als „Individuelle Fotoanfrage“ angelegt statt nur im Website-Posteingang zu landen.
- Keine Aufträge mehr für Zoho, RO, Odoo oder Lexware, auch nicht bei Freigabe, Storno oder Abschluss (`bitrixLed` in `zoho-ops.ts`). Übrig gebliebene RO-/Zoho-Warteschlangeneinträge aus früheren Betriebsarten werden weder beim Sofortversand noch im minütlichen Job weiterverarbeitet.
- Der minütliche Job führt nur Kundenbenachrichtigungen, Terminerinnerungen und den Bitrix-Abgleich aus.
- `/api/ro-callback`, `/api/hub` und `/api/zoho-webhook` antworten mit 410, damit kein zweites System Buchungen ändert. `/api/bitrix-workshop` (signierter Rückkanal der Bitrix-App) bleibt aktiv. `/api/ro-photo` bleibt lesend für vorhandene RO-Fotolinks erreichbar.
- Freigabe, Bestätigungs-PDF, Abschluss und Rechnung laufen ausschließlich über die Bitrix-Werkstatt-App. Schreibaktionen der Altsysteme im Adminbereich (Website-Leitstand, Zoho inkl. manuellem Sync, Lexware, Odoo, RO, ERPNext, Hub-Token, Dokumente/Qonto, Lexware-Kundenmails, lokale Kundennotizen, Operator-PIN und Agentenbefehle) werden serverseitig abgewiesen (`legacyOperatorMiddleware`). Bitrix-Einstellungen, Website-Inhalte und Lesezugriffe bleiben nutzbar.
- Fotoanfragen enthalten nur eine Telefonnummer. In der Bitrix-App lassen sie sich ablehnen; eine Freigabe mit Bestätigungs-PDF oder Rechnung erfordert eine Kunden-E-Mail, also eine anschließende Buchung über das Website-Formular.
- Scheitert im Bitrix-Betrieb das Einreihen nachgereichter Fotos, erhält der Kunde eine Fehlermeldung statt einer scheinbar erfolgreichen Übertragung.

**In dieser Sitzung ausgeführt:** neue Tests „Bitrix-only operation queues Bitrix exclusively…“ und „phone-only inquiries can be rejected…“ ohne die jeweilige Änderung fehlgeschlagen, mit ihr bestanden. `npm test` 525/525 bestanden, `npm run typecheck` fehlerfrei, ESLint auf allen geänderten Dateien ohne Warnungen, `npm run build` erfolgreich. Nicht ausgeführt: `check:migrations`/`check:rls` (keine Migrationsänderung), `test:release`.

**Kontozugang:** keiner in dieser Sitzung. Portal-Angaben weiter oben bleiben „dokumentiert damals“.

**Umschaltung (nur mit ausdrücklicher Freigabe des Inhabers, nicht in dieser Arbeit ausgeführt):**

1. #248 und diese Änderung prüfen und zusammenführen.
2. Offene RO-Aufträge in RO abschließen oder manuell nach Bitrix übertragen. Es gibt keine automatische Übernahme von RO-Altaufträgen.
3. Gültigen Bitrix-Zugang unter `/admin/bitrix` hinterlegen (ein im Chat geteilter Schlüssel ist vorher zu widerrufen). Bitrix-Kalenderprüfung dort aktivieren.
4. Datensicherung, dann in `/etc/white-gloss/environment` `BOOKING_OPERATIONS=bitrix` setzen und den Dienst neu starten. Rückweg: Wert wieder auf `roapp` setzen.
5. A–I mit gekennzeichneten Testaufträgen nachweisen.

**Offen (A–I):** unverändert gegenüber den Abschnitten oben. Neu erfüllt ist nur die technische Voraussetzung, dass im Bitrix-Betrieb kein zweites System Aufträge anlegt oder ändert (Teil von D, G, I).

## Fortsetzung 24.09.2026 (2): Umschalt-Prüfung und Abnahmeprotokoll

**Stand `main`:** #249–#252 sind enthalten (über #252, bestätigt durch das identische Ergebnis von #253). GitHub Actions startet derzeit keine Runner (Kontolimit bzw. Abrechnung). Deshalb liefen weder CI noch der IONOS-Deploy, und die Live-Website hat diesen Stand noch nicht.

**Neu:** Unter `/admin/bitrix` gibt es die Schaltfläche „Bereitschaft prüfen“ (`bitrixCutoverReadiness`, nur lesend). Sie prüft:

- Betriebsart
- Bitrix-Zugang (Abruf genau eines Auftrags)
- Kalenderabgleich: Ist er aktiviert, wird der Werkstattkalender der nächsten sieben Tage mit dem aktuellen Zugang gelesen.
- verifiziertes Inhaberkonto
- E-Mail-Versand: Nur das Vorhandensein von `RESEND_API_KEY` und `MAIL_FROM`. Das bleibt deshalb ein Hinweis, bis der erste Testauftrag die Zustellung nachweist.
- fehlgeschlagene, prüfpflichtige oder mit Fehler wiederholte Bitrix-Übertragungen
- offene Buchungen ohne Bitrix-Auftrag

Die Prüfung führt nur SELECT-Abfragen aus (keine Schemaanlage, keine Einträge) und nur lesende Bitrix-Abfragen.

### Abnahmeprotokoll nach der Umschaltung

Voraussetzung: Die Umschalt-Prüfung zeigt keine ✗. Alle Testaufträge tragen im Namen „TEST“ und verwenden eine eigene E-Mail-Adresse des Inhabers. Rechnungen werden nur als Entwurf angelegt oder sofort storniert, damit keine produktiven Rechnungsnummern verloren gehen.

| Punkt | Vorgehen                                                                                             | Erwartet                                                                                                                                        |
| ----- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | Buchung mit Paket, Extra und zwei Fotos über `/#buchung`, danach Seite neu laden und erneut absenden | Genau ein Bitrix-Auftrag WG-…, beide Fotos am Auftrag, kein Duplikat                                                                            |
| B     | Auftrag in Bitrix nur in eine andere Phase ziehen, ohne App-Freigabe                                 | Keine Bestätigungs-PDF, keine Rechnung, keine Reservierung                                                                                      |
| C     | Freigabe in der Werkstatt-App mit geändertem Preis und „Kunde hat zugestimmt“                        | Bestätigungs-E-Mail mit PDF der richtigen Version. Die Unterschrift über die native Bitrix-Signatur ist gesondert zu prüfen (SMS-/E-Mail-Kanal) |
| D     | Zweite Freigabe im selben Zeitraum und ein manueller Termin im Bitrix-Kalender                       | Konflikt wird abgewiesen, die Website bietet die belegte Zeit nicht an                                                                          |
| E     | Termin in zwei Tagen freigeben, dann umbuchen und stornieren                                         | Erinnerungen an Kunde und Inhaber zwei Tage vorher; nach Umbuchung nur die neue, nach Storno keine                                              |
| F     | Abschluss einmal mit Barzahlung, einmal mit Überweisung                                              | Genau eine Rechnung je Auftrag; bar = bezahlt, Überweisung = sieben Tage Zahlungsziel                                                           |
| G     | Abschluss bzw. Rechnungsversand in der App ein zweites Mal auslösen                                  | Keine zweite Rechnung, keine zweite E-Mail                                                                                                      |
| H     | Allgemeine E-Mail an `info@` bzw. `buchung@` senden                                                  | Kein neuer Auftrag in Bitrix                                                                                                                    |
| I     | Während einer Buchung den Bitrix-Schlüssel kurz entfernen, dann wieder speichern                     | Buchung bleibt gespeichert, wird danach genau einmal übertragen                                                                                 |

Ergebnisse je Punkt mit Datum, Auftragsnummer und Befund hier nachtragen. Erst wenn A–I bestanden sind, gilt die Anbindung als vollständig.

## Fortsetzung 24.09.2026 (3): Live-Prüfung, Portal-Bereitschaft und Punkt H

**Live geprüft (nur lesend):** `POST /api/bitrix-workshop` → 410, `/api/zoho-webhook` → 410, `/api/hub` → 410, `/api/ro-callback` ohne Signatur → 400. `/admin/bitrix` leitet auf `web.roapp.io` um. Produktion läuft also mit `BOOKING_OPERATIONS=roapp`; Website-Buchungen erreichen Bitrix24 nicht. Im Portal b24-emfor7 ist WG-47 (19.09.2026) der letzte Website-Auftrag. VibeCode `/v1/me`: Schlüssel gültig, Tarif `demo` (Testzeitraum); Platzierungen benötigen laut VibeCode einen kommerziellen Tarif bzw. ein Marketplace-Abo.

**Umschalt-Skript:** Eine parallel entstandene Fassung von `scripts/cutover-bitrix-production.mjs` (Branch `claude/bitrix-cutover-script`) wurde nicht übernommen; maßgeblich ist die mit #256 gemergte Fassung (Prüflauf, `--list-open`, `--apply --open-ro=<n>` mit Sicherung, Healthcheck und automatischer Rücknahme). Der im Chat geteilte VibeCode-Schlüssel ist vor der Umschaltung zu widerrufen und durch einen neuen, nur auf dem Server eingetragenen Schlüssel zu ersetzen.

**Portal-Bereitschaft (lesend über VibeCode geprüft):** Alle 18 Produkt-IDs aus `DEFAULT_PRODUCT_MAP` existieren aktiv im Katalog (Preise wie auf der Website). Alle 19 `ufCrmWg*`-Felder, die `bitrix-sync.ts` schreibt, sind am Deal vorhanden. Die Phasen `EXECUTING` und `FINAL_INVOICE` in Pipeline 0 sind durch WG-45 bis WG-47 belegt. Vor der Bereinigung lagen im Portal 207 Deals, davon nur 3 Website-Deals (`sourceId=WEB`); der Rest waren aus E-Mails erzeugte Deals (`sourceId=EMAIL`, Phase `NEW`).

**Soll-Ablauf laut Inhaber (24.09.2026, abends) und Ist-Stand im Portal (lesend geprüft):** Website-Buchung mit Fotos → nur diese als Auftrag in Bitrix (keine allgemeinen E-Mails) → Freigabe durch Lars → feste Bestätigung an den Kunden inkl. Preisänderungen → digitale Kundenunterschrift → Termin fix → nach Abschluss Rechnung (7 Tage oder bar bezahlt) → 14 Tage später E-Mail mit Bitte um Google-Bewertung.
Ist: Pipeline-Phasen „Anfrage eingegangen → Prüfung und Angebot → Kundenzustimmung ausstehend → Termin bestätigt / in Arbeit → Dienstleistung abgeschlossen“ vorhanden. Automatisierungsregeln sind nur interne Standard-Benachrichtigungen/Anrufaufgaben an die verantwortliche Person; keine Trigger, kein Kundenversand, keine Signatur-, Rechnungs- oder Bewertungsregel. „Dokumente zum Unterschreiben“: 5 Entwürfe (WG-44/45), 0 gesendet, 0 unterschrieben. Google-Bewertungsmail existiert weder im Code noch im Portal.

**Punkt H im Portal erledigt (24.09.2026, mit ausdrücklicher Freigabe des Inhabers):** Postfach-Einstellungen geprüft: info@white-gloss.de hat keine CRM-Anbindung. buchung@white-gloss.de verknüpft nur E-Mails bekannter Kontakte und legt bei neuen Adressen **keinen** Lead an. Seit dem 14.09. ist kein Deal und kein Lead aus E-Mails entstanden. Die 204 E-Mail-Deals aus dem einmaligen Import vom 13.09. (`sourceId=EMAIL`, Phase `NEW`) wurden per REST in den CRM-Papierkorb verschoben (30 Tage wiederherstellbar). Übrig sind nur WG-45, WG-46, WG-47. Bei info@ ist „Kalendertermin für jede neue E-Mail“ jetzt ausgeschaltet (vorher an). Nach dem Neuladen geprüft. Der Nachweis per Test-E-Mail (Abnahmeprotokoll Punkt H) steht nach der Umschaltung noch aus.

## Fortsetzung 25.09.2026: Alte CRM-Anbindungen entfernen und PR #258 prüfen

**Auftrag:** Der Inhaber hat ausdrücklich bestätigt: „Ja, alte Anbindungen und CRM-Oberflächen entfernen“. Kundendaten und Belege bleiben erhalten. Keine Live-Daten wurden in dieser Sitzung gelöscht, keine Kundenmail oder Rechnung ausgelöst und keine Kontoeinstellung geändert.

**Git-Basis:** Frischer Checkout von `main` (`e61400364fefed5dc23e61fc891abe599bd9a8be`), Integrationsbranch `codex/bitrix-continuation-20260925`. PR #258 (`a90d9cf71b597105ad27b222cc66c5fc1abb4ed8`) lokal mit Mergecommit `27ce1b4` übernommen. #252/#253/#255/#256 sind bereits auf main. Kein Merge nach main und kein Produktionsdeployment.

**Review #258:** Der PostgreSQL-Job verwendete npm ohne vorheriges Node-Setup; Node 24 ergänzt. Der vorgeschlagene dauerhafte CI-Runner wäre außerdem für IONOS-Jobs mit produktivem SSH-Schlüssel wiederverwendet worden. Beide IONOS-Jobs bleiben deshalb auf frischen GitHub-Runnern; CI-Runner bleiben optional. Das Setup-Skript verwendet auf Ubuntu/Debian `runuser` statt des nicht garantiert installierten `sudo`. Die zuletzt gelesenen GitHub-Jobs scheiterten ohne ausgeführte Schritte; eine aktuelle Ursache auf Kontoebene ist damit nicht bewiesen. Keine Runner gekauft/installiert, keine Repository-Variablen geändert.

**Bereinigung:** RO App, Zoho, Odoo, ERPNext, Lexware, Qonto und Hub haben keine aktiven Website-Schreibadapter oder CRM-Oberflächen mehr. Alte Routen führen zu `/admin/bitrix`, alte Callback-/Operator-Endpunkte antworten unbedingt mit 410. Die alten Supabase-Edge-Funktionen einschließlich des ERP-Agenten enthalten nur noch 410-Antworten; sie sind nicht produktiv ausgerollt. Bereits wartende alte CRM-Mails werden mit `retired_crm` blockiert, nicht gelöscht oder nachträglich versendet. Der Cron verarbeitet nur die Website-Versandwarteschlange und Bitrix. Neue und bestätigte Anfragen erzeugen ausschließlich Bitrix-Jobs, auch bei einer veralteten Umgebungsvariable.

Gemeinsame Buchungs-, Zeit- und Dokumentenlogik heißt jetzt `booking-operations`, `booking-time`, `booking-documents`. Die Website behält öffentliche Formulare, Fotouploads, Statusseite und Inhaltsverwaltung. Bestehende SQL-Migrationen, Tabellen, Kundendaten, PDFs und lesende `/api/ro-photo`-Links bleiben erhalten. Die früheren reinen Adaptertests wurden zusammen mit den entfernten Funktionen ausgebaut; die weiter benötigten Buchungs-/Dokumenten-/Zeittests bleiben unter ihren neuen Namen erhalten. Ein Mobilfehler im Verwaltungskopf wurde durch erlaubten Zeilenumbruch behoben.

**Umschaltprüfung:** `BOOKING_OPERATIONS=bitrix` ist für dieses Release verpflichtend. Der trockene Umschaltlauf verlangt einen lesbaren, aktivierten Kalender, erfolgreiche Bitrix-Zuordnung sämtlicher offener Buchungen und leere offene Übertragungsqueues. HTTP 200 mit ungültigem JSON oder falscher Antwortstruktur gilt nicht mehr als erfolgreicher API-Zugriff. Nach Entfernung der Adapter benötigt ein Rückweg zwingend das vorherige Release, nicht nur einen anderen Umgebungswert. Keine automatische Übertragung der RO-Bestandsaufträge behauptet.

**Hier nachgewiesen:** `npm ci --ignore-scripts` erfolgreich, 460/460 Tests ohne Skips, TypeScript und ESLint erfolgreich (fünf bestehende Warnungen), Deno-Prüfung sämtlicher Edge-Funktionen und Skriptsyntax erfolgreich, Produktionsbuild erfolgreich. Isoliertes `test:release`: 5 SSR-Tests, 14 Buchungs-/Upload-/Versand-/Callback-Prüfungen, 4 Sitemap-Prüfungen erfolgreich. Provider sind dort simuliert, reale Außenanfragen gesperrt. Die Standardschnittstellen 8082/8099 waren belegt; QA unterstützt nun getrennte Ports und lief mit 19282/19299. Kein fremder Server wurde beendet. PostgreSQL-Migrations-, RLS- und historische ERPNext-SQL-Prüfung: **SKIP**, kein lokaler PostgreSQL-Server erreichbar. PGLite-Tests ersetzen diese PostgreSQL-Nachweise nicht.

**Live in dieser Sitzung, nur lesend:** `/admin/bitrix` der öffentlichen Website antwortet weiter mit 307 auf RO App. Im angemeldeten Portal stehen WG-45/46/47; WG-46 besitzt Produkte und einen Termin, aber weiterhin den ursprünglichen Anfragekommentar mit noch offener Arbeitsdauer. Die gefilterten Listen „Rechnungen in Arbeit“ und „Dokumente / In Arbeit“ sind für WG-46 leer. Die Automatisierung zeigt interne Benachrichtigungen/Anrufaufgaben, keine geprüfte Kunden-Signatur-, Rechnungs- oder Bewertungsregel. Die verknüpfte Erweiterung „neu“ (Platzierung 328) führt auf einen VibeCode-Server mit der ausdrücklichen Meldung „No app here yet“. Der Verwaltungslink verlangt eine separate Anmeldung; der Inhaber wurde darum gebeten. Der zuvor dokumentierte Demo-Tarif, die Vorlagenaktivierung sowie Steuer-/Bankdaten wurden hier nicht erneut geprüft.

**A–I weiterhin offen:** Die isolierten Tests stützen A, B, D, G und I technisch; kein vollständiger produktiver Nachweis. C: echte native Kundenunterschrift fehlt (das vorhandene `customerAccepted`-Feld ist keine Signatur). D: reale Kalender-/App-Kopplung und ggf. Reservierung während ausstehender Kundenzustimmung abnehmen. E: Erinnerungen/inhaltliche Vorbereitung und Bewertungsmail sind nicht aktiviert. F/G: native Rechnung je Zahlungsart samt Wiederholung erst mit vorhandener App und freigegebenem Test nachweisen. H: heutige Testmail nicht ausgeführt; historische Portalbereinigung nicht wiederholt. Vor Live-Umschaltung: VibeCode-Anmeldung, bestehende App wiederherstellen, offenen RO-Bestand prüfen/übernehmen, Rechnung/Signatur/Kalender fachlich abnehmen, dann Sicherung und ausdrückliche Live-Freigabe.

## Verbindliche Präzisierung 25.09.2026: natives Bitrix24 ohne App

Der Inhaber hat die App-Wiederherstellung ausdrücklich verworfen: vollständige direkte Integration des vorhandenen Website-Buchungssystems, ohne Zwischendienst. Diese Präzisierung ersetzt die App-/VibeCode-Voraussetzungen der älteren Abschnitte. Kein VibeCode-Deployment erfolgt. Die vorhandene Quellsicherung wurde lediglich gelesen; keine App, Cloud-Ressource oder bestehende Kundendaten wurden gelöscht.

**Implementiert:** VibeCode-Proxy/AI-Router und Werkstatt-App-Brücke entfernt (Brückenroute 410). Ausschließlich native REST-URLs zulässig. Formulardaten und Produktpositionen werden für die Erstübertragung gespeichert; Kontakt über E-Mail zugeordnet und mit dem Auftrag verknüpft. Mehrdeutige Kontakte werden angehalten. Fehlende native Buchungsfelder verhindern eine Anlage mit stillschweigend verlorenen Angaben. Nach Übergabe bleiben native Preise, Leistungen, Phasen, Rechnungen und Termine maßgeblich: erneute Queue-Läufe verändern sie nicht. Nachgereichte Fotos ergänzen bestehende native Dateien und werden einzeln im Journal wiedererkannt. Unklare Schreibantworten führen zur Prüfung statt zu einer zweiten Anlage. Migration 0021 ergänzt Journalspalten, ohne Daten zu löschen. Kundenstatus liest den nativen zugeordneten Auftrag; Verfügbarkeit liest den nativen Kalender ohne alte lokale Reservierungen. Die Website sendet nur die Eingangsbestätigung an Kunden, keine veralteten lokalen Freigaben/Rechnungen.

**Heute live und nur lesend geprüft:** Bestehender eingehender Webhook „White-Gloss“, Integration 24, im Portal b24-emfor7. crm.deal.fields antwortet erfolgreich; alle verwendeten UF_CRM_WG-Felder sind vorhanden, Fotos sind ein Mehrfach-Dateifeld. calendar.event.get für Nutzer 1/Kalender 2 vom 25.09.–02.10. liefert Termin 1108. Keine Zugänge erzeugt, keine Rechte oder Geschäftsdaten verändert. Die Portal-Anmeldung genügte hierfür; eine VibeCode-App ist nicht erforderlich.

**Live gefundener Zeitfehler:** Der Termin steht nativ auf 25.09.2026 11:00–17:00 Europe/Berlin mit Offset 7200, während die DATE_FROM_TS_UTC/DATE_TO_TS_UTC-Hilfswerte 06:00–12:00 UTC ergeben. Der neue Leser verwendet deshalb die echte lokale Terminzeit samt geprüftem Zeitzonenoffset (korrekt 09:00–15:00 UTC). Der reale anonymisierte Antwortausschnitt ist als Regressionstest enthalten. Nicht aufgelöste Serienregeln, falsche Zeitzonen, ungültige Daten und unvollständige Antworten führen zu einer gesperrten Verfügbarkeit. Serienfall-Abnahme steht noch aus.

**Verbleibend vor Produktivfreigabe:** Serverzugang/geschütztes Hinterlegen des vorhandenen REST-Webhooks, tatsächlichen aktuellen Release-Stand nachweisen, offene RO-Bestandsaufträge zuordnen, PostgreSQL-Migration/RLS prüfen und Website sowie stillgelegte Edge-Endpunkte ausrollen. Anschließend ausdrücklich freigegebene Testbuchung mit zwei Fotos, Wiederholung, Nachreichen eines Fotos und nativer Preis-/Terminänderung abnehmen. Native Signatur, Freigabe-E-Mail, Erinnerungen, Rechnungszahlung und Bewertungsmail sind weiterhin nicht vollständig eingerichtet oder live nachgewiesen. Die historischen App-Schritte C/F/G der Prüfmatrix sind durch native Bitrix-Bedienung zu ersetzen.

### Abschlussprüfung der direkten Anbindung, 25.09.2026

457/457 Tests bestanden, TypeScript und ESLint bestanden (fünf bestehende Warnungen), Produktionsbuild und isoliertes test:release bestanden: 5 SSR-, 14 Ablauf- und 4 Sitemap-Prüfungen. Deno-Funktionen und Skriptsyntax ebenfalls in dieser Sitzung bestanden. PostgreSQL-Migration, RLS und historische ERPNext-SQL-Prüfung bleiben ausdrücklich SKIP mangels lokalem PostgreSQL. Die isolierten Provider-Tests sind kein Nachweis produktiver Bitrix-Schreibvorgänge.

Eine unabhängige Gegenprüfung hat drei Fehler reproduziert und ihre Behebung bestätigt: Alle sechs erlaubten Medienformate JPEG/PNG/WebP/MP4/WebM/MOV werden geladen; null/leere/boolsche Preise werden nicht als null Euro ausgegeben; ein während der Übertragung eintreffender weiterer Upload bleibt durch einen atomaren Revisionszähler vorgemerkt und wird im nächsten Lauf genau einmal ergänzt. Der dritte Wiederholungslauf erzeugt keinen weiteren Upload. Ein Auftrag in EXECUTING ohne gültigen bestätigten Zeitraum bleibt „In Bearbeitung – Termin noch offen“. Nicht nachgewiesene Signatur-Link-Versprechen im öffentlichen Formular und auf der Dankeseite entfernt; das vorhandene optionale E-Mail-Feld bleibt unverändert.

Im echten Browser ist die reduzierte lokale Verwaltung mit 375 × 812 Pixeln ohne horizontales Überlaufen geprüft. Die öffentliche Formularprüfung fand drei Schritte und den korrekten Beispielpreis 318 Euro (149 + 119 + 50), ohne Absenden. Der native Datumsauswahldialog konnte in dieser unabhängigen Browserprüfung nicht abgeschlossen werden; deshalb keine vollständige Browser-Kalenderabnahme behauptet. Produktiv führt /admin/bitrix weiterhin zu RO App.

Der Inhaber hat für die noch einzurichtende native Kundenerinnerung zwei Kalendertage vor dem Termin diesen Vorbereitungstext bestätigt: „Bitte räumen Sie Ihr Fahrzeug vor der Abgabe aus und entfernen Sie persönliche Gegenstände sowie Wertsachen – auch aus dem Kofferraum.“ Der Text ist damit festgelegt; es wurde keine Erinnerungsregel aktiviert und keine reale Kundenmail versendet. Der vorher offene Inhalt ist kein Blocker mehr.

**PR und CI:** Draft-PR #259 enthält den geprüften Stand dcb67731770e7ca66b5cbe49548df95e69bbfd79. Der GitHub-Lauf 36074939468 wurde am 25.09.2026 auf der öffentlichen Run-Seite geprüft: Sowohl schema als auch verify melden ausdrücklich „The job was not started because your account is locked due to a billing issue.“ Damit ist die Kontosperre wegen Abrechnung als CI-Startblocker belegt; keine der GitHub-Prüfungen ist ausgeführt worden. Keine Zahlung, Kontoänderung oder Installation eines Ersatzrunners vorgenommen. Der Inhaber öffnet die IONOS-Serverkonsole für die zunächst lesende Bestandsprüfung.

**PostgreSQL-Nachweis nachgeholt:** Die zuvor genannten lokalen SKIPs sind für diesen Stand geschlossen. PostgreSQL 16.15 (portable offizielle EDB-Binaries 16.15-4 x64), frische Instanz ausschließlich auf 127.0.0.1, PGCLIENTENCODING=UTF8. Unveränderte Skripte check-migrations.sh (39 Migrationen), check-rls.sh (52 Zugriffsprüfungen) und check-erpnext-operational-approval.sh einschließlich Zwei-Sitzungs-Race jeweils Exit 0. Zusätzlich alle 22 migrations/*.sql auf einer separaten leeren Datenbank ausgeführt; vor 0021 zwei künstliche Bestandsbuchungen und Übertragungszustände eingefügt. Preise und Buchungszahl bleiben erhalten, neue Queue-Defaults und die bewusste Prüfpflicht alter Fotozuordnungen stimmen, wiederholte Anwendung von 0021 bestanden. Testserver anschließend geordnet beendet, temporäre Passwortdatei entfernt. Keine Produktionsdaten verwendet. Vollständiges Protokoll und reproduzierbares Harness wurden in der unabhängigen lokalen Gegenprüfung gelesen.

Der abschließende vollständige lokale Prüflauf (verify-gates.KGu6UZ) hat lint, typecheck, functions, 457 Tests, syntax, build und qa bestanden. npm audit --omit=dev --audit-level=moderate meldet null Schwachstellen. Die kurze Serverdiagnose zeigt jetzt auch den neuen nativen Webhook-Konfigurationsnamen korrekt an; ihr Geheimnisschutz ist in neun Diagnose-Tests geprüft.

**IONOS-Zugang:** Anmeldung, Serverübersicht und eingeschalteter Ubuntu-24.04-VPS bestätigt. Die ursprünglichen Remotekonsolenfenster erschienen verzögert und zeigen eine bestehende Linux-Sitzung. Ein direkt neu geöffnetes Wrapper-Ziel zeigte zuvor nur „Not found“; das war kein belastbarer Nachweis eines Serverausfalls. Die automatisierte Tastaturweiterleitung konnte bislang nicht verifiziert werden. Deshalb weiterhin kein aktueller Release-/Queue-Nachweis aus der laufenden Instanz, kein Backup, kein Dienstneustart und keine Umschaltung in dieser Sitzung.

## Fortsetzung 25.09.2026: Serverzugriff und tatsächlicher Umschaltweg

Nach erneuter Aufforderung zum vollständigen Abschluss ist die Remote-Konsole mit erneuerter Tab-Bindung, Options → Toggle inputs und einzelnen Tastendrücken bedienbar. Der laufende Release-Pfad ist /srv/white-gloss-releases/7a6407c3947bea7b585d58edad483982ef5093f1 (PR #248 vom 24.09.). white-gloss.service ist active, arbeitet unter deploy und verwendet /srv/white-gloss-current. Bisher keine App-/Datenbankänderung und kein Dienstneustart; lediglich eine gesicherte temporäre Änderung der Konsolenschrift sowie ein temporäres Diagnoseskript.

Im Cutover-Prüflauf wurde ein bislang nicht abgedeckter Orchestrierungsfehler korrigiert: inspect() übersprang den Kalender ausgerechnet für gültige native Webhooks. Die neue Regression prüft die tatsächliche Folge crm.deal.list → calendar.event.get; alle neun Cutover-Tests und anschließend sämtliche 458 Tests sowie Lint, TypeScript, Deno, Syntax, Build und isoliertes Release-QA sind bestanden. Der alte laufende Stand liest nur VIBE_API_KEY, nicht BITRIX_WEBHOOK_URL. Deshalb darf ein gemeinsamer Code-/Konfigurationswechsel nicht über den bloßen Konfigurationsschalter mit zwischenzeitlichem Altcode-Neustart erfolgen. Der konkrete Datenbestand und die gemeinsame Aktivierung/Rücknahme werden vor der Veröffentlichung geprüft.

## Fortsetzung 25.09.2026: Produktionsinventur und sichere Vorbereitung

PR #259 wurde um 00:27 UTC als `82f4f8641298991cc63aab130093f55b12736c10` zusammengeführt. Der Baum ist identisch mit dem geprüften Stand `4f3d9d0`. Die laufende IONOS-Version bleibt `7a6407c3947bea7b585d58edad483982ef5093f1`; es gab keine Aktivierung, Migration oder CRM-Schreibaktion.

Die rein lesende Produktionsprüfung weist drei Buchungen, neun Kunden und drei Medien nach. Alle drei Buchungen sind lokal noch offen und mit RO App synchronisiert; es gibt keine Bitrix-Queuezuordnung. Native Webhook-Konfiguration fehlt im aktiven Environment, der gespeicherte alte Panel-Schlüssel ist kein nativer Webhook, der Bitrix-Kalender ist deaktiviert. Migrationen 0015, 0016, 0017, 0018 und 0021 fehlen im Register; Tabellen können bereits durch frühere Laufzeitinitialisierung vorhanden sein. Kein erkannter Kapazitätskonflikt.

Ein vollständiger PostgreSQL-Dump (202744 Bytes) wurde mit `archiveListValid=true` geprüft. Geschützte Sicherungen der Umgebung und des bisherigen Releasepfads liegen daneben; private Medien im vorhandenen Bucket bleiben erhalten. Der Server-Build und das isolierte Release-QA im separaten Opsverzeichnis sind erfolgreich; kein Produktionsdienst wurde dafür verändert.

`stage-bitrix-environment.mjs` erstellt ausschließlich eine separate Datei mit Modus 0600, ersetzt nur Betriebsmodus und nativen Webhook und verweigert Überschreiben sowie ungültige Schlüssel. Drei gezielte Prüfungen und der vollständige Verifikationslauf mit 461 Tests, Lint, Typecheck, Funktionen, Syntax, Build und isolierter QA bestanden. `inspect-bitrix-legacy-handoff.mjs` liest alte Aufträge und Positionen sowie native Referenz-/Titelkandidaten; sein detaillierter Übergabenachweis enthält private Daten und wird ausschließlich geschützt auf dem Server gespeichert. Keine Import- oder Aktivierungsfunktion ist darin enthalten.

Zusätzlicher Live-Blocker: GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET sind beide nicht im aktiven Environment gesetzt. Vor Aktivierung eines Builds ohne eingebettete CI-Werte muss die bestehende Google-Anmeldung gesichert übernommen werden. Es wurde kein neuer Schlüssel erstellt und kein Kontozugang erweitert. Der vorhandene Bitrix-Webhook wurde verdeckt in einer separaten privaten Datei auf dem Website-Server bereitgestellt, noch nicht aktiviert.

Native Automatisierung erneut nur lesend geprüft: Signaturregel vorhanden, Vorlagenauswahl zeigt frühere Auftragsdokumente; der ungespeicherte Regelentwurf wurde vollständig verworfen. Laut offizieller Dokumentation sendet diese Regel vorrangig SMS, was keine nachgewiesene E-Mail-Signaturlösung ist: https://helpdesk.bitrix24.de/open/24309644/. Native Kundenkommunikation, Rechnung und Altbestandsübernahme bleiben vor einer vollständigen Abnahme offen.

### Kombinierter Code-/Umgebungswechsel vorbereitet, 25.09.2026

**Plattform-Nachtrag:** Die Gegenprüfung fand zunächst aus der Windows-CRLF-Arbeitskopie abgeleitete SQL-Hashes. Die fünf Konstanten entsprechen jetzt nach separat ausgeführtem `git show 4f3d9d0:migrations/<Datei>`-Bytevergleich den unveränderten LF-Git-Blobs des geprüften Ausgangsstands. Keine SQL-Inhaltsänderung und keine Normalisierung während der Anwendung. Ein zusätzlicher Regressionstest verlangt LF und lehnt dieselbe Datei mit CRLF strikt ab; 47/47 gezielte Tests bestanden. Der integrierende Hauptauftrag setzt entsprechend `migrations/*.sql text eol=lf` in `.gitattributes`, damit frische Windows-Checkouts dieselben Bytes verwenden.

**Diagnose-Nachtrag:** Bei verändertem Bestand nennt der Helfer jetzt das betroffene Prüffeld und gegebenenfalls die geänderten Tabellennamen, ohne Zeilen, Werte oder Hashes auszugeben. Lease-/Heartbeat-Tabellen werden weiterhin vollständig verglichen; keine Ausnahme für scheinbar harmlose Schreibvorgänge. Nach diesem Zusatz bestehen 46/46 gezielte Tests und die separate Skript-Lintprüfung. Die unten genannten 501 Volltests und Build-/QA-Nachweise stammen aus der vorausgehenden Prüfung. Eine nachträgliche Übernahme fehlender Google-OAuth-Konfiguration ist eine gesonderte Änderung; die Umgebungs-Whitelist wurde dafür nicht erweitert.

`scripts/cutover-bitrix-release.mjs` und `cutover-bitrix-runtime.mjs` sind ein gesonderter Helfer für den ersten Wechsel von RO App auf das geprüfte native Release. Ohne `--apply` erfolgen ausschließlich lesende Prüfungen. Er ruft weder den alten Konfigurationsschalter noch `deploy-ionos-release.sh activate` auf. Keine Geschäftsdatenübernahme und keine native Automatisierung werden damit eingerichtet.

Voraussetzungen: vollständiger geprüfter Operations-Checkout samt `pg`, rootgeschützte Dateien/Verzeichnisse (auch ein root-eigener privater Unterordner unter sticky `/var/tmp` ist möglich); beide Releases unter `/srv/white-gloss-releases/<40-stellige SHA>` unveränderlich für den Laufzeitbenutzer; root-eigene vorbereitete Umgebung unter `/etc/white-gloss/`, Modus 0600. Nur `BOOKING_OPERATIONS` und `BITRIX_WEBHOOK_URL` dürfen sich von der bisherigen Umgebung unterscheiden. Native CRM-/Kalenderproben müssen gelingen, sämtliche offenen RO-/Bitrix-Zuordnungen und Übertragungsqueues müssen geklärt sein. Die offenen nativen Aufträge werden zusätzlich mit `crm.deal.get` auf passende Auftrags-ID, Kontakt-ID und `UF_CRM_WG_BOOKING_REF` geprüft. Der Helfer erzeugt fehlende Zuordnungen nicht selbst.

Aus dem bereits geprüften Build im Operations-Checkout den portablen Inhaltsdigest bestimmen; diesen Wert beim separaten Staging unverändert als Erwartungswert behalten. Ein erst aus einem unbekannten Zielrelease berechneter Digest ist kein Herkunftsnachweis:

```bash
node --input-type=module -e "import {outputDigest} from './scripts/cutover-bitrix-runtime.mjs'; console.log(await outputDigest('.output'));"
```

Lesende Prüfung mit der tatsächlichen veröffentlichten Quell-SHA und dem Digest dieses Builds (Platzhalter vor Ausführung ersetzen):

```bash
node scripts/cutover-bitrix-release.mjs \
  --target-release=<40-stellige-SHA> \
  --target-output-sha256=<64-stelliger-Builddigest> \
  --prepared-env=/etc/white-gloss/bitrix-20260925.environment
```

Nur nach konkreter Freigabe denselben Aufruf um `--apply --open-ro=<bestätigte-Anzahl>` ergänzen. Weitere bekannte `white-gloss-*.service`/`.timer` jeweils über `--writer-unit=<Name>` angeben. Unbekannte Website-Units oder passende Cron-Aufrufe blockieren den Wechsel; globale Cron-Dienste werden nicht angehalten. Alle anderen Veröffentlicher müssen denselben Kernel-Lock `/run/white-gloss-deploy.lock` beachten; ältere Helfer ohne diesen Lock dürfen währenddessen nicht laufen.

Die Anwendung hält zuerst sämtliche erfassten Website-Writer an. Vorher/nachher werden Umgebungen, Releaseinhalte, Migrationsdateien, Cron-/Unitbestand, offene Anzahl, native Identitäten und ein Fingerprint aller öffentlichen Datenbanktabellen verglichen. Erst danach: geprüftes `pg_dump`-Archiv samt SHA256 und `pg_restore --list`, verifizierte private Sicherung beider Umgebungen sowie alter/neuer Release-ID und ursprünglicher Dienstzustände. Nur noch fehlende, unverändert geprüfte kompatible SQL-Dateien 0015–0018 und 0021 sind erlaubt. Die Migrationen können additive Journal-/Metadatenänderungen durchführen; Kundendaten werden nicht automatisch zurückgesetzt. Die PostgreSQL-Sicherung enthält keine extern in Supabase gespeicherten Fotodateien.

Während alle Writer stehen, werden Umgebung und Releaseverweis ersetzt. Konfigurations-/Schemaprüfung, Inhaltsprüfung, lokaler HTTP-Healthcheck und tatsächliches Arbeitsverzeichnis des laufenden Prozesses prüfen das Ziel. Nur `white-gloss.service` startet; Hintergrunddienste bleiben bis zur getrennten Abnahme angehalten. Sie werden nicht dauerhaft deaktiviert, ein Neustart des Servers ist deshalb vor dieser Abnahme ausgeschlossen.

Bei einem abfangbaren Fehler: Writer stoppen, Kompatibilität des bisherigen Schemas prüfen, ursprüngliche Umgebung **und** vorheriges kompatibles Release wiederherstellen und prüfen, dann nur zuvor aktive Dienste starten. Keine automatische Datenbankrücknahme. Falls die Wiederherstellung nicht vollständig gelingt, bleiben die Writer angehalten und `requiresOperator=true` wird ausgegeben. Zwei Dateiumbenennungen sind keine gemeinsame Dateisystemtransaktion: SIGKILL/Stromausfall erfordern manuelle Wiederherstellung anhand der privaten Sicherung und `cutover-state.json`, bevor Dienste wieder anlaufen. Unveränderte öffentliche Ausgabe enthält keine Verbindungsdaten, Schlüssel, Kundendaten oder rohen Providerfehler.

**Lokal geprüft, nicht auf dem Produktivserver ausgeführt:** vollständiger Lauf 501/501 Tests, anschließend 45/45 gezielte Cutover-Tests einschließlich ergänzter nativer Identitätsprüfung; TypeScript und ESLint erfolgreich (fünf bestehende Warnungen), neue Skripte separat mit ESLint geprüft, Produktionsbuild erfolgreich, isoliertes Release-QA mit SSR/Abläufen/Sitemap erfolgreich. Die Betriebssystemaufrufe werden in den Fehlerprüfungen ersetzt; ein echter Linux-/systemd-Cutover ist damit noch nicht nachgewiesen. Die bereits separat belegten PostgreSQL-Migrations-/RLS-Prüfungen bleiben unverändert. Gezielte Tests decken Sicherungsfehler, Veränderungen nach Stoppen, Migrationsfehler, Fehler vor/nach Umbenennen, Healthcheckfehler, unterbrochene Rücknahme und fehlende Geheimnisausgabe ab.
