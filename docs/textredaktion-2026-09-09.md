# Textüberarbeitung vom 9. September 2026

Die öffentlich zugänglichen Texte wurden auf verständliche Sprache und die bestehende Sie-Anrede geprüft. Überarbeitet wurden Paket- und Leistungsbeschreibungen, Navigation, Ratgebertexte, Ortsseiten, Formularhinweise und Fehlermeldungen. Die vorhandenen rechtlichen Bedingungen wurden nicht neu bewertet oder inhaltlich ersetzt.

## Bezeichnungen

| Bisher | Sichtbare Bezeichnung |
| --- | --- |
| Pur / Basis Pflege | Basisreinigung |
| Signature / Premium Glanz | Reinigung & Politur |
| Keramik / High-End Keramik | Keramikschutz |
| Interior Gloss | Innenraumreinigung |
| Ceramic Gloss | Keramikversiegelung |
| Lackatelier | Lackkorrektur |
| Air Pure | Geruchsbehandlung mit Ozon |
| Lichtklar | Scheinwerferaufbereitung |
| Engine Finish | Motorraumreinigung |
| Soft Top Care | Cabrioverdeckpflege |
| Private Client | Luxusfahrzeuge |
| B2B | Geschäftskunden |

Die übrigen Zusatzleistungen verwenden ebenfalls beschreibende deutsche Namen. Interne IDs und bisherige Paketparameter bleiben gültig. Historische gespeicherte Bezeichnungen werden nicht in der Datenbank überschrieben.

## Schutz bestehender SEO-Einstellungen

Unverändert bleiben URL-Pfade, Slugs, Canonical-Logik, Weiterleitungen, Sitemap, robots-Angaben, Metadaten-Titel und -Beschreibungen sowie zentrale H1- und Artikeltitel. Die bisherigen Suchbezeichnungen für automatisch erzeugte Leistungs-/Stadtseiten bleiben über `seoNav` erhalten. Deshalb können alte Namen weiterhin in Metadaten stehen; dies ist eine bewusste Ausnahme von der sichtbaren Vereinheitlichung.

Die Struktur der strukturierten Daten bleibt erhalten. Dynamisch eingebundene FAQ-Antworten entsprechen weiterhin den sichtbaren Antworten. Überarbeitete sichtbare Texte und Linkbeschriftungen können von Suchmaschinen neu bewertet werden; unveränderte Rankings sind damit nicht zugesichert.

## Noch inhaltlich zu klären

1. **Lederreparatur:** Die Leistungsübersicht nennt ab 119 €. In der zugehörigen Tabelle kostet nur die Textil-/Dachhimmelposition 119 €; Leder beginnt bei 139 €. Alle Beträge bleiben bestehen. Der Widerspruch ist im Quelltext markiert.
2. **Anzahlung:** Der Buchungshinweis verlangt bei Erstbuchung 10 %, die AGB formulieren dies als mögliche Anzahlung. Es wurde keine Variante als verbindliche neue Regel gewählt.
3. **Keramikpaket:** „Alle Leistungen“ des mittleren Pakets schließt sprachlich auch dessen Wachs ein. Zu bestätigen ist, ob die Keramikbeschichtung das Wachs ersetzt. Ebenso ist zu klären, ob die enthaltene Lederpflege denselben Umfang wie die Zusatzleistung mit Tiefenreinigung und Imprägnierung hat.
4. **Fahrzeugklasse:** „SUV / Limousine bis 5,00 m“ und „Transporter ab 5,00 m“ überschneiden sich bei genau 5,00 m. Zu bestätigen ist die gewünschte Zuordnung; Faktoren 1,25 und 1,55 bleiben unverändert.
5. **Punktuelle Reparaturen:** Einzelne Ratgeber nennen auch Steinschläge und begrenzte Lackschäden unter „Smart Repair“. Die konkreten Angebote beschreiben vor allem lackschadenfreie Dellenentfernung. Bitte den tatsächlich angebotenen Umfang bestätigen.
6. **Produktabhängige Pflegehinweise:** Die vorhandenen Angaben zu 7 Tagen ohne Wäsche und unproblematischem Regen wurden beibehalten. Sie sollten zum tatsächlich eingesetzten Beschichtungsprodukt passen.

Das Formular zur Ersteinschätzung übermittelt tatsächlich nur Kontaktdaten, Beschreibung und Dateinamen. Seine Beschriftung verspricht deshalb keinen Foto-Upload mehr. Die separate Uploadfunktion nach einer Terminanfrage bleibt erhalten.

Nicht belegte Vergleiche mit regionalen Wettbewerberpreisen und abwertende Aussagen über andere Anbieter wurden aus dem sichtbaren Preisteil entfernt. White-Gloss-Preise, Leistungspositionen, Fristen und Berechnungen bleiben unverändert.

## Prüfung

- Produktionsbuild und TypeScript-Prüfung erfolgreich.
- Automatisierte Tests geprüft; die bestehende Upload-Prüfung wurde auf die einheitliche Schreibweise „8 Aufnahmen“ angepasst.
- Lint ohne Fehler; drei vorhandene Warnungen in unveränderten Komponenten.
- 1.755 Preisberechnungen gegen den Ausgangsstand verglichen: gleiche Ergebnisse.
- 3 Pakete, 13 Zusatzleistungen, 10 Leistungen und 13 Orte auf unveränderte IDs und numerische Angaben geprüft.
- Browserkontrolle auf Desktop sowie bei 390 und 320 Pixel Breite, einschließlich Paketwahl und Formularvalidierung. Lange Zusatzleistungsnamen können innerhalb der Preiszeilen umbrechen.
- Die Live-Übersichten enthielten zum Prüfzeitpunkt 14 FAQ und 13 Ratgeber; keine zusätzlich sichtbaren CMS-Leistungen oder FAQ.

### Dreifache Schlusskontrolle

1. Sprache, Anrede und sichtbare Bezeichnungen erneut kontrolliert.
2. Preise gegen db1a957 verglichen; 1.755 Berechnungen unverändert. Auch die 13 dynamisch eingebundenen Ratgeber-Metabeschreibungen werden getrennt von den sichtbaren Einleitungen bewahrt.
3. Produktionsbuild erneut erfolgreich; Browserkontrolle bei 320, 390 und 1.366 Pixel Breite, ohne horizontalen Seitenüberlauf und ohne Fehler im abschließend geprüften Browserprotokoll.
