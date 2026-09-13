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

Der Inhaber setzt die E-Mail-Einstellungen zurück und entfernt Zoho.
Der vorbereitete Zoho-Verbindungsdialog wurde ohne Verbindung abgebrochen.
Neuen Mailanbieter und Versandweg klären, bevor Zugangsdaten oder Versandregeln
eingerichtet werden. Keine Zoho-Verbindung erneut anlegen. Das Entfernen eines
Postfachanbieters ersetzt nicht automatisch die bestehende Buchungslogik im
Website-Modul `zoho-ops.ts`.

## Noch erforderlich für den vollständigen Ablauf

1. In Bitrix manuelle Aktionen mit verifizierter Inhaberidentität, Versionsprüfung
   und derselben transaktionalen Reservierung wie auf der Website anbinden.
   Kundenzustimmung an genau eine Angebotsversion binden.
2. Kalender je Kapazität zuordnen; manuell in Bitrix angelegte Termine/Sperren
   vollständig zur Website übernehmen. Importfehler dürfen keine scheinbar freien
   Zeiten freigeben. Aktuell exportiert der Adapter in Nutzer 1 / Kalender 2.
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

- 12 gezielte Synchronisierungstests erfolgreich, einschließlich fehlender
  Zeitplanung, mehrtägiger Zeiträume, Updates/Stornierung, Betragskonsistenz und
  Schutz vor Wiederholung nach unklarem externem Schreibvorgang.
- TypeScript-Prüfung und Produktionsbuild erfolgreich.
- Live zurückgelesen: Phasen, 28 Felddefinitionen inklusive der 19 neuen Felder,
  eigenes Unternehmen. Keine Geschäftsaktionen mit realen Kunden ausgeführt.
- Lokale Browserprüfung durch `ERR_BLOCKED_BY_CLIENT` des verfügbaren Browsers
  blockiert. Keine Aussage über einen vollständigen Ende-zu-Ende-Test.

KI-Modell bleibt fest `bitrix/bitrixgpt-5.5` über den VibeCode AI Router. Die KI
erteilt keine Buchungsfreigabe und erzeugt keine Rechnungen oder Zahlungen.
