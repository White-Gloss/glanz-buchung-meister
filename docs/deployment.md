# Deployment auf IONOS – technische Vorgaben

Die Website wird auf `white-gloss.de` betrieben und soll vollständig zu IONOS umziehen. Dieses Projekt ist **keine rein statische Website**, sondern eine Node-/SSR-Anwendung (TanStack Start + Nitro). Deshalb wird die endgültige Deployment-Methode erst festgelegt, wenn der konkrete IONOS-Tarif und dessen Node-/Server-Funktionen bestätigt sind.

Die hier dokumentierten technischen Anforderungen gelten unabhängig davon, ob IONOS später eine native Git-Anbindung, einen VPS/Cloud-Server oder eine andere Node-fähige Laufzeit bereitstellt.

## Deployment-Vertrag

| Was                         | Wert                            |
| --------------------------- | ------------------------------- |
| Produktionsbranch           | `main`                          |
| Referenz-Node-Version in CI | `24`                            |
| Installationsbefehl         | `npm ci`                        |
| Build-Befehl                | `npm run build`                 |
| Build-Ausgabe               | `.output/`                      |
| Server-Einstieg             | `.output/server/index.mjs`      |
| Startbefehl                 | `node .output/server/index.mjs` |
| Hauptdomain                 | `https://white-gloss.de`        |

`vite.config.ts` baut im Produktionsmodus mit Nitro als `node-server`. Eine Hosting-Variante, die nur statische HTML-/JS-Dateien ausliefert, reicht daher für die vollständige Anwendung nicht aus.

## Mindestanforderungen an den IONOS-Tarif

Der endgültige Tarif muss für die bestehende Architektur mindestens Folgendes ermöglichen:

- einen dauerhaft laufenden Node-Prozess oder eine gleichwertige Node-Server-Laufzeit,
- geschützte serverseitige Umgebungsvariablen,
- `npm ci` und `npm run build` während des Deployments,
- Neustart bzw. Rollout des Node-Prozesses nach erfolgreichem Build,
- HTTPS für `white-gloss.de`,
- reproduzierbares Rollback auf einen vorherigen Git-Stand.

Der aktive IONOS-Tarif wurde am 10. August 2026 als Ubuntu-24.04-VPS mit
Root-/SSH-Zugang bestätigt. Er ist für die Node-/SSR-Anwendung geeignet; das
Deployment erfolgt deshalb über GitHub Actions, den separaten Benutzer
`white-gloss-ci` und einen root-eigenen, streng validierenden
Aktivierungshelfer. Der bereits laufende Caddy-/systemd-Aufbau und die
Servervorbereitung stehen in
[`docs/ionos-vps-bootstrap.md`](ionos-vps-bootstrap.md).

## Zielablauf eines Deployments

1. Änderung über Pull Request prüfen.
2. CI muss erfolgreich sein (`npm audit`, ESLint, Quality-Skripte, Produktions-Build).
3. Änderung nach `main` mergen.
4. IONOS übernimmt genau diesen `main`-Stand.
5. Auf dem Zielsystem laufen `npm ci` und `npm run build`.
6. Erst nach erfolgreichem Build wird der neue Node-Stand aktiviert.
7. Direkt danach läuft `npm run smoke:production` gegen die Live-Domain.
8. Bei fehlgeschlagenem Build oder Smoke-Test bleibt bzw. wird der letzte funktionierende Stand wieder aktiv.

Damit ist das gewünschte Ziel klar: **Merge nach `main` → automatisch zu IONOS → Build → Neustart → Smoke-Test**.

## Umgebungsvariablen

Variablen mit `VITE_`-Präfix werden beim Build in Browser-Dateien eingebettet. Sie müssen deshalb bereits vorhanden sein, wenn `npm run build` läuft. Geheimnisse dürfen niemals ein `VITE_`-Präfix erhalten.

### Öffentliche Werte im Repository

