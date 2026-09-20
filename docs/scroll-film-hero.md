# Startseitenfilm – Entwurf zur Freigabe

Basis: `main` bei `799f8207b53469acaffa48c9b5924f596668130d`.
Arbeitsbranch: `feat/scroll-film-hero`. Keine Veröffentlichung und kein Merge.

## Material und Gestaltung

Verwendet ausschließlich die beiden vom Inhaber gelieferten Aufnahmen:
- Mobil: `798913686_1789839059368318.mp4`, 1080 × 1920, 9:16, 6.094.221 Bytes.
- Desktop: `636740916_1789841150714460.mp4`, 1920 × 1080, 16:9, 4.442.996 Bytes.
Beide: 8 s, 24 fps, 192 Bilder, H.264/AAC. Kamerafahrt vom hinteren Seitenteil
über die Türöffnung zum Interieur. Kein 3D-Modell und keine generierte Erweiterung.
Der bereits im jeweiligen Original vorhandene Anschnitt bleibt erhalten.

Desktop: bildschirmfüllende schwarze Bühne mit dem Querformat, Typografie links.
Smartphone: das separate Hochformat, Text unten. Text und Schleier verschwinden
früh, bevor die Tür geöffnet wird. `object-fit: contain` verhindert zusätzlichen
Beschnitt auch bei abweichenden Bildschirmformaten. Kein weiteres Video nötig.
Beim Wechsel über den 768-px-Breakpoint wird die passende Quelle geladen.

Native Scrollbewegung, CSS sticky (460 svh Desktop / 380 svh Mobil). Keine
Scroll- oder Touch-Sperre. Verlauf kehrt beim Rückwärtsscrollen um. Nach dem
letzten Bild verlässt die Bühne den Viewport. Überspringen-Link, Pause und
bestehende feste Navigation bleiben erreichbar; mobil zusätzlicher Buchungslink.

## Medienentscheidung

| Variante | Umfang | Einordnung |
|---|---:|---|
| Desktop-Original | 4.442.996 Bytes | Ausgangsmaterial mit Ton |
| Video Desktop 1280 × 720 | 3.809.130 Bytes | H.264, GOP 3, keine B-Frames, faststart |
| Video Mobil 540 × 960 | 2.579.962 Bytes | Gleiches Suchformat, kleinere Auflösung |
| Vergleichssequenz 540 × 960 WebP Q75 | ca. 5,2 MB / 192 Dateien | Mehr Requests; ca. 380 MiB als alle dekodierten RGBA-Bilder |
| Poster Mobil 540 / 720 | 31.994 / 52.238 Bytes | Erstes Bild der Hochformatfahrt |
| Poster Desktop 1280 / 1920 | 46.648 / 70.466 Bytes | Erstes Bild der Querformatfahrt |

Entscheidung: Video-Seeking; ein Schlüsselbild spätestens alle 125 ms. Bildsequenz
nicht übernommen. Exakte Dateigrößen siehe Git-Dateien. Reproduzierbar mit
`scripts/prepare-scroll-film.sh HOCHFORMAT.mp4 QUERFORMAT.mp4` und FFmpeg.

Responsive Poster-Preload entspricht dem `img`-srcset. Videodownload erst nach
Laden des Posters, nur bei geeigneter Verbindung/Geräteleistung. Keine Audiospur,
kein Autoplay. Seeks werden serialisiert; nur das aktuelle Scrollziel zählt.
Poster bleibt hinter dem Video. Video wird erst nach dekodiertem Bild sichtbar.
Offscreen/unsichtbare Tabs stoppen die laufende Steuerung. Direkte Einstiege mit
`#buchung` bleiben statisch, damit das Formularziel beim Hydrieren stabil bleibt.

Reduced Motion, Datensparmodus, 2G/3G, ≤2 GB gemeldeter Arbeitsspeicher oder
≤2 CPU-Kerne: statisches Poster ohne Videodownload und ohne langen Scrollbereich.
Mediafehler: Poster; bei schon begonnener Fahrt bleibt die Dokumenthöhe stabil.
Unsichtbare Intro-Links sind `inert`, damit sie nicht per Tab fokussiert werden.

## Bestand

Leistungsdaten, Preise, Buchungskomponenten, Backend und Versand bleiben erhalten.
Der bisherige längere Einführungstext steht unter den Kennzahlen. Offene PRs #195
und #236 wurden nicht übernommen oder verändert. Bestehende CSS-Effekte anderer
Seiten und das bisherige HeroMedia bleiben erhalten.

## Prüfung und offene Abnahme

- Produktionsbuild, TypeScript-Prüfung und ESLint der betroffenen TSX-Dateien.
- 14 Tests führen den tatsächlichen React-Effekt mit Ereignis-/Medien-Doubles aus:
  Poster zuerst, Mobilvariante, statische Fallbacks, Vor-/Rückwärtsscrollen,
  Grenzwerte, keine parallelen Seeks, Pause, Sichtbarkeit, Präferenzänderung,
  Fehlerfall und Aufräumen. `node --test scripts/scroll-film.test.mjs`.
- Lokaler isolierter SSR-Aufruf liefert HTTP 200 mit Hero und Buchungsabschnitt.
- FFmpeg dekodiert alle 192 Bilder; keine schwarzen Vollbilder erkannt.
- **Browserabnahme offen:** Cloud-Browser blockiert lokale HTTP- und Datei-URLs.
  Kein nachgewiesener visueller Desktop-/Smartphone-Test, kein realer Decoder-
  oder Netzwerk-Latenznachweis. Vor Merge Chrome Desktop, Android Chrome und
  iOS Safari prüfen: Vor-/Rückwärtsfahrt, schnelles Scrollen, Pause, Einstieg mit
  #buchung, Menütastatur, Reduced Motion, langsames Netz, Orientierung und Reload.

Die separate HTML-Dateivorschau enthält denselben Hero-Code mit eingebetteten
Medien sowie eine statische Kopie der folgenden Startseiteninhalte. Links führen
zur bestehenden Website; Buchung/Backend laufen in dieser Dateivorschau nicht.
Die Vorschau ist ohne Server eigenständig öffnbar, aber hier nicht im Browser
abgenommen. Kein Deployment bis zur Freigabe durch Lars.
