# Start-Checkliste für White Gloss Detailing

Diese Liste ist für die Zeit **nach Gewerbeanmeldung** und **vor dem Firmenstart**. Arbeite sie einfach von oben nach unten ab. Bei einem Punkt, der mit „Sag mir Bescheid“ endet, brauchst du nur die Information zu schicken — ich übernehme den technischen Teil.

---

## 1. Gewerbe, Steuern und Rechnung fertig machen

### Was du brauchst

- Steuernummer vom Finanzamt
- Entscheiden: Kleinunternehmerregelung nach § 19 UStG oder Umsatzsteuer ausweisen
- Geschäftskonto: Kontoinhaber, IBAN und BIC
- Falls vorhanden: USt-IdNr.

### Warum das wichtig ist

Ohne diese Daten darf keine vollständige Rechnung erzeugt oder verschickt werden. Deshalb ist die Rechnungsfunktion aktuell absichtlich gesperrt. So wird nicht versehentlich eine fehlerhafte Rechnung an Kunden gesendet.

### Was du danach machst

1. Schicke mir **keine Passwörter**, aber diese normalen Firmendaten: Steuernummer, ob Kleinunternehmer ja/nein, Kontoinhaber, IBAN, BIC und USt-IdNr. falls vorhanden.
2. Ich trage die Daten ein.
3. Ich aktiviere den Rechnungsexport erst dann.
4. Danach testen wir gemeinsam eine Testrechnung.

> Wichtig: Die Webseite verschickt aktuell nach der Buchung eine **Eingangsbestätigung**, nicht sofort eine Rechnung. Das ist richtig. Eine Rechnung bzw. ein detailliertes verbindliches Angebot kommt erst nach deiner Annahme.

---

## 2. E-Mail-Versand wirklich testen

Die Website verwendet Resend für E-Mails. Der Code für Eingangsbestätigung und Auftragsbestätigung ist vorhanden.

### In einfachen Worten

Resend ist der Briefträger. Die Website schreibt die E-Mail, Resend liefert sie aus. Damit der Brief nicht im Spam landet, muss Resend wissen, dass `whitegloss.de` wirklich dir gehört.

### Prüfe in Resend

