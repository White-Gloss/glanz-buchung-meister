# Ortsseiten: Ergänzung vom 7. Oktober 2026

## Inhalt und Buchung

Auf Betreiberwunsch kommen Sulz am Neckar, Empfingen, Vöhringen (Baden-Württemberg),
Dornhan, Dornstetten und Schopfloch (Landkreis Freudenstadt) als Abholgebiete hinzu.
Die Ausführung bleibt ausschließlich in Arnistal 27, 72160 Horb am Neckar.
Jeder Ort erhält einen Hub unter `/abholservice/{slug}` mit eigenem Ortsbezug,
Hinweisen zur Übergabeadresse, Leistungen, bestehenden Paketpreisen und Anfrageweg.
Interne Links, Suchintents, strukturierte Daten und die Ortsauswahl verwenden
dieselbe Ortsliste. Die Wahl von Ort, Paket und Einzelleistung bleibt erhalten.

Für die sechs neuen Gebiete sind keine betrieblich bestätigten Kilometer- oder
Minutenwerte vorhanden. Diese Werte bleiben ausdrücklich `null`; sie werden
weder geschätzt noch als null Kilometer gewertet. Der Rechner weist die
Abholung bei allen Paketen als „auf Anfrage“ aus und kennzeichnet die Kosten
als offen. Die bestehenden Entfernungsstaffeln und die Keramik-Regel bis 60 km
bleiben unverändert; ihre Anwendung setzt die Prüfung der konkreten Adresse voraus.

Vorhandene Leistungs-Ortsseiten zeigen zusätzlich den bereits freigegebenen
Arbeitsablauf der jeweiligen Leistung. Dieser Inhalt verbessert die Information
für direkte Besucher, ersetzt aber keinen örtlichen Nachweis.

## Indexierung

Die sechs Orts-Hubs sind für Indexierung vorgesehen: 19 statt 13 Abholorte und
54 statt 48 statische Sitemap-Ziele. Die Aufnahme ist keine Garantie, dass Google
eine Seite indexiert. CMS-Veröffentlichungen können weitere Sitemap-Ziele ergänzen.

Die bestehende Qualitätsprüfung für Leistungs-Ortskombinationen bleibt erhalten.
Der direkt zugängliche Search-Console-Bericht wurde am 07.10.2026 einschließlich
aller 48 ausgewiesenen Suchanfragen gelesen (Filter: Web, 3 Monate; tatsächliche
Diagrammspanne 09.08.–04.10.2026). Einzelne lokale Anfragen stützen bestehende Hubs.
Kein geprüfter Kandidat erfüllte jedoch gemeinsam Nachfrage, zwei belegte lokale
Betriebsinformationen und einen echten veröffentlichbaren Ortsnachweis.
Anonymisierte bzw. nicht ausgewiesene Anfragen sind nicht als fehlende Nachfrage
zu interpretieren. Ein Wettbewerbertreffer ist ebenfalls kein Suchvolumenbeleg.

Deshalb wird keine dieser Kombinationen pauschal auf `index` gesetzt. Die 171
angebotenen Kombinationen bleiben `noindex,follow`; 19 Scheinwerfer-Varianten
leiten zur zentralen Erläuterung weiter. Das vollständige interne Prüf-Inventar
umfasst 251 URLs, die öffentliche Sitemap enthält davon 54. Keine zusätzlichen
Matrixseiten werden in Navigation oder Sitemap beworben.

## Quellen für die Ortsangaben

Die kommunalen Quellen belegen ausschließlich die geografische Zuordnung,
keine Kundenreferenzen, Fahrzeiten, Suchnachfrage oder Zusammenarbeit mit White Gloss.

- Sulz: https://www.sulz.de/stadtteile/ortsteil-webseiten
- Empfingen/Wiesenstetten/Dommelsberg: https://www.empfingen.de/gemeinde-wirtschaft/geschichte-wappen/geschichte-wiesenstetten
- Vöhringen/Wittershausen: https://www.voehringen-bw.de/de/gemeinde-daten/wissenswertes
- Dornhan: https://www.dornhan.de/fileadmin/Dateien/Dateien/Ortsrecht/2023-/Satzung_zur_Aenderung_der_Hauptsatzung.pdf
- Dornstetten/Aach/Hallwangen: https://www.dornstetten.de/leben/
- Schopfloch/Oberiflingen/Unteriflingen: https://www.schopfloch.de/rathaus-service/ortsrecht
- Google zu Doorway-Seiten: https://developers.google.com/search/docs/essentials/spam-policies#doorway-abuse

## Prüfung und Veröffentlichung

Vor Veröffentlichung: Lint, Typprüfung, bestehende Unit-Tests, SEO-/Sitemap-Tests,
Produktions-Build sowie die vorhandene isolierte Linux-GitHub-CI. Die neuen
Tests prüfen insbesondere, dass unbekannte Entfernungen keine kostenlose Abholung
erzeugen und die sechs Orte mit der gewählten Leistung in der Anfrage ankommen.
Kein lokaler Website-Server. Kein Absenden echter Kundenanfragen.

Der erste Linux-Lauf bestand 646 Unit-Tests, SSR, Ablauf-, Sitemap- und SEO-Prüfung
sowie 111 mobile Seitenansichten ohne Überlauf. Er erreichte anschließend das
120-Sekunden-Limit der Responsive-Stufe. Nur diese Stufe erhält für die sechs
zusätzlichen Orte ein begrenztes 180-Sekunden-Budget; keine Seite oder Prüfung
wird ausgelassen. Das Formular wartet separat höchstens 15 Sekunden auf Sichtbarkeit.
Ein weiterer Lauf blieb bereits im Rendering-Yield der ersten Seite hängen.
Der Test aktiviert deshalb seinen Browser-Tab und begrenzt das Warten auf
Animationsframes auf 100 ms; die anschließenden Layout-Lesezugriffe und alle
Überlaufprüfungen bleiben bestehen. Navigation, Elemente und JavaScript-Fehler
werden weiterhin geprüft und zeitlich begrenzt.

Die Abhängigkeit `source-map-js` wird ausschließlich im Lockfile von 1.2.1 auf
1.2.2 aktualisiert, weil die bestehende Produktions-Audit-Prüfung die alte Version
wegen GHSA-68fv-2mgg-jv7q ablehnt. Keine Änderung von Anwendungsschnittstellen.

Ein PR oder erfolgreicher Build belegt noch keine Veröffentlichung. Nach dem
freigegebenen IONOS-Release müssen die sechs Hubs, Sitemap, Robots, Canonicals
und Buchungsauswahl auf der öffentlichen Domain erneut geprüft werden.
