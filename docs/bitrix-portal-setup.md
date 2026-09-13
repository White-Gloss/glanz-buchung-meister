# White-Gloss: Bitrix-Einrichtung, Stand 13.09.2026

Dieser Stand ist eine Teileinrichtung. Der vollständige Ablauf von der Anfrage bis
zur bezahlten Rechnung ist noch nicht zur Nutzung in der vorhandenen Bitrix-App
freigegeben. Es wurden keine Kundenmails, Rechnungen oder Zahlungen ausgelöst.

## Im Portal eingerichtet und zurückgelesen

Portal: `b24-emfor7.bitrix24.de`. CRM-Pipeline: Kategorie 0.
Die vorhandenen Status-IDs bleiben erhalten; bestehende Aufträge wurden nicht verschoben.

| Status-ID | Bezeichnung |
| --- | --- |
| NEW | Anfrage eingegangen |
| PREPARATION | Prüfung und Angebot |
| PREPAYMENT_INVOICE | Kundenzustimmung ausstehend |
| EXECUTING | Termin bestätigt / in Arbeit |
| FINAL_INVOICE | Dienstleistung abgeschlossen |
| WON | Auftrag abgeschlossen |
| LOSE | Anfrage abgelehnt |
| APOLOGY | Auftrag storniert |

Eigenes Unternehmen: `White-Gloss Detailing – Lars Hägele`, Unternehmen-ID 2,
`isMyCompany=true`, E-Mail `info@white-gloss.de`, Website `https://white-gloss.de`.
Steuer- und Bankangaben wurden nicht erfunden oder aus Testrechnungen übernommen.

Die neun bestehenden Fahrzeug-, Foto-, Leistungs- und Wunschzeitfelder bleiben erhalten.
Zusätzlich wurden 19 optionale Auftragsfelder angelegt:

| Feld nach `UF_CRM_` | Typ | Zweck |
| --- | --- | --- |
| WG_BOOKING_REF | string | Website-Buchungsreferenz |
| WG_BOOKING_VERSION | integer | Buchungsversion |
| WG_WORK_END | datetime | Vereinbartes Terminende |
| WG_DURATION_MINUTES | integer | Arbeitsdauer in Minuten |
| WG_RESOURCE_ID | integer | Werkstattkapazität |
| WG_AGREED_PRICE | double | Vereinbarter Preis in EUR |
| WG_SERVICE_LINES | string | Leistungen |
| WG_OFFER_REVISION | integer | Angebotsversion |
| WG_ACCEPTED_REVISION | integer | Angenommene Angebotsversion |
| WG_ACCEPTED_AT | datetime | Zeitpunkt der Kundenzustimmung |
| WG_ACCEPTANCE_NOTE | string | Zustimmungsnachweis |
| WG_COMPLETED_AT | datetime | Tatsächlicher Leistungsabschluss |
| WG_PAYMENT_METHOD | string | Barzahlung oder Überweisung |
| WG_CASH_AMOUNT | double | Tatsächlich erhaltener Barbetrag |
| WG_PAYMENT_DATE | date | Tatsächliches Zahlungsdatum |
| WG_INVOICE_ID | integer | Native Bitrix-Rechnung |
| WG_INVOICE_NUMBER | string | Rechnungsnummer |
| WG_MAIL_STATUS | string | Dokumentversand |
| WG_SYNC_ERROR | string | Verarbeitungsfehler |

Die Anlage eines Feldes aktiviert keine Automatisierung. Insbesondere werden
Angebotsversion, Abschlusszeitpunkt und native Rechnungs-/Versandfelder erst mit
der noch ausstehenden, geprüften Umsetzung ihrer jeweiligen Aktion befüllt.

## Änderung der Website-Synchronisierung in diesem Branch

- Vereinbarter Preis wird auch als Auftragsbetrag übertragen; er stimmt mit der
  Summe der vorhandenen Produktzeilen überein. Ohne vereinbarten Preis bleibt der
  Betrag als Richtpreis in der Beschreibung kenntlich.
- Buchungsreferenz/-version, Start/Ende, Dauer, Kapazität, Leistungen sowie die
  vorhandenen Zustimmungs- und Zahlungsdaten werden in eigene CRM-Felder übertragen.
