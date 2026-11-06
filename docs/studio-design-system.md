# Studio-Designsystem („Liquid Luxury“)

Stand: 6. November 2026. Visuelles Upgrade der öffentlichen Website ohne
Textänderungen. Quelle der Wahrheit: `src/styles/studio.css` (letzte Schicht
der Kaskade, ohne `@layer`).

## Tokens

| Zweck | Token | Wert |
| --- | --- | --- |
| Hintergrund | `--color-bg` / `--studio-obsidian` | `#090a0d` |
| Sektionen | `--color-surface` / `--studio-graphite` | `#101217` |
| Erhöht | `--color-elevated` / `--studio-elevated` | `#171a21` |
| Glas | `--glass-bg` | `rgba(18, 20, 26, 0.7)` + `blur(20px)` |
| Glaskante | `--glass-edge` / `--glass-edge-hover` | `rgba(255,255,255,.08)` / `.22` |
| Lichtkante | `--light-edge`, `--light-glow` | Klarlack-Verlauf, nur Keramikschutz |

Die drei Flächen stehen zusätzlich in `@theme` (`src/styles.css`) und in
`src/lib/contrast.ts`; `src/lib/contrast.test.ts` prüft WCAG AA für alle
Textstufen auf allen Flächen (Minimum aktuell 6,26 : 1).

## Klassen

- `.glass` – Rauchglas-Karte. Weichzeichner erst ab 960 px (auf Smartphones
  über flachen Flächen unsichtbar, aber teuer).
- `.glass-interactive` – Hover: Kante `.22`, 4 px Lift; nur bei
  `(hover: hover) and (pointer: fine)`.
- `data-parallax-frame` – Rahmen, dessen `img` scrollgekoppelt gleitet
  (±5 % bei 12 % Überskalierung, nur Desktop).
- `data-lines` + `<RevealLines>` – maskierter Zeilen-Reveal für Headlines.

## Motion

| Was | Werkzeug | Warum |
| --- | --- | --- |
| Smooth Scroll | Lenis 1.3 (`src/lib/smooth-scroll.ts`) | nur Maus/Trackpad; Touch bleibt nativ |
| Hero-Headline | CSS-Keyframes (`translate`) | startet vor der Hydration, kein JS auf Smartphones |
| Section-Headlines | IntersectionObserver + CSS-Transition | einmalig, auch mobil, ohne GSAP |
| Parallaxe, Lichtlinie | GSAP ScrollTrigger (scrub) | an Scrollposition gekoppelt |
| Ablauf-Pin | CSS `position: sticky` | kein Pin-Spacer, ruckelfrei mit Lenis |
| Magnet-CTA | GSAP `quickTo` + `elastic.out(1, 0.75)` | Feder mit ~10 % Überschwinger |
| Dock | CSS `linear()`-Feder (bounce 0.2) | berechnet, Fallback starkes ease-out |

Regeln: nur `transform`/`translate`/`opacity` animieren; jede Bewegung hat eine
`prefers-reduced-motion`-Variante; gedimmte Zustände über Farbe, nie über
Deckkraft. GSAP und Lenis laden nur auf Desktop bzw. Zeigegeräten nach.

## Prüfung

Lokal ohne Website-Server: `npm run lint`, `npm run typecheck`, `npm test`,
`npm run build`. Browserprüfung ausschließlich im Linux-CI-Job
(`scripts/qa/run-checks.mjs`, Artefakt `isolated-qa-results`) und nach dem
Deployment auf der veröffentlichten Website (Workflow „Live Visual Check“).
