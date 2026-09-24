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

| Nachweis | Stand dieser Arbeit |
| --- | --- |
| A: Buchung mit mehreren nutzbaren Fotos, keine Doppelanlage | Code teilweise geprüft; kein vollständiger Praxistest |
| B: Keine Annahme/Rechnung ohne persönliche Freigabe | Bestehender Ablauf nur teilweise geprüft; Kontoregeln offen |
| C: E-Mail, echte Kundenunterschrift, richtige Version und Rückmeldung | Kontozugang und native Kanalprüfung fehlen; nicht eingerichtet |
| D: Gleiche Leistungen/Preise/Termine und konkurrierende Reservierung | Keine vollständige systemübergreifende Abnahme |
| E: Zwei-Tage-Erinnerungen, Umbuchung, Storno, kurzfristige Termine | Nicht praktisch geprüft; Vorbereitungstext von Lars fehlt weiterhin |
| F: Genau eine Rechnung, tatsächliche Barzahlung oder sieben Tage Überweisung | Nur der begrenzte REST-Statusadapter geprüft; Rechnungs-/Zahlungsprozess offen |
| G: Keine zweite Rechnung durch erneute Fertigmeldung oder Versand | Adapter erzeugt keine Rechnung; Ende-zu-Ende-Nachweis offen |
| H: Allgemeine E-Mail erzeugt keinen Auftrag, Antwort korrekt zugeordnet | Tatsächliche Postfachregeln unzugänglich; nicht eingerichtet |
| I: Ausfall/Wiederaufnahme ohne Datenverlust/Duplikate | Einzelner Adapterfehler geprüft; gesamte Zustellung nicht abgenommen |

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
- `src/components/configurator.tsx`: `main`s Buchungsentwurf-Persistenz (`useBookingDraft`) und Slot-Sperrlogik beibehalten statt PR #195s paralleler Neufassung – letztere nahm eine andere, unbestätigte Kapazitätsannahme an (blockiert nur wenn *beide* Ressourcen belegt, statt bei jeder Überschneidung). Diese Annahme wurde nicht stillschweigend übernommen. `booking-slot-availability.ts` bleibt als unverdrahtete Zusatzdatei erhalten. Ein zusätzlicher, nicht in Konfliktmarkierungen sichtbarer Fehler (`setAvailability` statt `setAvailabilityState`, verwaist aus PR #195s entfernter State-Variable) wurde beim Typecheck gefunden und auf `main`s ursprüngliches `onChange` zurückgesetzt.
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

| Punkt | Vorgehen | Erwartet |
| --- | --- | --- |
| A | Buchung mit Paket, Extra und zwei Fotos über `/#buchung`, danach Seite neu laden und erneut absenden | Genau ein Bitrix-Auftrag WG-…, beide Fotos am Auftrag, kein Duplikat |
| B | Auftrag in Bitrix nur in eine andere Phase ziehen, ohne App-Freigabe | Keine Bestätigungs-PDF, keine Rechnung, keine Reservierung |
| C | Freigabe in der Werkstatt-App mit geändertem Preis und „Kunde hat zugestimmt“ | Bestätigungs-E-Mail mit PDF der richtigen Version. Die Unterschrift über die native Bitrix-Signatur ist gesondert zu prüfen (SMS-/E-Mail-Kanal) |
| D | Zweite Freigabe im selben Zeitraum und ein manueller Termin im Bitrix-Kalender | Konflikt wird abgewiesen, die Website bietet die belegte Zeit nicht an |
| E | Termin in zwei Tagen freigeben, dann umbuchen und stornieren | Erinnerungen an Kunde und Inhaber zwei Tage vorher; nach Umbuchung nur die neue, nach Storno keine |
| F | Abschluss einmal mit Barzahlung, einmal mit Überweisung | Genau eine Rechnung je Auftrag; bar = bezahlt, Überweisung = sieben Tage Zahlungsziel |
| G | Abschluss bzw. Rechnungsversand in der App ein zweites Mal auslösen | Keine zweite Rechnung, keine zweite E-Mail |
| H | Allgemeine E-Mail an `info@` bzw. `buchung@` senden | Kein neuer Auftrag in Bitrix |
| I | Während einer Buchung den Bitrix-Schlüssel kurz entfernen, dann wieder speichern | Buchung bleibt gespeichert, wird danach genau einmal übertragen |

Ergebnisse je Punkt mit Datum, Auftragsnummer und Befund hier nachtragen. Erst wenn A–I bestanden sind, gilt die Anbindung als vollständig.
