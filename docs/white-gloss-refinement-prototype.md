# White-Gloss: Entwurf zur visuellen Freigabe

Dieser Branch ist ein Designprototyp, keine Veröffentlichung. Nicht ohne
ausdrückliche Betreiberfreigabe zusammenführen. Grundlage: main 7493f231.

## Vereinbarter Entwurf

- Ein ausgearbeiteter, dunkler und dezenter Vorschlag für die öffentliche Website.
- Erster Vergleich: Startseite, Preise, Keramikversiegelung, jeweils Desktop und Mobil.
- Originale Texte, Preise, Logo, Barlow-Schrift, Bildquellen, Filme und Links bleiben gleich.
- Klarere Hierarchie, Graphitflächen, silbrige Akzente, kompaktere Paketzeilen,
  ruhigere Bedienelemente und getrennte Text-/Fotoflächen auf Unterseiten.
- Kein Backend-, Datenmodell-, Admin- oder Integrationsumbau.

## Technische Umsetzung

Die zusätzliche CSS-Datei ist auf den öffentlichen Bereich begrenzt. Die
Testmarkierung `data-wg-baseline` am HTML-Element schaltet nur diese Datei aus;
sie wird ausschließlich durch das CI-Prüfskript gesetzt und ist kein
öffentliches Bedienelement. Damit entstehen Vorher/Nachher-Aufnahmen mit
identischen Komponenten und Daten. Es gibt keine neue Route und keinen
Varianten-Schalter für Websitebesucher.

## Sichtbare Nachweise

Nur der vorhandene isolierte Linux-GitHub-CI-Lauf rendert den Produktionsbuild.
`capture-refinement.mjs` erzeugt unter `.qa-output/prototype/` Ansichten mit
1440 × 1000 und 390 × 844 Pixeln sowie Detailaufnahmen. Vorher und Entwurf
nutzen reduzierte Bewegung für vergleichbare, ruhige Bilder. Die Fotos werden
vor der Aufnahme vollständig geladen. Externe Provider sind gesperrt; echte
Kundenbewertungen werden nicht durch erfundene Inhalte ersetzt.

Der Test vergleicht sämtliche Hauptinhalte, Bildquellen/Alternativtexte und
Linkziele zwischen beiden Zuständen. Zusätzlich prüft er Überlauf, den
Menüschalter und Fokus-Rückgabe. Bestehende isolierte SSR-, Buchungs- und
Sitemaptests bleiben erhalten. Formulare werden für diese Aufnahmen nicht
abgesendet. Die Hosting-Sperre bleibt unverändert.

## Nächster Schritt

PNG-Ansichten und Vergleichs-PDF im Chat beurteilen lassen. Erst nach der
Designfreigabe die Navigation semantisch gruppieren, weitere Seitenfamilien
ausarbeiten und die finale Umsetzung prüfen. Ein späterer Release benötigt
eine eigene ausdrückliche Freigabe und verwendet ausschließlich IONOS.
