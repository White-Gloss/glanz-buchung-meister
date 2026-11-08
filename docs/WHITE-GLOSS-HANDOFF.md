# White-Gloss Website – Recovery-Handoff

Stand: 8. November 2026. Entwicklung, keine Produktionsfreigabe.

## Feste Ausgangspunkte

- main: `d20a8e1b7e868add1e99fc6279227d085d3f8c03`
- PR #318: `b30f7234b3035278d2c52f9ce36daf4316ada1e9`, weiter offen als Draft.
- Arbeitsbranch: `codex/website-recovery-20261108`
- PR #317 bleibt offen; sein Anzeigefix ist bereits in #318 enthalten.
- PR #319 bis #322 erneut geprüft: gemergt.
- Repository-Berechtigungen am 8.11.2026: pull/push/admin bestätigt.

## Recovery und Integration

AGENTS.md, vollständiger Audit White-Gloss-Website-Audit-2026-11-07.md und WEBSITE-STUDIO-RELEASE.md gelesen.
Der Vergleich von PR #318 und main umfasst nur eine beidseitig geänderte Datei: package.json.
Der neue Integrationsstand basiert auf main und übernimmt die 111 PR-Dateien; der Testbefehl behält zusätzlich die OpenAI-Regressionen.
Alle zwölf übrigen Dateien aus den neueren main-Änderungen werden unverändert erhalten. Der Integrationscommit nennt beide Ausgangscommits als Eltern; die bisherigen PRs werden weder umgeschrieben noch geschlossen.

## Abgeschlossene Arbeitspakete

- [x] Repository-Berechtigungen und PR #317–#322 live geprüft.
- [x] Anweisungen und vollständigen Audit gelesen.
- [x] Die gemeinsame Testliste vereinigt, Studio-Abhängigkeiten und Lockfile erhalten.
- [x] 30 Google-/OpenAI-Tests serverlos ausgeführt: 30 bestanden, kein Fehler.
- [x] Vorhandene CI 42329997110 erneut gelesen: verify, schema, cross-browser, studio erfolgreich für den alten Studio-Stand.

## Laufende Arbeit

- [x] CMS-Fallback, private Altentwurfs-Baseline, Blog-Kurztexte und Medien-Navigationsschutz implementiert. Vollständige Datenbank-/UI-Prüfung dieses Korrekturpakets folgt in CI.
- [x] Unabhängige Studio-Sicherheits- und UI-/SEO-Quelltextprüfung abgeschlossen; drei konkrete zusätzliche Fehler im Korrekturpaket behoben. Produktions-/Infrastrukturprüfung separat.
- [ ] Vollständige CI am neuen Integrationsstand ausführen; bisherige Ergebnisse nicht auf diesen Stand übertragen.
- [ ] Browserartefakte sowie tatsächliche Lighthouse-Messwerte dieses Stands auswerten.

## Grenzen

Kein lokaler Website-Server. Lokaler Git-Abruf ist durch fehlende DNS-Auflösung für github.com blockiert; deshalb erfolgt die Integration mit dem verbundenen GitHub-Zugang auf festgehaltenen Blob-/Commit-IDs. Lokale Textkopien dienen ausschließlich serverlosen gezielten Tests. Vollständige Build-, Browser- und Datenbankprüfungen bleiben im vorhandenen Linux-CI.

Der Hostinger-Workflow kann nach erfolgreicher main-Push-CI bei HOSTINGER_DEPLOY_ENABLED=true ausliefern. Dieser Branch und sein Draft-PR sind kein main-Push. Kein Merge, Deployment, produktive Migration, Aktivierung, Preisregeländerung, Upload, Testbuchung oder Kundenkontakt ist freigegeben.

## Nächster konkreter Schritt

CMS-Fallback samt Flag-off-Regressionsprüfung integrieren und die vollständige CI am endgültigen Commit abwarten. Anschließend diese Datei um genaue Prüfbelege, offene Grenzen und erforderliche Produktionsfreigaben ergänzen.

## Korrekturpaket nach Integration

Geänderte/zusätzliche Dateien:

