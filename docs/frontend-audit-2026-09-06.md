> Historischer Bericht der ersten Runde (Commit 31c6761). Die spätere Umsetzung und die endgültigen Messwerte stehen im Fortsetzungsbericht.

# White Gloss – umgesetzte Frontend-Optimierung

Stand: 6. September 2026. Repository: White-Gloss/glanz-buchung-meister. Ausgangscommit: c92e2d855b21112006d284a078886c98d635f9a4. Lokaler Branch: codex/performance-accessibility-seo.

Die tatsächlichen Projektdateien wurden im lokalen Git-Checkout bearbeitet. Kein Push, Pull Request oder Deployment wurde ausgeführt. Supabase wurde zur Zuordnung der vorhandenen Projekte gelesen; Produktionsdaten, Zugangsdaten und Schemas wurden nicht geändert. Das Projekt verwendet TanStack Start mit serverseitigem Rendering, React 19, Tailwind CSS 4, Nitro und npm.

Lokaler Checkout: C:/Users/info/Documents/Codex/2026-09-06/vercel-plugin-vercel-openai-curated-remote-3/work/glanz-buchung-meister

## 1. Änderungen

| Bereich | Umsetzung und Dateien |
|---|---|
| Übertragung und Caching | Nitro erzeugt Gzip-/Brotli-Varianten für statische Dateien. Nur versionierte Buildassets erhalten langfristiges Immutable-Caching; austauschbare Medien, Fonts, Icons und Manifest werden revalidiert. Private/no-store-Antworten bleiben geschützt. Dateien: vite.config.ts, server/cache-policy.ts, server/middleware/security-headers.ts, server/middleware/grok-pwa.ts. |
| Bilder und Bewegung | media.tsx und lib/seo.ts nutzen die bereits vorhandenen kleineren 1200px-Varianten. Acht AVIF-Dateien zusammen: 330.161 → 296.291 Bytes; acht WebP-Dateien: 628.574 → 555.896 Bytes. Keine neuen Bildabhängigkeiten. Der Videoloop startet erst nach dem Standbild bei sichtbarem Element/Tab, respektiert reduzierte Bewegung und Datensparen, pausiert außerhalb des Viewports und räumt seinen Ladezyklus auf. Pause/Fortsetzen ist bedienbar. Der bestehende, ausdrücklich auf Labortiming ausgerichtete 20s-Fallback wurde entfernt. |
| Buchungsrechner | lazy-configurator.tsx verarbeitet den von TanStack gelieferten Hash ohne führendes #. Der direkte Buchungsanker lädt den Rechner sofort. |
| Navigation und Einwilligung | site-chrome.tsx nutzt einen nativen modalen Dialog mit internem Schließen-Schalter, zyklischem Tab-Fokus und Rückgabe an den Auslöser. Consent-Escape wirkt nur innerhalb des Banners. consent-banner.tsx, whatsapp-float.tsx und media.tsx berücksichtigen die tatsächliche Bannerhöhe, damit schwebende Bedienelemente sichtbar bleiben. |
| Formulare | configurator.tsx, photo-inquiry.tsx und public-form-validation.ts spiegeln bestehende serverseitige Eingabegrenzen für verständliche Rückmeldungen. Feldfehler sind verknüpft und das erste fehlerhafte Feld erhält Fokus. submission-result.tsx fokussiert Erfolgsmeldungen. API und Geschäftslogik bleiben erhalten. |
| Reflow und zugängliche Namen | workshop-map.tsx und styles.css begrenzen die Kartenbreite und lassen die Beschriftung umbrechen. Der Datenschutztext in photo-inquiry.tsx bleibt ein zusammenhängendes Textelement. Paketlinks auf der Startseite erhalten ihren zugänglichen Namen aus dem sichtbaren Inhalt. Die Höhe der beiden nebeneinander bzw. untereinander angeordneten Angebotskarten wird ohne die zuvor überlappende content-visibility-Ersatzhöhe berechnet. |
| Stadtseiten und Metadaten | leistungen.$slug.tsx ist ein Layout; der Basisinhalt liegt in leistungen.$slug.index.tsx. Alle 130 Stadt-Leistungs-Kombinationen rendern damit den vorgesehenen Inhalt mit genau einem Canonical. routeTree.gen.ts wurde durch den Build aktualisiert. grok-pwa-shared.mjs bewahrt vorhandene Open-Graph-Tags und ergänzt nur fehlende Defaults; PWA und Plattformbranding bleiben erhalten. |
| Wartbarkeit | Der vorhandene ESLint-Fehler und nachweislich ungenutzte Imports wurden bereinigt. Die Sitemap-Dokumentation beschreibt nun korrekt die statische Datei. Neue Regressionstests und die bisher separate PWA-Suite sind in die Prüfkommandos eingebunden. Keine Projektabhängigkeiten oder Lockfile-Versionen geändert. |