- Prüfung und ausstehende Kundenzustimmung erhalten die passenden Phasen;
  Stornierungen werden von Ablehnungen unterschieden.
- Ein Kalendertermin benötigt einen ausdrücklich gespeicherten gültigen Start
  und ein Ende. Fehlende Zeiten werden als prüfbedürftiger Fehler angezeigt.
  Paket-Schätzungen ersetzen die manuelle Zeitplanung nicht mehr.
- Gespeicherte Zeiträume funktionieren auch ohne ursprünglichen Website-Wunschtermin.
  Bestehende Termine werden weiterhin aktualisiert beziehungsweise bei Stornierung gelöscht.
- Die direkte REST-Anbindung und VibeCode verwenden dieselben Feldwerte.

Die Übertragung ist weiterhin von der Website nach Bitrix gerichtet. Ein
Phasenwechsel oder eine Feldänderung im nativen CRM ist noch keine abgesicherte
Buchungsfreigabe in der Website-Datenbank.

## E-Mail: neue Vorgabe des Inhabers

Der Inhaber entfernt Zoho und nutzt IONOS. Ein Postfach `info@white-gloss.de`
ist inzwischen in Bitrix vorhanden (Mailbox-ID 2, per API und im Webmail geprüft).
Ein Versandtest wurde nicht ausgelöst. Da dort sämtliche normalen E-Mails
erscheinen, soll ein separates Buchungspostfach angebunden werden. Der Inhaber hat dafür ausdrücklich `buchung@white-gloss.de` gewählt. Die
Bitrix-Verbindung mit IONOS wurde über die sichere Passworteingabe hergestellt
und per API sowie im Webmail bestätigt (Mailbox-ID 4). Eingang und Gesendet
werden synchronisiert; gesendete Mails werden auf dem Server abgelegt. Empfang
über IMAP 993 und Versand über SMTP 465 sind mit SSL/TLS eingerichtet. Automatische
Kalendertermine aus eingehenden Mails sind ausgeschaltet. Ein tatsächlicher
Testversand wurde nicht ausgelöst. Es wurde kein neues IONOS-Postfach bestellt. Ein Alias desselben Postfachs trennt den Posteingang nicht.
Der Inhaber hat anschließend ausdrücklich klargestellt: `info@white-gloss.de`
bleibt für das normale Webmail verbunden. Ausschließlich `buchung@white-gloss.de`
ist für automatische Buchungsnachrichten vorgesehen. Beide Verbindungen bleiben
bestehen; eine Trennung von `info@white-gloss.de` ist nicht mehr beabsichtigt.
Der gespeicherte Absendername von Mailbox 4 wurde per API als
`White-Gloss Detailing` verifiziert. Keine historischen Nachrichten oder CRM-Daten
wurden gelöscht. Keine Zoho-Verbindung erneut anlegen.

Die Mailbox-Verbindung allein aktiviert noch keinen automatischen Buchungsversand.
Der bestehende Website-Versand verwendet aktuell Resend und `MAIL_FROM`; die
verbindliche Zuordnung der Buchungsautomationen zu IONOS/Mailbox 4 steht noch aus.
Dabei darf kein globaler Absenderwechsel normale Webmail-Nachrichten betreffen.

## Kalenderabgleich im Entwurf ergänzt

- Persönlicher VibeCode-Kalenderzugang mit dem echten Portal lesend geprüft.
  `calendar-events/search` liefert die angefragte Zeitspanne; die allgemeine
  Listenroute hat dagegen nur ein festes Zeitfenster und wird nicht verwendet.
- Alle Antwortseiten werden anhand von `meta.hasMore` geprüft. `meta.total` ist
  laut aktuellem API-Vertrag optional und kein Abschlussnachweis. Manuelle
  Pagination deaktiviert automatisches Windowing; Teilfehler und Kürzungen
  führen zum Abbruch.
  Unvollständige, widersprüchliche oder fehlerhafte Antworten blockieren die Freigabe.
- Manuelle belegte Termine im bestehenden gemeinsamen Kalender (Nutzer 1,
  Abschnitt 2) sperren beide Ressourcen. Freie und gelöschte Termine werden
  ignoriert. Ganztägige Termine folgen Berliner Kalendertagen inklusive Zeitumstellung.
