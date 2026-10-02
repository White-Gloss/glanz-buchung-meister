# White-Gloss: getrennte Verbesserungskopie

Stand: 2. Oktober 2026. Ausgangsstand: `White-Gloss/glanz-buchung-meister`,
`main`, Commit `9ec3b63f08a90d72ced674ecf6844b9475a3d576`.
Arbeitsbranch: `codex/website-verbesserungen-vorschau-20261002`.

Der Clone ist vollständig getrennt. Kein Merge nach main, kein Austausch von
white-gloss.de und kein lokaler Website-Server. Vor einer Veröffentlichung
entscheidet der Betreiber nach Sichtung. Alle Angaben zu einer neuen
Website-Version beziehen sich bis dahin auf diesen Clone.

## Umgesetzte Änderungen

| Änderung | Nutzen | Dateien |
| --- | --- | --- |
| Unverbindliche Anfrage direkt nach den drei Paketen | Weniger Scrollen zwischen Preisvergleich und Anfrage; bestehende Paket-/Ortsauswahl und Anker bleiben erhalten | `src/routes/index.tsx` |
| Autoaufbereitung als natürliche Suchvariante auf Startseite, Leistungsübersicht und allgemeiner Leistungsseite | Beide gebräuchlichen Begriffe werden abgedeckt; keine neuen Standorte oder Leistungsversprechen | `src/routes/index.tsx`, `src/routes/leistungen.index.tsx`, `src/data/site.ts` |
| Breadcrumb-Strukturdaten auf der Leistungsübersicht | Suchmaschinen erhalten dieselbe Hierarchie wie die sichtbare Navigation | `src/routes/leistungen.index.tsx` |
| Videobuttons nennen Aktion, Filmtitel, Kategorie und Dauer; Beschreibung separat | Videos lassen sich per Sprachsteuerung und Screenreader eindeutig finden; sichtbare Beschriftung bleibt Bestandteil des Namens | `src/components/customer-video-gallery.tsx` |
| Ladehinweis und telefonischer Anfrageweg ohne JavaScript | Zugänglicher Ladezustand und nutzbarer Ausweichweg | `src/components/lazy-configurator.tsx` |
| Desktop-/Mobilaufnahmen und Tastaturprüfung im bestehenden isolierten CI-Job | Konkrete Sichtung der Anfrage und Ergebnisse ohne lokalen Server oder echte Kundenvorgänge | `scripts/qa/check-responsive.mjs` |

Bilder, Hero-Film, Barlow-Schrift, Preise, Buchungslogik, Integrationen und
Rechtstexte stammen weiterhin aus dem aktuellen Repository. Keine neuen
Fallstudien, Bewertungen, Garantieaussagen oder Publikationsdaten erfunden.

## Die 17 ursprünglichen Auditpunkte

