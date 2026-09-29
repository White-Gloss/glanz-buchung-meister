# RO App: Integrationsstatus und Nachweise

Stand 29.09.2026. Ergänzt die lokalen Betreibernachweise (`outputs\RO-App-*.md/json`), die außerhalb des Repositories liegen und dort nachzuziehen sind. Keine Zugangsdaten, Kundendaten oder Bankdaten.

## Verifiziert

| Punkt                                                                                               | Nachweis                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aktiver Release                                                                                     | „Deploy to IONOS VPS“ #269 (29.09.2026 01:03 UTC): `a119b8a` (Merge von PR #272) atomar aktiviert, Live-Smoke alle Prüfpunkte PASS, keine Rückrollung, aktive Release-ID bestätigt.                                                                                                                                                                                                       |
| Produktions-Smoke danach                                                                            | „Production Smoke“ #470 und „Live Visual Check“ #6 für `a119b8a`: erfolgreich.                                                                                                                                                                                                                                                                                                            |
| Serverzustand (read-only Inventur #270, 01:12 UTC)                                                  | `current_release=a119b8a`, Dienst aktiv seit 01:03:28 UTC, 0 Neustarts, lokal HTTP 200; Automations-Timer aktiv, letzter Lauf 01:12:02 UTC erfolgreich (Exit 0, Antwort `ok:true`) – Erinnerungs-, RO- und Rechnungslauf laufen auf dem neuen Stand fehlerfrei. Umgebungswerte sind für die Inventur nicht lesbar; Rechnungsautomatik daher nicht als aktiv nachgewiesen (Standard: aus). |
| RO-Umschaltung, Migration 0022, Webhook, Kalender, Übertragung, Erinnerung/Bewertung, Versanddomain | Laut Betreibernachweis vom 29.09.2026; in dieser Sitzung nicht erneut live geprüft (kein Netzzugang zu white-gloss.de und api.roapp.io aus der Cloud-Umgebung).                                                                                                                                                                                                                           |

## Umgesetzt und isoliert getestet (dieser Stand)

- Rechnung aus RO-Positionen nach „Erledigt“, lückenlose Nummer, PDF, E-Mail-Versand, Zahlungsstatus nur durch erfasste Zahlung, Quittung bei Barzahlung, Doppelrechnungsschutz, Inhaberhinweise. Standardmäßig ausgeschaltet.
- Kontaktänderungen aus RO, fehlende E-Mail, Umbuchung, Storno, RO-Fehler.
- `src/lib/roapp-process.test.ts`: kompletter Ablauf Anfrage → Fixpreis → Annahme (RO-Fixture) → Termin → Erinnerung → Abschluss → Rechnung → Teil-/Restzahlung bar mit Quittungen → Bewertung nach sieben Tagen, plus Fehlerfälle, Review-Folgefälle (strenge Kontaktdaten, nachträglich ergänzte E-Mail, Stichtagsnachweis, pausierte Automatik, Migrationsvermerk). `npm test`: 599/599 bestanden; Lint 0 Fehler; Typprüfung und Produktions-Build bestanden; GitHub-CI (verify, schema, CodeQL, Lighthouse) auf PR #272 grün.
- Veröffentlicht über den freigegebenen Weg: PR #272 → `main` (`a119b8a`) → „Deploy to IONOS VPS“ #269.

## Offen

1. Rechnungsautomatik im IONOS-Server-Environment aktivieren (Bankdaten, `ROAPP_INVOICE_FROM`); nur mit Betreiberzugang möglich.
2. Live-Format von `GET /orders/{id}/items` und `GET /contacts/people/{id}` inkl. Adressfeld am ersten echten Auftrag bestätigen.
3. Eigener Absender für native RO-Angebotsmails (RO-Einstellung + DNS).
4. Durchgängiger Live-Nachweis mit echtem Auftrag, echter Kundenunterschrift, Rechnung und tatsächlicher Zahlung.

Der Gesamtprozess gilt erst nach Punkt 1–4 als fertig.