- `src/components/cms-editor.tsx`
- `src/components/cms-legacy-editor.tsx`
- `src/lib/cms.functions.ts`
- `src/lib/cms.availability.ts`
- `src/lib/cms.availability.test.ts`
- `src/lib/cms-legacy.store.ts`
- `src/lib/cms-legacy.store.test.ts`
- `src/lib/cms.store.ts`
- `src/lib/cms.store.test.ts`
- `src/lib/cms.model.ts`
- `src/lib/cms.model.test.ts`
- `scripts/qa/isolated-server.mjs`
- `scripts/qa/check-website-studio.mjs`
- `src/components/website-studio.tsx`
- `src/components/website-studio-media.tsx`
- `src/components/website-studio-fields.tsx`
- `src/components/website-studio-activity.ts`
- `src/components/website-studio-activity.test.ts`
- `src/components/website-studio-render.test.mjs`
- `package.json`: Legacy-Store- und Medienzustandstests in bestehende Hauptsuite aufgenommen.
- `WEBSITE-STUDIO-RELEASE.md`: Fallback, Altentwürfe, Blog-Kurztexte und Medienprüfung dokumentiert.

Serverlose Nachweise: 30 Tracking-/Consent-Tests, 11 Model-/Availability-Tests und 3 Medienzustandstests erfolgreich. Browser-Skripte syntaktisch geprüft. Zwei Model-/Flag-Regressionen und der Medien-Navigationsfehler vor Korrektur reproduziert. Neue PGlite-/React-/Browserfälle lokal nicht ausgeführt, da die Projektabhängigkeiten dort nicht verfügbar sind; keine lokalen Website-Server gestartet.

Der erste Integrationslauf [42441978157](https://github.com/White-Gloss/glanz-buchung-meister/actions/runs/42441978157) hat schema, studio und cross-browser bereits bestanden; verify war bei Erstellung dieses Checkpoints noch im Browserlauf. Diese Ergebnisse gelten für `d340d89ad1be61068fe9a382798db3592a0ebf8e`, nicht automatisch für das Korrekturpaket.

Die aktuellen vollständigen Prüfläufe und deren genaue Head-Zuordnung sind im [Draft-PR #323](https://github.com/White-Gloss/glanz-buchung-meister/pull/323/checks) verknüpft. Vor Abnahme deren endgültiges Ergebnis prüfen. Nächster Schritt: neue vollständige CI auswerten, Fehler beheben, Screenshots und Labormessungen prüfen und abschließende Nachweise ergänzen.

## Prüfkorrekturen nach dem Korrekturpaket

- Lauf 42442534022: neue Legacy-Browserprüfung scheiterte an einem mehrdeutigen Label; Hauptprüfung meldete drei fehlende JS-Testtypen und eine alte Erwartung, die eine ausdrückliche Studio-Abschaltung im isolierten CI ignorierte. Alle Ursachen korrigiert, keine Tests entfernt.
- Commit `1d418d7e3da20be71e53c0044431014feb0dbce5`: Studio-Browserprüfung und Schema in Lauf 42442757728 erfolgreich.
- Commit `dafd325bd189c6a07c189eff05e60a4eb38dfb2e`: Studio und Schema erneut erfolgreich. Cross-browser scheiterte ausschließlich am durch den Test selbst abgebrochenen Vollbild customer-16 in Firefox. Der Dialog wurde unmittelbar nach Sichtbarkeit weitergeschaltet und geschlossen; ein dekodiertes Bild war bisher nicht abgewartet.
- Galerieprüfung wartet jetzt vor Weiterblättern und Schließen auf genau das angeforderte, erfolgreich dekodierte Bild. Acht Bildnachweise für beide Engines/Breiten sind obligatorisch; Netzwerkfehler bleiben unverändert Fehler. Vier neue und acht bestehende serverlose Diagnostiktests bestanden.
- Der vorhandene mobile Legacy-Screenshot wird zusätzlich zur visuellen Prüfung im CI-Log exportiert. Vollständiger Browsernachweis der neuen Wartelogik steht vor dem abschließenden CI noch aus.
