# Rechtstexte und Abmahnschutz – Stand 1. Oktober 2026

Prüfung der Website white-gloss.de auf typische Abmahnrisiken (Impressum,
Datenschutz, Widerruf, AGB, Cookies, Bewertungen) und was außerhalb des
Repositorys noch zu erledigen ist. Keine Zugangsdaten, keine Kundendaten.

Diese Prüfung ersetzt keine Beratung durch eine zugelassene Anwältin oder einen
Anwalt. Sie bildet den Stand der Gesetze und der Website am 1. Oktober 2026 ab.

## Auf der Website umgesetzt

| Thema | Änderung | Rechtsgrundlage |
| --- | --- | --- |
| Widerrufsbutton | Neue Seite `/vertrag-widerrufen`, Link „Vertrag widerrufen“ hervorgehoben im Fußbereich jeder Seite, auf Widerrufs-, Impressums-, AGB- und Statusseite. Abfrage von Name, Vertrag, Umfang und E-Mail; Schaltfläche „Widerruf bestätigen“; Eingangsbestätigung per E-Mail mit Inhalt, Datum und Uhrzeit; Meldung an den Inhaber. Gespeichert im bestehenden Ausgang, keine neue Datenbankmigration. | § 356a BGB (seit 19.06.2026) |
| Widerrufsbelehrung | Wortgetreu nach Muster (Anlage 1 zu Art. 246a EGBGB) inklusive neuem Gestaltungshinweis 3 zur Online-Widerrufsfunktion; Wertersatz-Absatz exakt nach Muster; Erlöschen nach § 356 Abs. 4 BGB; voller Name. | §§ 312g, 355–357a BGB |
| Impressum | Voller Name „Lars Marco Hägele“, Geschäftsbezeichnung, Rechtsform, Anschrift, Telefon, E-Mail, USt-IdNr., Verweis auf AGB und Widerruf. Keine Steuernummer (nicht vorgeschrieben). | § 5 DDG, § 18 Abs. 2 MStV, § 36 VSBG |
| Datenschutzerklärung | Neu gefasst: Anfrage, Fotos/Videos (Supabase), Auftragssoftware RO App mit digitaler Unterschrift, Bitrix24-Altdaten, E-Mail-Versand (Resend, IONOS), Postfach bei Google, Terminerinnerung, Bewertungsbitte mit Einwilligung, Qonto (Rechnung, Überweisung, Kartenzahlung, Zahlungsstatus), WhatsApp, Google (Tag, Maps, Bewertungen, Anmeldung), Cookies, Widerrufsfunktion, Empfänger, Drittländer, konkrete Speicherfristen, Widerspruchsrecht, Aufsichtsbehörde. | Art. 13 DSGVO, § 25 TDDDG |
| AGB | Vertragsschluss wie im echten Ablauf (Angebot per E-Mail → Annahme mit Unterschrift auf der Auftragsseite), Vertragssprache, Speicherung des Vertragstextes, Korrektur von Eingabefehlern, Zahlung bis Fälligkeitsdatum, gesetzliche Mängelrechte, Widerrufsfunktion, Streitbeilegung. | §§ 305 ff., 312i BGB, Art. 246c EGBGB |
| Cookie-Banner | „Ablehnen“ und „Akzeptieren“ gleichwertig gestaltet, Hinweis auf USA-Übermittlung und Änderbarkeit. | § 25 TDDDG, Art. 7 DSGVO |
| Bewertungen | Hinweis, dass Google-Bewertungen ungefiltert angezeigt und nicht selbst auf Echtheit geprüft werden. | § 5b Abs. 3 UWG |
| Auftragsstatus | Vor „Auftrag prüfen und unterschreiben“ Hinweis auf verbindliche, zahlungspflichtige Beauftragung, AGB und Widerrufsrecht; Link „Vertrag widerrufen“ mit vorausgefüllter Vorgangsnummer. | §§ 312d, 312j BGB |

## Muss der Inhaber selbst erledigen (nicht aus dem Repository möglich)

Reihenfolge nach Abmahn- und Haftungsrisiko.

### 1. RO App: Annahme-Schaltfläche und Angebotstext (hoch)

Der Vertrag kommt auf der Auftragsseite von RO App zustande. Dort gilt die
„Button-Lösung“: Die Schaltfläche, mit der der Kunde verbindlich annimmt, muss
**„Zahlungspflichtig beauftragen“** (oder „zahlungspflichtig bestellen“)
heißen. „Annehmen“, „Bestätigen“ oder „Unterschreiben“ reichen nicht
(§ 312j Abs. 3 BGB) – sonst kommt kein wirksamer Vertrag zustande, und
Mitbewerber können abmahnen. Unmittelbar über der Schaltfläche müssen
Leistungen, Festpreis inkl. USt und Termin klar sichtbar sein (§ 312j Abs. 2 BGB).

Falls RO App die Beschriftung nicht ändern lässt: RO-Support fragen. Bis dahin
sicherer Weg: Annahme per Antwort-E-Mail oder in der Werkstatt.

In das Angebotsdokument bzw. die Angebots-E-Mail von RO App gehört folgender
Block (vor der Unterschrift):

```text
Anbieter: Lars Marco Hägele, White Gloss Detailing (Einzelunternehmen),
Arnistal 27, 72160 Horb am Neckar, Tel. 0152 33540284, info@white-gloss.de,
USt-IdNr. DE465024196.

Es gelten unsere AGB: https://white-gloss.de/agb
Es gelten die gesetzlichen Mängelrechte.

Widerrufsrecht für Verbraucher: Sie können diesen Vertrag binnen 14 Tagen ab
Vertragsschluss ohne Angabe von Gründen widerrufen. Die vollständige
Widerrufsbelehrung und das Muster-Widerrufsformular finden Sie unter
https://white-gloss.de/widerruf. Sie können den Vertrag auch online unter
https://white-gloss.de/vertrag-widerrufen widerrufen.

[ ] Ich verlange ausdrücklich, dass White Gloss Detailing vor Ablauf der
Widerrufsfrist mit der Leistung beginnt. Mir ist bekannt, dass ich bei einem
Widerruf Wertersatz für die bis dahin erbrachten Leistungen schulde und dass
mein Widerrufsrecht bei vollständiger Vertragserfüllung erlischt.
```

