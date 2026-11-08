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

- [ ] CMS-Verwaltung bei deaktiviertem Studio wieder verfügbar machen; UI und Serverpfade samt Regressionen prüfen.
- [ ] Unabhängige Studio-Sicherheits-, UI-/SEO- und Produktionsprüfung abschließen.
- [ ] Vollständige CI am neuen Integrationsstand ausführen; bisherige Ergebnisse nicht auf diesen Stand übertragen.
- [ ] Browserartefakte sowie tatsächliche Lighthouse-Messwerte dieses Stands auswerten.

## Grenzen

Kein lokaler Website-Server. Lokaler Git-Abruf ist durch fehlende DNS-Auflösung für github.com blockiert; deshalb erfolgt die Integration mit dem verbundenen GitHub-Zugang auf festgehaltenen Blob-/Commit-IDs. Lokale Textkopien dienen ausschließlich serverlosen gezielten Tests. Vollständige Build-, Browser- und Datenbankprüfungen bleiben im vorhandenen Linux-CI.

Der Hostinger-Workflow kann nach erfolgreicher main-Push-CI bei HOSTINGER_DEPLOY_ENABLED=true ausliefern. Dieser Branch und sein Draft-PR sind kein main-Push. Kein Merge, Deployment, produktive Migration, Aktivierung, Preisregeländerung, Upload, Testbuchung oder Kundenkontakt ist freigegeben.

## Nächster konkreter Schritt

CMS-Fallback samt Flag-off-Regressionsprüfung integrieren und die vollständige CI am endgültigen Commit abwarten. Anschließend diese Datei um genaue Prüfbelege, offene Grenzen und erforderliche Produktionsfreigaben ergänzen.
