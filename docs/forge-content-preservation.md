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