Das Kästchen ist nur nötig, wenn der Termin innerhalb von 14 Tagen nach der
Annahme liegt. Ohne diese ausdrückliche Erklärung schuldet ein Kunde, der nach
der Aufbereitung widerruft, **gar nichts** (§ 357a Abs. 2 BGB).

Besser noch: die vollständige Widerrufsbelehrung samt Muster-Formular als Text
oder PDF direkt in die Angebots-E-Mail aufnehmen (dauerhafter Datenträger).

### 2. Vertragsbestätigung nach Annahme (hoch)

Nach der Annahme muss der Kunde eine Bestätigung mit dem Vertragsinhalt auf
einem dauerhaften Datenträger (E-Mail/PDF) bekommen, spätestens vor Beginn
der Arbeiten (§ 312f Abs. 2 BGB). Enthielt schon die Angebots-E-Mail alle
Angaben und die Widerrufsbelehrung, genügt eine kurze Bestätigung des
Vertragsinhalts. In RO App die Kundenbenachrichtigung für „Akzeptiert“ oder
„Termin verbindlich“ entsprechend einrichten.

### 3. Qonto-Organisation (hoch, Rechnungspflichtangaben)

Qonto → Einstellungen → Organisation bzw. Rechnungseinstellungen:

- Name: **Lars Marco Hägele – White Gloss Detailing** (voller Vor- und Nachname
  des Inhabers ist Pflicht, § 14 Abs. 4 Nr. 1 UStG)
- Anschrift: Arnistal 27, 72160 Horb am Neckar, Deutschland
- USt-IdNr.: DE465024196 (alternativ oder zusätzlich die Steuernummer)
- E-Mail info@white-gloss.de, Telefon 0152 33540284
- Auf jeder Rechnung: fortlaufende Rechnungsnummer, Rechnungsdatum,
  **Leistungsdatum bzw. -zeitraum**, Menge und Art der Leistung, Nettobetrag,
  19 % USt, Steuerbetrag, Bruttobetrag, bei Rechnungen über 250 € Name und
  Anschrift des Kunden, Zahlungsziel, IBAN
- Rechnungs-E-Mail-Text von Qonto: Absendername „White Gloss Detailing“

Die bisherige Rechnung RE-2026-001 trägt im Dateinamen bereits
„White Gloss Detailing Lars Marco …“ – bitte einmal im PDF prüfen, ob Anschrift,
USt-IdNr. und Leistungsdatum vollständig sind.

### 4. Instagram, Google-Profil und WhatsApp Business (hoch)

Geschäftliche Social-Media-Profile brauchen ein eigenes, leicht erreichbares
Impressum (klassischer Abmahngrund). Im Instagram-Profil
`white_gloss.detailing` in der Bio oder als Link „Impressum“:
`https://white-gloss.de/impressum`. Ebenso im WhatsApp-Business-Profil
(Beschreibung oder Website-Feld) und im Google-Unternehmensprofil (Website-Feld
zeigt auf white-gloss.de; Name dort einheitlich verwenden).

### 5. Auftragsverarbeitungsverträge (mittel)

Mit jedem Dienst, der für White Gloss Kundendaten verarbeitet, muss ein
Auftragsverarbeitungsvertrag (AVV/DPA) bestehen (Art. 28 DSGVO):

- IONOS: AVV im IONOS Control Center abschließen
- Supabase, Resend, RO App: DPA in den Kontoeinstellungen bzw. auf der Website
  annehmen und ablegen
- Qonto: Bestandteil der Qonto-Bedingungen; Bestätigung ablegen
- Google Ads: Datenverarbeitungsbedingungen im Google-Ads-Konto akzeptieren

**Postfach:** E-Mails an info@white-gloss.de landen in einem privaten
Gmail-Konto. Für private Gmail-Konten bietet Google keinen
Auftragsverarbeitungsvertrag an. Lösung: auf Google Workspace umstellen (mit
Data Processing Amendment) oder Kundenmails im IONOS-Postfach bearbeiten.

### 6. Datenschutz-Organisation (mittel)

- Verzeichnis von Verarbeitungstätigkeiten anlegen (Art. 30 DSGVO); die
  Abschnitte der Datenschutzerklärung sind eine gute Gliederung.
- Löschfristen tatsächlich umsetzen: Anfragen ohne Auftrag nach spätestens
  zwölf Monaten löschen; Fotos nach Ablauf der Fristen über „Speicher
  aufräumen“ im Adminbereich entfernen.
- Wer eine neue Anbindung einschaltet (z. B. Meta-Pixel, KI-Assistent,
  weitere CRM), muss vorher die Datenschutzerklärung ergänzen lassen.

### 7. Widerrufe bearbeiten

Online-Widerrufe erscheinen als E-Mail „Widerruf eingegangen: WR-…“ (und
WhatsApp, falls eingerichtet) an die Inhaberadresse und werden zusätzlich als
Ereignis `widerruf/eingegangen` in `automation_events` protokolliert. Die
vollständige Erklärung liegt im Ausgang (`outbound_queue`, Schlüssel
`withdrawal:WR-…`). Termin absagen, Zahlungen spätestens 14 Tage nach Eingang
über dasselbe Zahlungsmittel erstatten.
