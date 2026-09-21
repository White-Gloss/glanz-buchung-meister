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
