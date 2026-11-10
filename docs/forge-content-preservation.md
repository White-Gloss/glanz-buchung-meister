# Inhalts- und SEO-Schutz beim Forge-Redesign

## Referenz

Verglichen wird mit dem vor dem Redesign übernommenen Hauptbranch:
`db305e3c190cf53a0213c90ea3e788625ece091d` vom 10. November 2026.
Dieser Stand enthält bereits die aktuellen Paketnamen und das Website-Studio.

```bash
node scripts/check-design-content.mjs --base db305e3c190cf53a0213c90ea3e788625ece091d
node --test scripts/check-design-content.test.mjs
```

Der Vergleich liest ausschließlich Git und die Arbeitsdateien. Er startet
keinen Website-Server, schreibt keine Snapshots und greift nicht auf Kundendaten
oder Produktionsdienste zu. `--json` liefert maschinenlesbare Ergebnisse.

## Erfasster Ausgangsstand

- 83 Komponenten- und öffentliche Routendateien.
- 1.423 Text-/Copy-Einträge einschließlich lokal referenzierter Textdaten.
- 138 Überschriften mit ihrer semantischen Ebene.
- 357 Link-, Parameter- und Ankerdefinitionen.
- 69 SEO-/Routen-/Schema-Definitionen.
- 22 zusätzlich bytegenau geschützte Daten- und SEO-Dateien: unter anderem
  Leistungen, Preise, Ratgeber, Ortsinhalte, SEO-Policy, strukturierte Daten,
  Sitemap und Robots-Regeln.

Der TypeScript-Parser vergleicht Texte samt Anzahl, Überschriftenebenen,
Linkziele einschließlich Paketvorwahl, Formularbeschriftungen und
SEO-Definitionen. Das Entfernen von Inhaltskomponenten ohne eigenen Text
(etwa Bewertungen) wird ebenfalls gemeldet. Klassen, Styles, zusätzliche
Layout-Wrapper, die Reihenfolge vollständiger Abschnitte und Font-Preloads
können sich ändern. Neue Bilddateien und passend geänderte Alternativtexte
werden gesondert visuell und auf Zugänglichkeit geprüft.

## Nachträglich übernommene Buchungskorrektur

Nach dem visuellen Relaunch wurde [PR #327](https://github.com/White-Gloss/glanz-buchung-meister/pull/327)
in `main` übernommen. Diese fachliche Änderung verhindert doppelte Anfragen bei
einer Foto-Wiederholung und korrigiert die Bestätigung nach übersprungenem Upload.
Die dazugehörigen neuen Texte sind Teil der bereits geprüften und gemergten
Buchungskorrektur; der Relaunch darf nicht wieder zur falschen Aussage zurückkehren,
alle ausgewählten Fotos seien bereits eingegangen.

Für genau zwei Dateien verwendet der Inhaltsvergleich daher zusätzlich den
unveränderlich festgelegten, geprüften PR-Stand
`6daf3fc01834e94720ef4834f36e0534dfc93aaa`:

| Datei | Geschützte fachliche Änderung |
| --- | --- |
| `src/components/configurator.tsx` | Bereits gespeicherte Anfrage fortsetzen, übrige Fotos erneut senden oder später nachreichen. |
| `src/routes/danke.tsx` | Tatsächlichen Eingang bestätigen und fehlende Fotos sowie Angebot und Termin zutreffend erklären. |

Alle anderen Quelldateien und sämtliche 22 geschützten Daten-/SEO-Dateien werden
weiter gegen `db305e3` verglichen. Es werden keine Fehler ausgeblendet; auch die
neu freigegebenen Texte müssen erhalten bleiben. Die beiden Referenzen werden
in der CI explizit geladen, die verwendeten Dateireferenzen im Prüfbericht
ausgegeben. Fehlende Referenzstände führen zu einem Fehler.

Die Bestandszahlen oben dokumentieren die ursprüngliche Design-Abnahme. Der
aktuelle Prüfbericht berücksichtigt zusätzlich die Texte der Buchungskorrektur
und direkt gesetzte Fehlermeldungen aus `setError(...)`, einschließlich
Template- und bedingter Meldungen. Er umfasst damit 1.442 Texteinträge; die
Zahlen für Überschriften, Links, SEO-Definitionen und geschützte Dateien bleiben
unverändert.

## Ausdrücklich freigegebene CTA-Beschriftungen

Für den anschließenden Buchungs-CTA-Auftrag hat der Nutzer genau diese beiden
sichtbaren Textersetzungen freigegeben:

| Datei und vorhandener Link | Bisher | Neu |
| --- | --- | --- |
| `src/components/site-chrome.tsx`, `.header-film-booking` | Termin anfragen | Jetzt Termin anfragen |
| `src/components/scroll-film-hero.tsx`, `.scroll-film-cta` | Fahrzeug verwandeln lassen | Jetzt Termin anfragen |

Der Guard ersetzt dafür ausschließlich den erwarteten Textknoten des jeweiligen
eindeutigen Links im Vergleichsinventar. Beide Links müssen weiterhin auf
`/` mit dem Anker `buchung` verweisen und genau die neue direkte Beschriftung
tragen. Fehlende, doppelte oder an andere Stellen verschobene Beschriftungen
führen zu einem Fehler. Weitere Vorkommen von „Termin anfragen“, alle anderen
Texte sowie sämtliche Überschriften-, Link- und SEO-Prüfungen bleiben geschützt.

Es gibt dafür weder neue Datei-Baselines noch ausgenommene Quellen. Die oben
festgelegten Commit-Referenzen und die 22 bytegenauen Daten-/SEO-Vergleiche
bleiben unverändert. CLI- und JSON-Bericht nennen die beiden erlaubten
Textersetzungen ausdrücklich. Vergleiche mit einer eigenen `--base` verwenden
weiterhin deren unveränderte Texte; die zwei Freigaben gelten für die feste
Redesign-Referenz. Die Prüftests decken auch das Entfernen neuer Beschriftungen,
eine Änderung weiterer Textvorkommen und unverwandte SEO-/Linkänderungen ab.

## Aussagegrenze

Dieser Quellvergleich belegt die Erhaltung des vorhandenen Quellinhalts;
er ist kein Nachweis für Sichtbarkeit oder Suchmaschinenplatzierungen.
Dynamische Studio-Inhalte aus der produktiven Datenbank werden nicht exportiert
oder verändert. Deren vorhandene öffentliche Verarbeitung bleibt geschützt.
CSS-Verdeckung, responsive Darstellung, Bedienung ohne Animationen,
Ladeleistung sowie tatsächlich gerenderte Überschriften und Inhalte müssen
zusätzlich in der vorhandenen isolierten Linux-GitHub-CI geprüft werden.
Dafür bleiben `check-seo`, `audit-content`, die Mobilprüfung und die
Buchungsprüfungen maßgeblich.

Der Vergleich ist auf diesen visuellen Relaunch zugeschnitten. Bei einer
später ausdrücklich beauftragten Inhaltsänderung ist die gewählte Referenz
bewusst zu überprüfen; eine grüne Prüfung darf nicht durch automatisches
Neuschreiben der Referenz erzwungen werden.