- Eigene Kalenderexporte werden nur bei exakt passender gespeicherter Ereignis-ID
  und Start-/Endzeit von zusätzlichen Sperren ausgenommen. Abweichende manuelle
  Änderungen bleiben sichtbar als Sperre; die Website-Buchung wird nicht stillschweigend geändert.
- Die Website-Auswahl prüft die vorläufige Paketdauer pro Kapazität. Fehler werden
  angezeigt; es werden keine vermeintlich freien Abgabezeiten angeboten.
- Aktivierung ist standardmäßig aus. Nur der Inhaber kann sie im Bitrix-Bereich
  nach erfolgreicher vollständiger Kalenderprüfung einschalten. Ab dann prüft die
  manuelle Freigabe den Kalender ohne Cache innerhalb des gesperrten
  Buchungsvorgangs. Die alte Freigabe ohne Arbeitszeit wird gesperrt.
- Öffentliche Terminauskünfte verwenden einen begrenzten Cache von 30 Sekunden;
  sie enthalten nur Zeiträume und Ressourcen, keine Titel oder Kundendaten.
- Diese Prüfung ist keine systemübergreifende atomare Reservierung. Eine
  gleichzeitige externe Kalenderänderung nach dem Lesen ist weiterhin möglich.
  Vor PDF/Versand braucht es die noch ausstehende Reservierungsbestätigung und
  Konfliktbehandlung im vollständigen Bitrix-Aktionsablauf.

## Noch erforderlich für den vollständigen Ablauf

1. In Bitrix manuelle Aktionen mit verifizierter Inhaberidentität, Versionsprüfung
   und derselben transaktionalen Reservierung wie auf der Website anbinden.
   Kundenzustimmung an genau eine Angebotsversion binden.
2. Kalenderabgleich aus diesem Entwurf bereitstellen und live aktivieren; bei Bedarf
   getrennte Kalender je Kapazität ergänzen. Änderungen an bereits bestätigten
   Buchungen über einen versionierten Umbuchungsablauf abwickeln.
3. Vor Bestätigungs-PDF und E-Mail den erfolgreich reservierten Gesamtzeitraum
   nachweisen. Eigene White-Gloss-PDF ist im Website-Dokumentmodul vorhanden;
   native Dokumentvorlagen und Versandzuordnung sind noch nicht eingerichtet.
4. Einen einzigen Rechnungsersteller aktivieren und bestehende Provider-Jobs
   gegen Doppelverarbeitung abgrenzen. Rechnung nur nach tatsächlichem manuellen
   Leistungsabschluss; niemals durch Terminende oder bloßen Phasenwechsel.
5. Barzahlung mit tatsächlichem Betrag und Datum als verknüpfte Zahlung erfassen;
   bezahlte Phase allein genügt nicht. Überweisungsrechnung mit bestätigter
   Bankverbindung, eindeutiger Referenz und Rechnungsdatum plus sieben Kalendertagen.
6. Rechnungsstellerdaten, Steuerangaben/-behandlung und Bankverbindung vervollständigen.
   Rechnungsnummern, Dokumentvorlagen, Zahlung und tatsächlichen Mailversand prüfen.
7. Wiederholte/gleichzeitige Freigaben, Zeitkonflikte, Angebotsänderungen,
   Teilzahlungen, Provider-Timeouts und Wiederanlauf mit internen Testdaten prüfen.

Die vorhandene separate White-Gloss-App im Bitrix-Portal ist kein fertiger Ersatz:
Kalender-/Rechnungserstellung ist dort nicht ausreichend gegen Wiederholungen
abgesichert; „versendet“ und „bezahlt“ ändern bisher lediglich Zustände. Ihr
Serverquelltext enthält außerdem einen festen Zugang als Fallback, der bei der
Überarbeitung entfernt werden muss. Keine Zugangsdaten aus diesem Quelltext
übernehmen. Der aktuelle persönliche Zugang darf Quellen lesen, gewährt aber
keinen nachgewiesenen Schreibzugriff auf diesen bestehenden App-Server.

