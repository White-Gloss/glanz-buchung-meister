# RO App: Integrationsstatus und Nachweise

Stand 29.09.2026. Ergänzt die lokalen Betreibernachweise (`outputs\RO-App-*.md/json`), die außerhalb des Repositories liegen und dort nachzuziehen sind. Keine Zugangsdaten, Kundendaten oder Bankdaten.

## Verifiziert

| Punkt                                                                                               | Nachweis                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aktiver Release                                                                                     | GitHub-Lauf „Deploy to IONOS VPS“ #263 (28.09.2026 22:39 UTC): `9b42bbd` atomar aktiviert, vorher `77d3272` (gleicher Quellbaum), Live-Smoke bestanden (alle Prüfpunkte PASS), aktive Release-ID bestätigt. |
| Produktions-Smoke danach                                                                            | „Production Smoke“ #463 für `9b42bbd`: erfolgreich.                                                                                                                                                         |
| RO-Umschaltung, Migration 0022, Webhook, Kalender, Übertragung, Erinnerung/Bewertung, Versanddomain | Laut Betreibernachweis vom 29.09.2026; in dieser Sitzung nicht erneut live geprüft (kein Netzzugang zu white-gloss.de und api.roapp.io aus der Cloud-Umgebung).                                             |

## Umgesetzt und isoliert getestet (dieser Stand)

- Rechnung aus RO-Positionen nach „Erledigt“, lückenlose Nummer, PDF, E-Mail-Versand, Zahlungsstatus nur durch erfasste Zahlung, Quittung bei Barzahlung, Doppelrechnungsschutz, Inhaberhinweise. Standardmäßig ausgeschaltet.
- Kontaktänderungen aus RO, fehlende E-Mail, Umbuchung, Storno, RO-Fehler.
- `src/lib/roapp-process.test.ts`: kompletter Ablauf Anfrage → Fixpreis → Annahme (RO-Fixture) → Termin → Erinnerung → Abschluss → Rechnung → Teil-/Restzahlung bar mit Quittungen → Bewertung nach sieben Tagen, plus Fehlerfälle. `npm test`: 596/596 bestanden; Lint 0 Fehler; Typprüfung und Produktions-Build bestanden.

## Offen

1. Rechnungsautomatik im IONOS-Server-Environment aktivieren (Bankdaten, `ROAPP_INVOICE_FROM`); nur mit Betreiberzugang möglich.
2. Live-Format von `GET /orders/{id}/items` und `GET /contacts/people/{id}` inkl. Adressfeld am ersten echten Auftrag bestätigen.
3. Eigener Absender für native RO-Angebotsmails (RO-Einstellung + DNS).
4. Durchgängiger Live-Nachweis mit echtem Auftrag, echter Kundenunterschrift, Rechnung und tatsächlicher Zahlung.

Der Gesamtprozess gilt erst nach Punkt 1–4 als fertig.
