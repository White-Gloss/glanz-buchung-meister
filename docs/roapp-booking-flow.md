# White-Gloss: Anfrage und Freigabe mit RO App

Stand: 29.09.2026. RO App ersetzt Bitrix24 ausschließlich für neue Website-Anfragen (Umschaltung
2026-09-28T22:27:15.023Z). Aktiver IONOS-Release laut Deploy-Lauf 263: `9b42bbd` (main).

1. Die Website speichert eine unverbindliche Anfrage mit Ab-Preisen, Wunschtermin, Kontaktdaten und optionalen Fotos. Sie überträgt genau einen Auftrag in das neue RO-Konto. Der Wunschtermin steht im Kommentar; bei Eingang wird kein fester Termin angelegt.
2. Lars prüft Angaben und Fotos. Er ergänzt Leistungen, Endpreis und den angebotenen Zeitraum in RO. Fehlende E-Mail-Adressen müssen vor der Freigabe beim Kunden erfragt werden.
3. Erst „Fixpreis bestätigt“ löst die Angebots-E-Mail aus. Die öffentliche Auftragsseite erlaubt nur in diesem Status die Annahme. Die Kundenunterschrift ist dort erforderlich.
4. Der Kunde nimmt selbst an und unterschreibt. RO wechselt zu „Akzeptiert“. Lars prüft die Unterschrift, stimmt Abholung oder eigene Anlieferung ab und setzt „Termin verbindlich“. Die API stellt keinen hier nachgewiesenen Signaturprüfnachweis bereit; der separate Besitzerstatus dokumentiert die menschliche Prüfung.
5. Der Website-Versand plant die Erinnerung drei Tage vor dem finalen Termin (bei kurzfristiger Bestätigung zum nächsten Versandlauf). Abholzeit und Übergabe werden telefonisch abgestimmt. Preis- oder Terminänderungen entziehen die bisherige Freigabe; erneut prüfen, Kundenannahme einholen und bestätigen. Vor jeder geplanten E-Mail werden Auftrag und Kontakt in RO neu gelesen; bei Fehlern wird nicht versandt.
6. Nach erbrachter Leistung wird „Erledigt“ gesetzt. Bei eingeschalteter Rechnungsautomatik (`ROAPP_INVOICE_ENABLED=true`) erstellt die Website nach der Wartezeit (Standard 15 Minuten) die Rechnung aus den RO-Positionen, mit sieben Tagen Zahlungsziel, und sendet sie als PDF per E-Mail. In RO wird dann keine zusätzliche Rechnung angelegt. Als bezahlt gilt eine Rechnung nur, wenn Lars im Betriebspanel einen tatsächlichen Zahlungseingang erfasst; bei Barzahlung entsteht daraus automatisch eine Quittung. Ein Statuswechsel erzeugt keinen Zahlungsnachweis.
7. Sieben Tage nach dem erfassten Abschluss folgt einmalig eine Bewertungs-E-Mail, sofern die freiwillige Einwilligung vorliegt. Der Google-Link ist unabhängig von der Zufriedenheit erreichbar. Widerruf setzt bookings.review_email_consent=false; jede ausstehende Nachricht prüft die Einwilligung erneut.

## Rechnungsautomatik (Website als Rechnungssteller)

Die RO-API bietet in den bisherigen Prüfungen keinen PDF- oder Versandendpunkt für Rechnungen. Automatischer Versand ist deshalb nur über die Website möglich; sie ist dann der einzige Rechnungssteller.