Persönlicher VibeCode-Zugang: CRM und Kalender geprüft. Registrierung von
Bitrix-Automatisierungsregeln benötigt einen passenden OAuth-App-Zugang.
Native Smart-Rechnungen liegen in Kategorie 6; die bestehende historische
Testrechnung ID 2 wurde nicht verändert. `/v1/payments` verwaltet Shop-Zahlungen
und darf nicht ungeprüft als Zahlungsschnittstelle für CRM-Rechnungen verwendet werden.

## Prüfung dieses Teilstands

- 29 gezielte Kalender-, Synchronisierungs- und Buchungsworkflowtests erfolgreich, einschließlich fehlender
  Zeitplanung, mehrtägiger Zeiträume, Updates/Stornierung, Betragskonsistenz und
  Schutz vor Wiederholung nach unklarem externem Schreibvorgang.
- TypeScript-Prüfung, ESLint für die geänderten Dateien und Produktionsbuild erfolgreich.
- Fünf SSR-/Frontendprüfungen erfolgreich gegen den isolierten Produktionsserver;
  echte Daten und externe Versanddienste dabei gesperrt. Der erste normale
  Preview-Aufruf scheiterte am absichtlich strengen Produktionsgate ohne Zugangsdaten.
- Live zurückgelesen: Phasen, 28 Felddefinitionen inklusive der 19 neuen Felder,
  eigenes Unternehmen. Keine Geschäftsaktionen mit realen Kunden ausgeführt.
- Lokale Browserprüfung durch `ERR_BLOCKED_BY_CLIENT` des verfügbaren Browsers
  blockiert. Keine Aussage über einen vollständigen Ende-zu-Ende-Test.

KI-Modell bleibt fest `bitrix/bitrixgpt-5.5` über den VibeCode AI Router. Die KI
erteilt keine Buchungsfreigabe und erzeugt keine Rechnungen oder Zahlungen.


## Fortsetzung: CRM-Postfächer und verbleibender Zugang

Am 13.09.2026 wurde im Portal geprüft: `info@white-gloss.de` hat keine aktive
CRM-Zuordnung mehr, `buchung@white-gloss.de` ist CRM-verbunden. Beim Buchungspostfach
wurden Kontaktanlage aus vCards und die automatische Kontaktanlage aus erstmalig
versendeten E-Mails ausgeschaltet; eingehende neue Adressen bleiben als Lead
zulässig. Bekannte Kontakte werden weiterhin ihren Verantwortlichen zugeordnet.

Die Absender-API `/v1/mail/mailboxes/4/senders` liefert trotz Mailbox-ID 4 **beide**
Absender. Deshalb später nach `mailboxId === 4` und exakter Adresse
`buchung@white-gloss.de` filtern; niemals den ersten Eintrag oder `senderId`
allein auswählen (beide Einträge hatten dieselbe senderId).

Der dokumentierte `POST /v1/mail/messages` unterstützt `from`, `to`, `subject`,
`body`, `cc`, `bcc`. Keine dokumentierten PDF-Anhänge oder Idempotenzparameter;
die Antwort hat `data.success` und `data.to`, aber keine Nachrichten-ID.
Den bisherigen Resend-Worker daher nicht einfach auf diesen Endpoint umbiegen:
Er setzt für sichere Wiederholung eine Provider-Idempotenz voraus. Vor IONOS-
Aktivierung einen geeigneten Versandweg samt unveränderlichem Provider pro
Queue-Eintrag, Anhängen und Prüfung unklarer Zustellungen fertigstellen.

Der vorhandene App-Server `WhiteGloss` ist weiter einem anderen Schlüssel
zugeordnet. Aktueller persönlicher Schlüssel: keine eigenen oder als
Collaborator freigegebenen Server. Die offizielle Wiederherstellung beschreibt
`https://vibecode.bitrix24.com/black-hole` → Server → Change managing key.
Diese Zuordnung muss der Inhaber im Dashboard vornehmen; ausdrücklich kein
V1-Endpunkt und laut Anbieter keine automatisierte Schlüsselübernahme.
Keine alten Schlüssel aus App-Quellen verwenden. Erst danach die bestehende
App über den freigegebenen Zugang überarbeiten.

Quellen: `https://vibecode.bitrix24.com/docs-content-en/mail/messages/send.md`,
`https://vibecode.bitrix24.com/docs-content-en/infra/server-access-recovery.md`,
aktuelle API-Selbstbeschreibung `/v1/me` und `/v1/guide`.
