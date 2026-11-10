# Öffentliches Designsystem: Editorial Automotive

Stand: 10. November 2026. Visueller Relaunch nach Forge Automotive bei
unveränderten Texten, Preisen, URLs, Überschriften und SEO-Daten.
Die öffentliche Gestaltung liegt in `src/styles/studio.css`; das Betreiber-
und Login-Layout behält seine bisherigen Tokens.

## Gestaltung

- Schwarz `#080808`, Flächen `#111111` / `#1c1b19`, warmes Weiß `#f3f0e8`.
- Textstufen `#bcb8b0` und `#a6a198`; der Kontrasttest liest diese tatsächlichen
  öffentlichen CSS-Tokens und prüft alle Flächen auf mindestens 4,5:1.
- Lokal geladene Cormorant Garamond für Überschriften und variable Geist für
  Fließtext/Formulare. Die zwei Preloads umfassen 52.276 Bytes; weitere
  Cormorant-Gewichte laden bei Bedarf. Lizenzen und Quellen unter
  `public/fonts/EDITORIAL-FONTS.md`.
- Fixer Header mit zentralem Logo, stabiler Höhe, bestehenden Links und
  genau einem sichtbaren Buchungszugang; Bildmenü mit erhaltenem Dialogfokus.
- Klare Kanten, zurückhaltende Linien und große Bildflächen ersetzen den
  schwebenden Glasheader und das Bento-Paketraster. Die vorhandenen
  Inhaltslayouts in refinement.css/luxury.css bleiben als Grundlage erhalten;
  studio.css ersetzt ihre öffentliche Typografie und visuelle Ausarbeitung.

## Komponenten und Bewegung

- Hero: vorhandene, bedarfsgeladene Scrollfilm-Wiedergabe mit Poster,
  Pausieren, Rückwärtsscrollen und Daten-/Bewegungs-Fallback. Im zweiten
  Abschnitt verkleinert eine Bildmaske den Ausschnitt innerhalb der Stage.
- Pakete: `package-editorial.css`; ab 960 px eine gemeinsame CSS-Sticky-
  Bildfläche mit drei vollständigen Textkapiteln. Native Scrollposition
  bestimmt Bildwechsel und vorhandenen Zähler. Ohne JavaScript bzw. mit
  reduzierter Bewegung sind alle drei Bild-/Textpaare statisch sichtbar.
- Abholservice: `concierge-editorial.css`; bestehende drei Schritte mit
  dekorativem Bildwechsel im vorhandenen GSAP-Kontext. Sticky nur, wenn
  die unveränderte Überschrift samt Bild tatsächlich in den Viewport passt.
- Buchung: `booking-editorial.css`; dieselben drei Schritte, Desktop mit
  haftender Preisübersicht, mobil kompakte Preiszeile. Keine Animation oder
  Verschiebung von Formularfeldern und Aktionen.
- Bestehende Bildparallaxe, Prozessmarkierung und bedarfsgeladenes Lenis
  bleiben erhalten. Kein zweiter globaler Scrollcontroller.

## Inhalte und Medien

`npm run check:design-content` vergleicht gegen Commit
`db305e3c190cf53a0213c90ea3e788625ece091d`. Details und Grenzen stehen in
`docs/forge-content-preservation.md`. Vorhandene Kundenbilder bleiben echte
Referenzen; optionale neue Atmosphärenbilder und Higgsfield-Prompts stehen
in `docs/forge-media-brief.md`.

## Prüfung und Veröffentlichung

Lokal sind nur Build, Lint, Typprüfung und Tests ohne Website-Server erlaubt.
Browserprüfungen und Screenshots laufen in der bestehenden Linux-GitHub-CI.
Die Prüfungen erfassen Paketwechsel vorwärts/rückwärts, reduzierte Bewegung,
Headerüberlappung, Buchungsübersicht, Formularfunktionen und Sprungziele.
Der bestehende Hostinger-Releaseweg benötigt einen manuellen Dispatch für
exakten geprüften main-Commit und bestätigten Produktionsvorgänger; ein PR,
Merge oder erfolgreicher Build allein ist keine Veröffentlichung.
