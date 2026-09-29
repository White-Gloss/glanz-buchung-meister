# RO App: Einrichtung prüfen und Live-Test mit eigenen Daten

Stand 29.09.2026. Für eine Sitzung auf dem Rechner des Inhabers (Claude Desktop mit „Claude in Chrome“, RO App im eingeloggten Chrome). Die Cloud-Umgebung kann weder den Browser noch white-gloss.de oder api.roapp.io erreichen.

Keine Zugangsdaten, Bankdaten oder API-Schlüssel in Chat, Repository oder Screenshots. Keine fremde Unterschrift: Die Annahme im Test gibt Lars selbst als Testkunde ab. Keine Zahlung erfassen, die nicht tatsächlich eingegangen ist.

## Testdaten (vom Inhaber freigegeben)

| Feld         | Wert                                              |
| ------------ | ------------------------------------------------- |
| Name         | Lars Hägele TEST                                  |
| E-Mail       | lars.haegele.360@gmail.com                        |
| Telefon      | 0152 33540284                                     |
| Anschrift    | Arnistal 27, 72160 Horb am Neckar                 |
| Leistung     | Basisreinigung, Kompaktklasse (Ab-Preis 149,00 €) |
| Hinweisfeld  | „TEST – interner Ablauftest, keine Ausführung“    |
| Einwilligung | Bewertungs-E-Mail: ja (prüft Schritt 7)           |

## A. RO App: Einrichtung abgleichen (nur lesen, gezielt korrigieren)

1. **Status** (Einstellungen → Auftragsstatus), IDs laut Server-Konfiguration: „Anfrage (Preise prüfen)“ 5706133, „Fixpreis bestätigt“ 5706367, „Termin verbindlich“ 5706483, weiterer bestätigter Status 5706160, Abschlussstatus 5706130/5706131/5706151/5706152; dazu „Akzeptiert“. „Termin verbindlich“ nur aus „Akzeptiert“ erreichbar.
2. **Leistungskatalog** (inkl. 19 % USt): Die Positionen müssen den Website-Preisen entsprechen. Faktoren: Kompakt ×1, SUV/Limousine ×1,25, Transporter ×1,55.

   | Leistung                         | Kompakt                                      | SUV/Limousine | Transporter |
   | -------------------------------- | -------------------------------------------- | ------------- | ----------- |
   | Basisreinigung                   | 149,00                                       | 186,25        | 230,95      |
   | Reinigung & Politur              | 349,00                                       | 436,25        | 540,95      |
   | Keramikschutz                    | 899,00                                       | 1.123,75      | 1.393,45    |
   | Felgenreinigung und Versiegelung | 119,00                                       | 148,75        | 184,45      |
   | Geruchsbehandlung mit Ozon       | 99,00                                        | 123,75        | 153,45      |
   | Motorraumreinigung               | 99,00                                        | 123,75        | 153,45      |
   | Lederpflege                      | 149,00                                       | 186,25        | 230,95      |
   | Alcantarareinigung               | 99,00                                        | 123,75        | 153,45      |
   | Dachhimmelreinigung              | 139,00                                       | 173,75        | 215,45      |
   | Scheinwerferaufbereitung         | 99,00                                        | 123,75        | 153,45      |
   | Scheibenversiegelung             | 99,00                                        | 123,75        | 153,45      |
   | Zusätzliche Keramikschichten     | 699,00                                       | 873,75        | 1.083,45    |
   | Cabrioverdeckpflege              | 179,00                                       | 223,75        | 277,45      |
   | Tierhaarentfernung               | 99,00                                        | 123,75        | 153,45      |
   | Lederreparatur                   | 139,00                                       | 173,75        | 215,45      |
   | Textilreparatur                  | 119,00                                       | 148,75        | 184,45      |
   | Abholung bis 20 km / bis 50 km   | 50,00 / 70,00 (Abholung bis 10 km kostenlos) |               |             |

3. **Kundenbenachrichtigungen:** Angebots-E-Mail nur beim Wechsel auf „Fixpreis bestätigt“, mit Link zur öffentlichen Auftragsseite, Annahme mit Pflicht-Unterschrift. Keine sofortige Bewertungs-E-Mail bei Abschluss (die kommt von der Website nach sieben Tagen).
4. **Webhook:** aktiv, Ziel `https://white-gloss.de/api/ro-callback`, Auftragsereignisse. Das Secret nicht anzeigen oder kopieren.
5. **Eigener Absender (offen):** In den E-Mail-Einstellungen von RO statt „RO App Gateway“ den Absender buchung@white-gloss.de einrichten. Die von RO angezeigten DNS-Einträge (SPF/DKIM) im IONOS-DNS für white-gloss.de ergänzen. Testmail nur an lars.haegele.360@gmail.com senden.
6. **Rechnungen in RO:** Ab Aktivierung der Website-Rechnung keine Rechnungen in RO anlegen. Eine juristische Person bzw. Handelsregisternummer nicht erfinden; der RO-Entwurf bleibt ungespeichert.