- Auslöser: RO-Status in `ROAPP_COMPLETED_STATUS_IDS`, zuvor Fixpreis, Kundenannahme und „Termin verbindlich“. Nur Abschlüsse ab `ROAPP_INVOICE_FROM`; ältere, womöglich manuell abgerechnete Aufträge werden nie angefasst.
- Daten: RO-Auftrag, RO-Positionen und RO-Kontakt werden unmittelbar vor der Ausstellung neu gelesen. Die Positionssumme muss exakt dem freigegebenen RO-Betrag entsprechen. Rabatte oder unbekannte Antwortformate werden nicht interpretiert, sondern gehen in „Prüfung erforderlich“.
- Pflichtangaben: fortlaufende Nummer `WG-RE-JJJJ-NNNN` (lückenlos, in derselben Transaktion vergeben), Rechnungs- und Leistungsdatum, Positionen, Netto, 19 % USt, Brutto, USt-IdNr. (optional Steuernummer), Bankverbindung. Über 250 € brutto ist die Anschrift des Kunden Pflicht (§ 14 UStG / § 33 UStDV); fehlt sie im RO-Kontakt, wird keine Nummer vergeben und Lars einmalig informiert.
- Doppelschutz: höchstens eine Rechnung je Vorgang (Primärschlüssel), eindeutige Nummer, eindeutiger Versandschlüssel, Versand nur nach erneutem Abgleich von Nummer und Empfänger. Ein privater RO-Kommentar hält fest, dass die Rechnung bereits erstellt wurde.
- Spätere RO-Änderungen (Storno, Wiedereröffnung, anderer Betrag) ändern eine ausgestellte Rechnung nie. Lars erhält einmalig einen Hinweis zur manuellen Stornorechnung bzw. Korrektur.
- Ohne Kunden-E-Mail erhält Lars die Rechnung als PDF zur persönlichen Übergabe.
- Zahlungen: nur Betrag bis zum offenen Rest, Datum nicht in der Zukunft, doppelte Übermittlung wird erkannt. Zustände `offen`, `teilbezahlt`, `bezahlt`.

## Fehlerfälle und Datenänderungen

- Geänderte Kundendaten: Eine in RO korrigierte E-Mail-Adresse ersetzt die Website-Adresse und wird auch für bereits geplante, noch nicht versandte Nachrichten verwendet. Versandte Nachrichten werden nicht wiederholt.
- Fehlende E-Mail: keine Kundenmail; bei verbindlichem Termin erhält Lars einmalig den Hinweis, telefonisch zu erinnern.
- Umbuchung: Terminänderung in RO widerruft die Bestätigung und die geplante Erinnerung; nach erneuter Bestätigung entsteht eine neue Erinnerung.
- Storno: geplante Erinnerungen und Bewertungsbitten werden vor dem Versand verworfen; es entsteht keine Rechnung.
- RO nicht erreichbar oder Antwort mehrdeutig: nichts wird versandt oder nummeriert; begrenzte Wiederholung, danach „Prüfung erforderlich“ mit Inhaberhinweis.

## Noch offen (nicht aus dem Repository lösbar)

- Rechnungsautomatik auf IONOS aktivieren: `ROAPP_INVOICE_*` im geschützten Server-Environment setzen (siehe [ops-roapp-env.md](ops-roapp-env.md)), `ROAPP_INVOICE_FROM` auf den tatsächlichen Aktivierungszeitpunkt. Ab dann in RO keine Rechnungen mehr anlegen.
- Live-Nachweis der RO-Endpunkte `GET /orders/{id}/items` und `GET /contacts/people/{id}` (Antwortformat, Adressfeld). Bei abweichendem Format geht die Rechnung sicher in „Prüfung erforderlich“.
- Eigener Firmenabsender für native RO-Angebotsmails (derzeit RO App Gateway): in RO einrichten und DNS bei IONOS nach RO-Vorgabe ergänzen.
- Durchgängiger Live-Nachweis mit einem echten, freiwilligen Testkunden (eigene Unterschrift, echte Zahlung) steht aus.

## Schutz vor Doppelungen und Altlasten

BOOKING_OPERATIONS wählt genau ein CRM. Im RO-Modus lesen oder beschreiben die Bitrix-Einstiegspunkte keine Bitrix-Daten. Jeder API-Client prüft das Erstellungsdatum des neuen Unternehmens. Account-Scope und Umschaltzeitpunkt sperren alte RO-IDs und ausstehende Altfälle. Mehrdeutige API-Schreibantworten gehen in manuelle Prüfung statt erneut zu schreiben.

Fotos werden über geschützte, befristete Links in privaten Auftragskommentaren bereitgestellt. Der öffentliche Kundenstatus ist nur über die bestehende Anfrageberechtigung erreichbar. Der Kalender liest alle Seiten; unvollständige Antworten gelten nicht als freie Kapazität.

RO-Dokumentation: [Externe Benachrichtigungen](https://help.roapp.io/de/articles/3293171-sms-und-e-mail-benachrichtigungen-fur-kunden). Im aktuellen Konto wurde die Verzögerungsoption nur bei SMS angezeigt; deshalb läuft die 7-Tage-E-Mail über den Website-Versand.
