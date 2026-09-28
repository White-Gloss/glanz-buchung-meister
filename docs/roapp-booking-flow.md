# White-Gloss: Anfrage und Freigabe mit RO App

Stand: 28.09.2026. RO App ersetzt Bitrix24 nach ausdrücklicher Betreiberanweisung.
Dieser Stand ist vorbereitet, nicht auf IONOS aktiviert.

1. Die Website speichert eine unverbindliche Anfrage mit Ab-Preisen, Wunschtermin, Kontaktdaten und optionalen Fotos. Sie überträgt genau einen Auftrag in das neue RO-Konto. Der Wunschtermin steht im Kommentar; bei Eingang wird kein fester Termin angelegt.
2. Lars prüft Angaben und Fotos. Er ergänzt Leistungen, Endpreis und den angebotenen Zeitraum in RO. Fehlende E-Mail-Adressen müssen vor der Freigabe beim Kunden erfragt werden.
3. Erst „Fixpreis bestätigt“ löst die Angebots-E-Mail aus. Die öffentliche Auftragsseite erlaubt nur in diesem Status die Annahme. Die Kundenunterschrift ist dort erforderlich.
4. Der Kunde nimmt selbst an und unterschreibt. RO wechselt zu „Akzeptiert“. Lars prüft die Unterschrift, stimmt Abholung oder eigene Anlieferung ab und setzt „Termin verbindlich“. Dieser Status ist in RO nur aus „Akzeptiert“ erreichbar. Die API stellt keinen hier nachgewiesenen Signaturprüfnachweis bereit; der separate Besitzerstatus dokumentiert die menschliche Prüfung.
5. Der Website-Versand plant die Erinnerung drei Tage vor dem finalen Termin. Bei einer kurzfristigen Bestätigung erfolgt sie zum nächsten Versandlauf. Abholzeit und Übergabe werden telefonisch abgestimmt. Preis- oder Terminänderungen entziehen die bisherige Freigabe; erneut prüfen, Kundenannahme einholen und bestätigen. Aktuelle RO-Daten werden vor jeder geplanten E-Mail gelesen; bei Fehlern wird nicht versandt.
6. Nach erbrachter Leistung wird „Erledigt“ gesetzt. Rechnungen entstehen in RO, mit sieben Tagen Zahlungsziel. Eine Zahlung darf ausschließlich nach tatsächlichem Eingang gebucht werden. Bei Barzahlung wird anschließend der bezahlte Beleg ausgegeben; ein Statuswechsel erzeugt keinen Zahlungsnachweis.
7. Sieben Tage nach dem erfassten Abschluss folgt einmalig eine Bewertungs-E-Mail, sofern die freiwillige Einwilligung vorliegt. Der Google-Link ist unabhängig von der Zufriedenheit erreichbar. Widerruf setzt bookings.review_email_consent=false; jede ausstehende Nachricht prüft die Einwilligung erneut.

## Bereits im neuen RO-Konto konfiguriert

- 50 zur Website passende Servicepositionen mit vorläufigen Preisen.
- „Fixpreis bestätigt“ und „Termin verbindlich“.
- Angebots-E-Mail nur bei Preisfreigabe; Annahme mit erforderlicher Unterschrift.
- Die frühere sofortige Bewertungs-E-Mail wurde durch eine Abschlussinformation ersetzt.
- Rechnungsziel sieben Tage (im RO-Formular geprüft).
- Webhook zur Website angelegt. Bei der letzten Sichtprüfung aktiv; noch keine erfolgreiche Zustellung an den neuen Website-Empfänger nachgewiesen.

## Noch vor produktiver Freigabe nötig

- IONOS-Zugang wiederherstellen, Migration 0022 und den geprüften Release über den vorhandenen IONOS-Weg veröffentlichen.
- Neues Konto, API-Schlüssel, Status-/Katalogzuordnung und tatsächlichen Umschaltzeitpunkt installieren. Nur nach dem Umschaltzeitpunkt neu eingehende Anfragen dürfen ins neue Konto gelangen. Keine alten Warteschlangen importieren.
- Rechnungssteller vollständig hinterlegen. Das RO-Formular verlangt eine Handelsregisternummer; die angegebene Steuernummer darf nicht stillschweigend dafür verwendet werden.
- Vollautomatisches Erstellen und Versenden von Rechnungs-PDFs ist noch nicht implementiert oder nachgewiesen. Der API-Katalog bietet Rechnungserstellung, aber keinen in dieser Prüfung gefundenen PDF-/Versandendpunkt. Bis zur geprüften Umsetzung erfolgt Erstellung und Versand in RO durch den Betreiber.
- RO-Auftrags-E-Mails verwenden derzeit den RO App Gateway. Die gewünschte Firmen-Absenderadresse ist dort noch nicht verbunden. Erinnerungs-/Bewertungsmails nutzen den vorhandenen Website-Maildienst und buchung@white-gloss.de; dessen aktuelle Produktionskonfiguration ist wegen IONOS-Zugriff nicht geprüft.
- Vor Aktivierung einen vollständig isolierten End-to-End-Test ohne echte Kundendaten bzw. Nachrichten durchführen. Das aktiviert keine echten Termine und simuliert keine Kundenunterschrift.

## Schutz vor Doppelungen und Altlasten

BOOKING_OPERATIONS wählt genau ein CRM. Im RO-Modus lesen oder beschreiben die Bitrix-Einstiegspunkte keine Bitrix-Daten. Jeder API-Client prüft das Erstellungsdatum des neuen Unternehmens. Account-Scope und Umschaltzeitpunkt sperren alte RO-IDs und ausstehende Altfälle. Mehrdeutige API-Schreibantworten gehen in manuelle Prüfung statt erneut zu schreiben.

Fotos werden über geschützte, befristete Links in privaten Auftragskommentaren bereitgestellt. Der öffentliche Kundenstatus ist nur über die bestehende Anfrageberechtigung erreichbar. Der Kalender liest alle Seiten; unvollständige Antworten gelten nicht als freie Kapazität.

RO-Dokumentation: [Externe Benachrichtigungen](https://help.roapp.io/de/articles/3293171-sms-und-e-mail-benachrichtigungen-fur-kunden). Im aktuellen Konto wurde die Verzögerungsoption nur bei SMS angezeigt; deshalb läuft die 7-Tage-E-Mail über den Website-Versand.