## B. Website: Rechnungsautomatik einschalten (Betreiberzugang)

Über den vorhandenen geschützten Weg (DPAPI-Profil und Server-Helfer) im Server-Environment setzen und den Dienst neu starten:

```
ROAPP_INVOICE_ENABLED=true
ROAPP_INVOICE_FROM=<Zeitpunkt der Aktivierung, z. B. 2026-09-29T10:00:00+02:00>
ROAPP_INVOICE_DELAY_MINUTES=15
ROAPP_INVOICE_BANK_HOLDER=<Kontoinhaber>
ROAPP_INVOICE_BANK_NAME=<Bank>
ROAPP_INVOICE_IBAN=<IBAN>
ROAPP_INVOICE_BIC=<BIC>
ROAPP_INVOICE_TAX_NUMBER=<Steuernummer, optional; die USt-IdNr. steht bereits auf der Rechnung>
```

Danach unter https://white-gloss.de/admin/bitrix („Rechnungen und Zahlungen“) prüfen: keine Konfigurationsprobleme angezeigt.

**Wichtig für den Test:** Eine Website-Rechnung ist ein echter Beleg mit fortlaufender Nummer und Umsatzsteuer. Zwei Varianten:

- **Empfohlen:** Den Testauftrag nach `ROAPP_INVOICE_FROM` bestätigen, bis „Erledigt“ führen und die Rechnung nach der Wartezeit wirklich ausstellen lassen. Die Rechnung **nicht** bezahlt markieren. Anschließend eine Stornorechnung manuell erstellen. So sind Nummernkreis, PDF und Versand echt nachgewiesen.
- **Ohne Beleg:** Den Test vor der Aktivierung bis „Termin verbindlich“ führen. Dann erzeugt „Erledigt“ keine Rechnung (Stichtagsregel). Der Rechnungsteil ist in diesem Fall nur durch die isolierten Tests belegt.

## C. Live-Ablauf (jeder Schritt mit erwartetem Ergebnis)

1. **Anfrage** auf https://white-gloss.de mit den Testdaten absenden, optional ein Foto hochladen.
   - Erwartet: Bestätigungsseite mit Vorgang WG-…; Eingangsmail an lars.haegele.360@gmail.com. Kein fester Termin, Hinweis „unverbindlich“.
2. **RO:** Genau ein neuer Auftrag im Status „Anfrage (Preise prüfen)“. Kommentar mit Wunschtermin und Ab-Preis, Foto-Link im privaten Kommentar (öffnet das Foto), Kontakt mit Testdaten. Die Anschrift Arnistal 27, 72160 Horb am Neckar im RO-Kontakt ergänzen.
3. **Fixpreis:** Position/Preis prüfen, Termin in 1–2 Tagen eintragen, dann Status „Fixpreis bestätigt“.
   - Erwartet: Die RO-Angebotsmail kommt an. Die Statusseite der Website zeigt den Fixpreis und „Auftrag prüfen und unterschreiben“.
4. **Annahme:** Lars öffnet als Testkunde den Link aus der Mail und unterschreibt selbst.
   - Erwartet: Der RO-Status wechselt auf „Akzeptiert“. Es gibt noch keine Terminbestätigung.
5. **Bestätigung:** Unterschrift prüfen, Status „Termin verbindlich“.
   - Erwartet: Da der Termin weniger als drei Tage entfernt ist, kommt die Erinnerungsmail beim nächsten Minutenlauf (telefonische Abholabsprache, Übergabehinweise).
   - Optional Umbuchung prüfen: Termin in RO ändern. Die Statusseite zeigt dann „Termin wird erneut geprüft“, und die alte Erinnerung verfällt.
6. **Abschluss:** Status „Erledigt“.
   - Bei Variante „Empfohlen“: Nach der Wartezeit kommt eine Rechnungsmail mit PDF. Im Betriebspanel steht „Versendet · Offen“, im RO-Auftrag der Hinweis zur Website-Rechnung.
   - Keine Zahlung erfassen, danach die Stornorechnung erstellen.
7. **Bewertung:** Sieben Tage nach „Erledigt“ kommt einmalig die Bewertungsbitte (nur mit Einwilligung). Nicht vorziehen.
8. **Aufräumen:** RO-Auftrag stornieren bzw. als Test kennzeichnen. Ausgestellte Belege nicht löschen (Aufbewahrung).

## Übergabe-Prompt für die lokale Sitzung

> Arbeite im Repository White-Gloss/glanz-buchung-meister nach `docs/roapp-live-test-runbook.md`. Nutze Claude in Chrome im bereits eingeloggten RO-App-Tab. Führe Teil A als Abgleich durch und korrigiere nur eindeutige Abweichungen. Teil B nur mit meinem ausdrücklichen Okay über den geschützten Weg. Teil C mit den angegebenen Testdaten. Die Unterschrift und alle Zahlungen mache ich selbst. Nenne nach jedem Schritt Ergebnis und Abweichungen und halte am Ende alles in `docs/roapp-integrationsstatus.md` fest.