Die eingecheckte `.env` enthält nur Werte, die im Browser ohnehin öffentlich sind:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_META_PIXEL_ID` (derzeit leer)
- `VITE_GOOGLE_SITE_VERIFICATION` (derzeit leer)
- `VITE_GOOGLE_ADS_CONVERSION_ID` (derzeit leer)
- `VITE_GOOGLE_ADS_CONVERSION_LABEL` (derzeit leer)
- `VITE_GA4_MEASUREMENT_ID` (derzeit leer)

### Geheimnisse nur im Produktionshosting

Folgende Werte gehören ausschließlich in die root-eigene Datei
`/etc/white-gloss/environment` auf dem IONOS-VPS und **niemals** ins Repository:

| Variable                                            | Zweck                                   |
| --------------------------------------------------- | --------------------------------------- |
| `META_PIXEL_ID`                                     | serverseitige Meta-Conversions          |
| `META_CAPI_ACCESS_TOKEN`                            | Zugriffstoken der Meta Conversions API  |
| `RESEND_API_KEY`                                    | E-Mail-Versand                          |
| `MAIL_FROM`                                         | Absender der Kundenmails                |
| `MAIL_TO_OWNER`                                     | Zieladresse interner Benachrichtigungen |
| `SUPABASE_SERVICE_ROLE_KEY`                         | optionale serverseitige Vollzugriffe    |
| `DATABASE_URL` / `POSTGRES_URL` / `SUPABASE_DB_URL` | direkte Datenbankverbindung             |

## E-Mail-Versand mit Resend

Ohne `RESEND_API_KEY` und `MAIL_FROM` wird keine Kundenmail versendet. Buchungen können trotzdem gespeichert werden; der Mailversand meldet dann die fehlende Konfiguration. Die Variablennamen sind auf dem VPS vorhanden; ihre geheimen Werte werden beim Deployment weder gelesen noch übertragen.

Im geprüften Resend-Konto ist `white-gloss.de` in der Region `eu-west-1`
vollständig verifiziert. DKIM, SPF-MX und SPF-TXT wurden am 10. August 2026
über die IONOS-DNS-Verwaltung bestätigt; eine reale Produktionstestmail von
`buchung@white-gloss.de` wurde anschließend erfolgreich zugestellt. Die
Deployment-Automation überträgt weiterhin weder Resend-Schlüssel noch andere
Produktionsgeheimnisse.

Empfohlene Produktionswerte:

| Variable        | Beispiel                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| `MAIL_FROM`     | `White Gloss Detailing <info@white-gloss.de>` oder eine andere tatsächlich genutzte Adresse der verifizierten Domain |
| `MAIL_TO_OWNER` | `info@white-gloss.de`                                                                                                |

Der eigentliche API-Key bleibt geheim.

## Quality Gates nach dem Deployment

Die technischen Prüfungen sind in `docs/quality-gates.md` dokumentiert. Wichtig sind insbesondere:

```bash
npm run smoke:production
npm run audit:domain-migration
npm run lighthouse:mobile
npm run lighthouse:desktop
```

Der Produktions-Smoke-Test prüft unter anderem Startseite, Preise, Leistungen, Admin-Erreichbarkeit, Sitemap, robots.txt und Canonicals. Zusätzlich existiert ein regelmäßiger read-only Smoke-Workflow in GitHub Actions.

## CI

GitHub Actions ist aktiv. Der Workflow `.github/workflows/ci.yml` prüft Pull Requests und `main` mit:

1. `npm ci --ignore-scripts`
2. `npm audit --omit=dev --audit-level=moderate`
3. `npm run lint`
4. Syntaxprüfung der Quality-Skripte
5. `npm run build`

Der Workflow `.github/workflows/deploy-ionos.yml` reagiert ausschließlich auf
einen erfolgreichen `push`-Lauf von `CI` für den aktuellen `main`-Commit,
reproduziert den Build, verifiziert Archiv und Server-Helfer per SHA-256 und
prüft zusätzlich die versionierte systemd-Unit auf Konfigurationsdrift. Untätige
PostgreSQL-Verbindungen halten den Prozess nach dem Schließen des HTTP-Servers
nicht mehr offen; zusätzlich bleibt der Produktionsneustart auf 15 Sekunden
begrenzt. Danach führt der Workflow den Produktions-Smoke-Test aus. Ohne die
explizite Repository-Variable `IONOS_DEPLOY_ENABLED=true` wird der
Deployment-Job vollständig übersprungen.

## Rollback-Grundsatz

Ein Rollback muss immer auf einen bekannten Git-Stand erfolgen. Keine Produktionsdateien werden manuell „repariert“, ohne dass dieselbe Änderung auch im Repository existiert. So bleiben GitHub, IONOS und die tatsächlich laufende Version nachvollziehbar synchron.