1. Melde dich bei [resend.com](https://resend.com) an.
2. Öffne **Domains**.
3. Prüfe, ob `whitegloss.de` den Status **Verified** hat.
4. Prüfe, ob SPF und DKIM dort grün bzw. bestätigt sind.
5. Lege eine Absenderadresse fest, zum Beispiel `buchung@whitegloss.de`.

### Prüfe in hPanel

In **hPanel → Hermes Agent → Dashboard → Environment** müssen diese Werte vorhanden sein:

```text
RESEND_API_KEY
MAIL_FROM=White Gloss Detailing <buchung@whitegloss.de>
MAIL_TO_OWNER=deine-eigene-empfangsadresse@example.de
```

- `RESEND_API_KEY` ist geheim. Nicht in WhatsApp, nicht in GitHub und nicht in den Chat schreiben.
- `MAIL_FROM` ist die sichtbare Absenderadresse.
- `MAIL_TO_OWNER` ist die Adresse, an die du jede neue Anfrage zusätzlich bekommst.

### Test vor dem Start

Mache eine echte Testanfrage mit einer Test-E-Mail-Adresse. Prüfe danach:

- Kommt die Kundenmail an?
- Kommt deine interne Benachrichtigung an?
- Liegt etwas im Spam?
- Funktioniert „Antworten“ auf die Mail?

Danach teste mit Gmail, Outlook und WEB.DE. Falls eine Mail im Spam landet, sag mir Bescheid und schicke einen Screenshot ohne persönliche Kundendaten.

---

## 3. 10-%-Anzahlung und Preislogik verstehen

Für **neue Kunden** rechnet die Website jetzt 10 % des angezeigten Gesamtpreises als Anzahlung vor.

Wichtig: Der Website-Preis ist ein **voraussichtlicher Preis**, weil Verschmutzung, Kratzer, Gerüche und Materialien erst nach Fotos oder Besichtigung fair eingeschätzt werden können. Erst wenn du die Anfrage annimmst, wird daraus der verbindliche Preis bzw. das verbindliche Angebot.

Wenn ein Kunde bei der Anfrage ungenaue Angaben gemacht hat:

1. Prüfe Bilder und Beschreibung.
2. Ruf den Kunden an oder schreibe ihm.
3. Nenne den korrekten Preis.
4. Erst danach im Admin auf **Bestätigt** setzen.
5. Dann wird automatisch die Auftragsbestätigung per E-Mail versendet.

---

## 4. Google-Bewertungslink nachreichen

Für die Feedback-Mail 14 Tage nach dem Termin brauche ich deinen direkten Google-Bewertungslink.

So findest du ihn:

1. Öffne dein Google Business Profile.
2. Klicke auf **Um Rezensionen bitten**.
3. Kopiere den erzeugten Link.
4. Schicke mir nur diesen Link.

Dann kann die Feedback-Mail freundlich nach der Zufriedenheit fragen und den Bewertungslink enthalten.

---

## 5. Erinnerungen und Feedback-Automatisierung aktivieren

Geplanter Ablauf:

- **3 Tage vor dem bestätigten Termin:** Erinnerungs-E-Mail.
- **14 Tage nach abgeschlossenem Termin:** Feedback-E-Mail mit Google-Bewertungslink.

### Wichtig

In Hermes wurde kein eigener Cronjob gefunden. Wenn bei dir schon ein Cronjob existiert, läuft er also wahrscheinlich im Hosting oder in Supabase.

Bitte prüfe in deiner Deployment-Plattform:

1. Öffne die Website bzw. das Hosting.
2. Suche nach **Cron Jobs** oder **Geplante Aufgaben**.
3. Mache einen Screenshot mit dem Jobnamen und dem Zeitplan — keine Geheimnisse oder Tokens sichtbar lassen.
4. Schicke ihn mir.

Dann prüfe ich, ob er wirklich täglich läuft und ob er vor Doppelversand schützt.

---

## 6. Lexware Office anbinden

Die Website spricht **Lexware Office** (Cloud, Public API) an, nicht Lexware Desktop. Desktop hat keine REST-API.

### Was die Anbindung tut

- Kundenkontakt aus jeder gespeicherten Buchung (Lookup per E-Mail, sonst neu)
- Rechnungs**entwurf** erst wenn die Buchung **erledigt** ist
- Kein automatisches Finalisieren, kein Versand — das bleibt in Lexware
- Qonto und Odoo bleiben parallel an

### Was du brauchst

1. Ein Lexware-Office-Konto (nicht nur Desktop)
2. Einen Public-API-Schlüssel unter Add-ons → Public API
3. Den Schlüssel **nur** in `/etc/white-gloss/environment` als `LEXWARE_API_KEY` eintragen — nicht in diesen Chat, nicht in GitHub, nicht in WhatsApp
4. Migration `0014_lexware_sync.sql` auf der Live-Datenbank, **bevor** das Release aktiv wird
5. Im Admin unter **Dokumente** den Schalter „Lexware-Übertragung einschalten“ (nur Inhaber)

Der Schalter startet aus. Ohne Schlüssel passiert nichts. Testrechnung erst als Entwurf prüfen, dann in Lexware selbst freigeben.

---

## 7. Öffnungszeiten und echte Terminlogik festlegen

Die Website sagt aktuell „Mo–Fr 09:00–17:00 Uhr“, bietet im Anfrageformular aber mehrere bevorzugte Zeitfenster an. Das ist eine Anfrage, keine automatische feste Terminvergabe.

Bitte entscheide vor dem Start:

- Arbeitest du Samstag? Ja oder nein?
- Welche Tage sind immer geschlossen?
- Soll **Premium Glanz** oder nur **High-End Keramik** einen ganzen Tag blockieren?
- High-End Keramik ist aktuell mit etwa zwei Tagen beschrieben. Soll das genau so bleiben?

Danach passe ich Kalender und Blockierungslogik exakt an deinen echten Ablauf an.

---

## 8. Rechtstexte final prüfen lassen

Die Seiten `/agb` und `/widerruf` sind erstellt und berücksichtigen:

- unverbindliche Anfrage statt sofortigem Vertrag,
- Preisprüfung nach Fahrzeugzustand,
- Terminabstimmung drei bis vier Tage vorher,
- Hol- und Bringservice,
- 10-%-Anzahlung für Neukunden,
- Bezahlung bar vor Ort oder per Überweisung binnen sieben Tagen,
- gesetzliches Widerrufsrecht für Dienstleistungen.

Das ist ein sorgfältiger betrieblicher Entwurf, aber keine anwaltliche Rechtsberatung oder Abmahnschutz-Garantie. Vor dem endgültigen Firmenstart sollte ein Anwalt oder ein seriöser deutscher Rechtstexte-Anbieter den finalen Text prüfen, besonders sobald Firmen- und Steuerdaten feststehen.

---

## 9. Livegang kontrollieren

Nach dem Deployment prüfe diese Adressen im Browser:

```text
https://whitegloss.de/agb
https://whitegloss.de/widerruf
https://whitegloss.de/impressum
https://whitegloss.de/datenschutz
https://whitegloss.de/sitemap.xml
```

Alle Seiten müssen öffnen. Wenn bei AGB oder Widerruf noch „Seite nicht gefunden“ steht, wurde der neue Stand noch nicht deployt.

---

## 10. Vor dem ersten echten Kunden: 15-Minuten-Test

1. Öffne die Seite am Handy.
2. Mache eine Testanfrage mit einer eigenen E-Mail-Adresse.
3. Prüfe Preis, Zusammenfassung und die Texte.
4. Prüfe die Eingangsbestätigung.
5. Melde dich im Admin an.
6. Öffne die Buchung und setze sie testweise auf **Bestätigt**.
7. Prüfe die Auftragsbestätigung per E-Mail.
8. Setze den Testauftrag auf **Storniert** oder lösche ihn danach.

Wenn alle acht Punkte funktionieren, ist der Buchungsprozess für echte Anfragen bereit.