Die Dialogkorrektur folgt dem [WAI-Dialogmuster](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), die Routentrennung den [TanStack-Dateikonventionen](https://tanstack.com/router/latest/docs/routing/file-naming-conventions).

## 2. Tatsächlich ausgeführte Prüfungen

| Prüfung | Vorher | Nachher |
|---|---|---|
| Node-Produktionsbuild | bestanden | bestanden, einschließlich SSR-Exportprüfung |
| TypeScript | bestanden | bestanden |
| ESLint | 1 Fehler, 7 Warnungen | 0 Fehler, 3 bereits vorhandene Warnungen |
| npm test | 92 bestanden | 158 bestanden |
| Produktions-Regressionen | Fehler in Stadtrendering, Canonical und OG nachgewiesen | 5 Tests bestanden; darunter sämtliche 130 Stadt-Leistungs-Kombinationen, echte 404-Antworten, Noindex, Metadaten, Gzip und Cacheheader |
| axe / Reflow | zwei mobile Durchläufe mit verdecktem Touch-Ziel; Überlauf bei Kontakt und Dellen | 24 Prüfungen: keine automatisierten WCAG-A/AA-Befunde, kein horizontaler Überlauf |
| Tastatur / Interaktion | Escape verlor den Fokus und konnte die Cookie-Auswahl ändern | 20 Tab-Schritte im Dialog, Rückgabe nach Escape, Cookie-Auswahl unverändert; feldbezogene Validierung mit Fehlerfokus; Pause/Fortsetzen; direkter Buchungsanker geprüft |

Browserrouten: /, /preise, /leistungen/keramikversiegelung, /leistungen/keramikversiegelung/nagold, /kontakt, /dellen-hagelschaden, /ratgeber und eine absichtlich unbekannte Route. Viewports: 1280×800, 390×844, 320×800. Der 404-Konsolenhinweis der absichtlich unbekannten URL ist erwartet; auf den übrigen geprüften Seiten gab es keine Konsolen-/Hydrationsfehler. Screenshots ausgewählter Mobil- und Desktopzustände wurden visuell kontrolliert.

Die drei verbleibenden ESLint-Warnungen betreffen die schon vorhandenen reload-Hook-Abhängigkeiten in channel-inbox.tsx/cms-editor.tsx sowie den gemischten Export in media.tsx. Kein neuer Lint-Befund bleibt bestehen.

## 3. Reproduzierbare Lighthouse-Labormessungen

Lighthouse 13.4.1, Headless Chrome, Windows, Node 24.19.0; unveränderte Default-Mobileinstellungen beziehungsweise explizite Desktopkonfiguration von Lighthouse. Je Route und Gerät drei Läufe, berichtet wird der Median. Separate lokale Node-Produktionsbuilds: Baseline Port 8081, Endstand Port 8082. Browsercache/Storage werden von Lighthouse je Lauf zurückgesetzt. Es handelt sich um einen geteilten lokalen Rechner, nicht um eine kontrollierte Messstation oder reale Besucherdaten.

| Route / Gerät | Performance | LCP | CLS | Übertragene Daten |
|---|---:|---:|---:|---:|
| / · Mobil | 68 → 91 | 5.26 → 2.93 s | 0.0072 → 0.0087 | 834 → 409 KiB |
| /preise · Mobil | 68 → 90 | 5.18 → 2.94 s | 0.0052 → 0.0067 | 737 → 316 KiB |
| / · Desktop | 97 → 100 | 1.07 → 0.72 s | 0.0007 → 0.0010 | 991 → 561 KiB |
| /preise · Desktop | 96 → 100 | 1.09 → 0.69 s | 0.0136 → 0.0035 | 754 → 330 KiB |

Accessibility liegt nachher auf beiden Routen und Geräten bei 100, SEO unverändert bei 100. Best Practices bleibt jeweils bei 77. TBT liegt im Nachher-Median bei 0 ms; es ist eine Labordiagnose und kein Nachweis für INP.

Der Best-Practices-Abzug betrifft das im bestehenden Code auf localhost aktivierte Grok-Vorschauskript und dessen Drittanbieter-Cookie/Browserhinweis. Die bereits vorhandene Host-Regel lädt es auf der Kundendomain nicht. Das wurde für höhere Scores nicht geändert. Ein Wert für die ausgerollte Kundendomain wird daraus nicht abgeleitet.

Ein zusätzlicher Font-Preload wurde vergleichend gemessen, zeigte keinen verlässlichen Vorteil und gehört deshalb nicht zur Auslieferung. Die Rohmessungen der endgültigen Fassung und der Baseline liegen im Nachweisarchiv; messwerte.json enthält die Mediane.

## 4. Einschränkungen und externe Maßnahmen

- Die mobile LCP liegt nachher noch oberhalb des Ziels von 2,5 s. Ein garantierter Lighthouse-100-Viererwert wird nicht behauptet. Weiteres Potenzial liegt im verbleibenden initialen JavaScript und der kritischen CSS-/Font-Kette; dafür wäre ein gesondert gemessener, größerer Eingriff nötig.
- Keine Core-Web-Vitals-Felddaten am 75. Perzentil erhoben. Reales INP und die Besucher-LCP müssen nach einem freigegebenen Release über vorhandene Felddaten/RUM geprüft werden.
- Automatisierte Tests belegen keine vollständige WCAG-2.2-AA-Konformität. Screenreader, echter Browser-Zoom und physische Mobilgeräte wurden nicht geprüft. 320px-Reflow und Tastaturbedienung wurden geprüft.
- Keine gültige Kundenanfrage versandt, kein erfolgreicher Produktionsupload durchgeführt und keine angemeldeten Adminabläufe mit echten Daten getestet. Die Erfolgsmeldungen wurden im Code korrigiert; ihr kompletter serverseitiger Versand-/Uploadpfad wurde nicht Ende-zu-Ende ausgeführt.
- Die Sitemap enthält derzeit 183 statische URLs ohne Duplikate. Neue CMS-Artikel werden nicht automatisch ergänzt. Eine dynamische CMS-Sitemap bleibt eine separate Maßnahme; docs/google-anbindung.md nennt die Einschränkung korrekt.
- Produktivhosting, CDN-/Proxykonfiguration, reale Netzwerk-TTFB und Backendlast wurden nicht verändert. Die Kompressionswirkung wurde am Node-Produktionsadapter geprüft; beim Hosting muss der vorhandene Releaseablauf sie übernehmen.
- Die vorübergehende automatische Ablehnung zusätzlicher Browseraufrufe wegen eines Nutzungslimits wurde nach deiner erneuten Freigabe aufgelöst; die hier ausgewiesenen Abschlussmessungen wurden ausgeführt.

## 5. Build und Übergabe

Der vollständige Quellcode liegt im oben genannten lokalen Branch. Der beigefügte Git-Patch enthält die Änderungen einschließlich neuer Dateien; aenderungen.zip enthält die vollständigen geänderten Dateien mit Repositorypfaden. Es wurde nichts nach GitHub gepusht oder produktiv ausgerollt.

Mit vorhandener Node-/npm-Installation: npm ci --ignore-scripts, npm run typecheck, npm run lint, npm test. Für denselben Node-Build wird wie in der bestehenden CI GITHUB_ACTIONS=true gesetzt und npm run build ausgeführt; starten mit node .output/server/index.mjs. Der zusätzliche Test läuft mit FRONTEND_BASE_URL auf die lokale Produktionsvorschau über npm run test:frontend. Der Build enthält unverändert einen Migrationsschritt: In dieser Prüfung war DATABASE_URL nicht gesetzt, daher wurden externe Migrationen übersprungen. Für eine spätere Veröffentlichung den bestehenden Ablauf in docs/deployment.md verwenden.

### Vollständige Liste der geänderten Dateien

- docs/frontend-audit-2026-09-06.md
- docs/google-anbindung.md
- package.json
- scripts/frontend-ssr.test.mjs
- scripts/grok-pwa-plugin.test.mjs
- scripts/grok-pwa-shared.mjs
- server/cache-policy.test.ts
- server/cache-policy.ts
- server/middleware/grok-pwa.ts
- server/middleware/security-headers.ts
- src/components/booking-photo-upload.tsx
- src/components/configurator.tsx
- src/components/consent-banner.tsx
- src/components/lazy-configurator.tsx
- src/components/media.tsx
- src/components/photo-inquiry.tsx
- src/components/public-form-feedback.tsx
- src/components/site-chrome.tsx
- src/components/submission-result.tsx
- src/components/whatsapp-float.tsx
- src/components/workshop-map.tsx
- src/lib/auth/use-current-user.ts
- src/lib/ops.ts
- src/lib/public-form-validation.test.ts
- src/lib/public-form-validation.ts
- src/lib/seo.ts
- src/routeTree.gen.ts
- src/routes/abholservice.index.tsx
- src/routes/b2b.tsx
- src/routes/index.tsx
- src/routes/leistungen.$slug.index.tsx
- src/routes/leistungen.$slug.tsx
- src/styles.css
- vite.config.ts
