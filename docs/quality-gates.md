# White Gloss – technische Quality Gates

Diese Datei dokumentiert die reproduzierbaren Prüfungen für die Roadmap zum Agenturstandard. Die Checks sind bewusst lesend, reversibel und ohne geheime Zugangsdaten aufgebaut.

## 1. Produktions-Smoke-Test

```bash
npm run smoke:production
```

Standardziel: `https://white-gloss.de`

Optional anderes Ziel:

```bash
SMOKE_BASE_URL=https://staging.example.de npm run smoke:production
```

Geprüft werden:

- `/`
- `/preise`
- `/leistungen`
- `/admin`
- `/sitemap.xml`
- `/robots.txt`
- HTTP-Erreichbarkeit
- zentrale sichtbare Inhalte
- Canonicals auf den öffentlichen Kernseiten
- XML-Sitemap, Mindestanzahl an URLs und ausschließlich neue Domain
- robots.txt mit korrektem Sitemap-Verweis

Die GitHub Action `.github/workflows/production-smoke.yml` führt diesen Test auf `main`, zusätzlich alle sechs Stunden und manuell aus. Sie verändert keine Produktionsdaten.

## 2. Audit der Domainmigration

```bash
npm run audit:domain-migration
```

Standardprüfung:

```text
https://whitegloss.de  ->  https://white-gloss.de
```

Der Audit erwartet für wichtige Alt-URLs einen permanenten `301` oder `308` und prüft, dass der Pfad 1:1 auf der neuen Domain erhalten bleibt. Außerdem muss das endgültige Ziel erfolgreich erreichbar sein.

Alternative Ursprünge können über Umgebungsvariablen gesetzt werden:

```bash
MIGRATION_OLD_BASE=https://alt.example.de \
MIGRATION_NEW_BASE=https://neu.example.de \
npm run audit:domain-migration
```

Die GitHub Action `.github/workflows/domain-migration-audit.yml` prüft die
Migration täglich sowie bei Änderungen am Audit selbst. Der Post-Deploy-
Smoke-Test ist im IONOS-Workflow direkt an ein erfolgreiches Deployment
gekoppelt; der separate Zeitplan bleibt als unabhängige Produktionsüberwachung
bestehen.

## 3. Lighthouse-Baseline

Mobile:

```bash
npm run lighthouse:mobile
```

Desktop:

```bash
npm run lighthouse:desktop
```

Die Befehle verwenden eine fest gepinnte Lighthouse-CI-Version und schreiben die Reports lokal nach `.lighthouseci/`; dieser Ordner wird nicht committed.

Aktuell gemessene Kernseiten:

- `/`
- `/preise`
- `/leistungen`
- `/abholservice`

Die Baseline nutzt zunächst bewusst realistische Warnschwellen statt aggressiver Merge-Blocker. Erst nachdem stabile Produktionsmessungen vorliegen, werden die Performance-Schwellen schrittweise verschärft.

Die GitHub Action `.github/workflows/lighthouse-audit.yml` führt die mobile und Desktop-Prüfung wöchentlich sowie nach Änderungen an der Audit-Konfiguration aus.

## 4. CI-Schutz

Der normale CI-Workflow prüft bei Pull Requests und auf `main`:

1. `npm ci --ignore-scripts`
2. Produktionsabhängigkeiten per `npm audit`
3. ESLint
4. Syntax der Quality-Skripte und Lighthouse-Konfigurationen
5. Produktions-Build

Dadurch können fehlerhafte Quality-Gates nicht unbemerkt in `main` gelangen.

## Noch offen

Folgende Quality-Gates werden ergänzt, sobald die jeweils nötige Grundlage vorhanden ist:

- Playwright-E2E-Tests für den kompletten Buchungsflow
- echtes Fehler-/Exception-Monitoring für Client und Server
- Staging-/Preview-Umgebung
- automatische Auswertung historischer Lighthouse-Messwerte