| Priorität | Punkt | Ergebnis / verbleibende Voraussetzung |
| --- | --- | --- |
| 1 | Google-Unternehmensprofil | Website-Fakten und Terminlink für die Pflege zusammengestellt; Änderung im richtigen Inhaberkonto noch offen. Siehe `GOOGLE-UND-BETRIEB.md`. |
| 2 | Bewertungsprozess | Vorhandene separate Einwilligung im Anfrageformular beibehalten; neutrale Vorlage vorbereitet. Keine Nachricht verschickt, kein Workflow aktiviert. |
| 3 | Autoaufbereitung | Im Clone umgesetzt. |
| 4 | 13 Ortsseiten | Vorhandenes Qualitäts-Gate geprüft; Workshop Horb und Abholgebiete bleiben getrennt. Keine pauschale Neuerstellung. |
| 5 | GSC vor Zusammenlegung | Aktuell geprüft: Able SEO Projekt 3098, GSC `NotConnected`. Keine irreversiblen Weiterleitungen ohne Nachfragebelege. |
| 6 | Echte Fallstudien | Bestehender Kundenauftrag mit Originalbildern und Filmen vorhanden; weitere belegte Aufträge benötigen freigegebene Fotos und echte Arbeitsschritte. |
| 7 | Kürzerer Anfrageweg | Im Clone umgesetzt. Live-Referenz: bei 1280×720 beginnt `#buchung` rund 6914 Pixel nach Seitenbeginn; neue Reihenfolge direkt nach `#pakete`. |
| 8 | Leistungsintentionen | Vorhandenes Intentionsmapping geprüft; allgemeine Leistungsseite um Autoaufbereitung ergänzt. |
| 9 | Ratgeber zusammenführen | Ohne GSC kein belegter Kandidat für eine verlustfreie Zusammenlegung; bestehende Inhalte erhalten. |
| 10 | Search Console | Verbindung offen; öffentliches Suchergebnis ist kein Ersatz für Impressionen, CTR und Positionen. |
| 11 | Strukturdaten | Service/Breadcrumb bereits vorhanden, Übersicht ergänzt. VideoObject bleibt bis zum belegten Erstveröffentlichungsdatum offen. |
| 12 | Zugängliche Namen | Instagram enthält bereits alle sichtbaren Texte. Videonamen im Clone eindeutiger; alter Auditbefund nicht pauschal als aktueller Fehler übernommen. |
| 13 | Buchungsflow | Bestehende serverlose Tests plus isolierte Linux-CI; neue Tastatur-/Fokusprüfung für Video. Vollständige Prüfung mit echtem Screenreader bleibt gesondert auszuweisen. |
| 14 | Recht/Betrieb | Keine unbestätigten rechtlichen Texte geändert. Abgleich von Medienfreigaben, Widerruf, Auftragsverarbeitung und Löschfristen benötigt bestätigte Betriebsabläufe. |
| 15 | lastmod/Erreichbarkeit | Sitemap nutzt bereits validierte Änderungsdaten aus dem CMS und belastbaren Fallback. Keine künstlich aktuellen lastmod-Werte gesetzt. |
| 16 | Performance | Bestehendes Lazy Loading, lokale Schriften und Klickstart der Kundenvideos erhalten; keine zusätzliche UI-Bibliothek. |
| 17 | CSP | Verschärfte Report-Only-Policy existiert bereits. Erzwungene Umstellung erst nach Auswertung tatsächlicher CSP-Verstöße und Betriebsprüfung. |

## Prüfstand

- Separater Clone und Ausgangscommit überprüft.
- Live-Referenz gelesen und visuell geprüft; keine Anfrage, Nachricht oder Datei gesendet.
- SEO/Sitemap/JSON-LD: 17 vorhandene Tests bestanden.
- ESLint: bestanden, fünf bestehende Warnungen in unveränderten Dateien.
- Polish-Detektor: keine Befunde für die geänderten UI-Dateien.
- Typprüfung, vollständige Tests, Build und CI: abschließende Ergebnisse siehe `PRUEFERGEBNISSE.md`.
- Neue Version nicht veröffentlicht und nicht live verifiziert.

## Vorschau und Abnahme

Der vorhandene IONOS-Weg aktiviert ausschließlich die Produktionswebsite.
Ein freigegebener separater Vorschauhost mit eigenem Datenbestand fehlt.
Details und konkrete Voraussetzungen: `preview-path.md`.
Die bestehenden Linux-CI-Prüfungen liefern Desktop-/Mobilbilder des Clones
als erste Sichtung. Eine interaktive IONOS-Vorschau benötigt das isolierte
Ziel und eine gesonderte Freigabe, bevor Serverkonfiguration geändert wird.

Zur Sichtung: Anfrageposition nach Paketen, Paket-/Ort-Vorbelegung,
Filmauswahl per Tastatur und die neuen Suchvarianten. Ein Austausch der
Produktionswebsite gehört nicht zu dieser Freigabe.
