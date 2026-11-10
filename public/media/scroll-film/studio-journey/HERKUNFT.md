# White Gloss: Studiofahrt

Am 10. November 2026 vom Inhaber als selbst erstellte Videos bereitgestellt und
für Schnitt sowie Verwendung auf der Website freigegeben. Atmosphärisches
Material, kein Nachweis eines Kundenfahrzeugs oder der eigenen Werkstatt.
Keine neue Generierung, kein Stockkauf und kein externer Upload für diesen Schnitt.

## Quellen

- Außenansicht: `Create-a-photorealistic-luxury-automotiv.mp4`, 5.200.665 Bytes.
  SHA-256: `cf42f38df78421f19815a6c5112c91e47e403ac4afa3b487555eb754f39a747a`.
- Innenraum: `Create-one-photorealistic-luxury-automot.mp4`, 5.085.228 Bytes.
  SHA-256: `0087fa2a2ce16a567ceeb29ac0ab5f9816977c0fb56a9c4bb9328b56dc15aa80`.
- Beide Quellen: 2560 × 1440, 24 Bilder/s, 8 Sekunden, H.264/AAC.

## Schnitt und Ausgabe

`bash scripts/prepare-studio-journey.sh AUSSEN.mp4 INNEN.mp4 [AUSGABE]`

Die Außenfahrt läuft vom Ende bis zur Quellposition 1,1 s rückwärts und wird auf
4,8 s verdichtet. Bei 4,2 s beginnt eine 0,6 s lange Überblendung auf die ersten
3,8 s des Innenraumfilms. Gesamtdauer: 8 s. Die Überblendung bleibt auch beim
Anhalten des Scrollens sichtbar und enthält keine Schwarzblende.

Mobil wird jede Szene separat ohne Verzerrung auf 9:16 zugeschnitten:
Außenansicht bei 40 %, Innenraum bei 45 % des horizontalen Zuschnittspielraums.
Die verlustlosen FFV1-Zwischenstufen liefern auch die Poster; die MP4-Ausgaben
werden nur einmal verlustbehaftet codiert.

| Ausgabe | Maße | Bytes |
| --- | --- | ---: |
| `classic-desktop-1280.mp4` | 1280 × 720 | 3.934.441 |
| `classic-mobile-540.mp4` | 540 × 960 | 1.875.764 |
| `poster-desktop-1280.webp` | 1280 × 720 | 47.938 |
| `poster-desktop-1920.webp` | 1920 × 1080 | 79.798 |
| `poster-mobile-540.webp` | 540 × 960 | 26.116 |
| `poster-mobile-720.webp` | 720 × 1280 | 41.088 |

Beide MP4s: H.264/yuv420p, 192 Frames, 24 Bilder/s, keine Audiospur,
64 Schlüsselbilder im Abstand von drei Frames, keine B-Frames, `faststart`.
Vollständige FFmpeg-Decodierung ohne Fehler geprüft. Browser-Seeking wird
zusätzlich in der isolierten GitHub-CI vorwärts und rückwärts geprüft.

Die neue Unterverzeichnis-URL verhindert eine Vermischung alter gecachter
Poster und neuer Videobilder. Die bisherigen Medien-URLs bleiben verfügbar.
Reduced Motion, Datensparen und direkte Buchungseinstiege behalten die
bestehenden statischen Fallbacks. Das Video lädt erst bei Scrollinteraktion.
