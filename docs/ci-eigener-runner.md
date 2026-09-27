# Eigener CI-Runner (Hostinger-VPS)

## Warum

Seit dem 24.09.2026 starten die GitHub-Runner keine Jobs mehr: `verify` und `schema` enden nach einer Sekunde, ohne dass ein Schritt läuft. Damit laufen weder CI noch der IONOS-Deploy. Ein eigener Runner auf einem separaten VPS kann die CI-Prüfungen ausführen. Der Produktions-Deploy und die Serverinspektion bleiben auf frischen GitHub-Runnern; die Ursache der dortigen Startblockade muss weiterhin behoben werden.

**Vorher prüfen:** Das Repository ist öffentlich. Für öffentliche Repositories sind die GitHub-Runner kostenlos. Wenn sie trotzdem nicht starten, ist meist das Konto gesperrt (z. B. offene Zahlung). Unter GitHub → Settings → Billing and plans nachsehen. Eine Kontosperre kann auch eigene Runner betreffen. Dann hilft nur, die Sperre aufzuheben.

## Sicherheit

- **Separater Server.** Der Runner führt Code aus Branches aus. Er gehört nicht auf den IONOS-Produktionsserver; das Skript bricht dort ab (`/etc/white-gloss` vorhanden).
- **Keine Fork-PRs.** Die Workflows schicken Pull Requests aus Forks immer zu den GitHub-Runnern, nie auf den eigenen. Auf dem eigenen Runner läuft nur Code aus Branches dieses Repositorys, also von Personen mit Schreibrecht.
- **Zusätzlich** unter Settings → Actions → General → „Approval for running fork pull request workflows“ die Einstellung „Require approval for all external contributors“ wählen.
- Der Benutzer `gh-runner` hat kein `sudo`. Er ist in der Gruppe `docker` (für den PostgreSQL-Testcontainer). Das entspricht auf diesem Server root-Rechten; deshalb gehört auf den VPS nichts anderes.
- **Keine Produktionsschlüssel auf dem CI-Runner.** `deploy-ionos.yml` verwendet `CI_RUNS_ON` ausdrücklich nicht. Inspektion und Deployment laufen auf jeweils frischen GitHub-Runnern. Ein gemeinsamer dauerhafter Runner würde den in `~/.ssh` gespeicherten Produktionsschlüssel nachfolgenden Branch-Tests zugänglich machen. Auch getrennte Labels auf derselben Maschine wären keine Isolation. Siehe [GitHub: sichere Verwendung von Actions](https://docs.github.com/en/actions/reference/security/secure-use).

## Einrichtung

1. **VPS bestellen:** Bei Hostinger einen KVM-VPS mit **Ubuntu 24.04** wählen. Empfohlen sind 2 vCPU und 8 GB RAM (z. B. KVM 2). Mit 4 GB läuft es auch, der Build dauert aber länger.
2. **Token holen:** GitHub → Repository → Settings → Actions → Runners → „New self-hosted runner“ → Linux. Aus der Zeile `./config.sh --url … --token XXXX` nur den Wert nach `--token` kopieren (eine Stunde gültig).
3. **Skript ausführen:** Per SSH als root auf dem VPS anmelden (Zugang im Hostinger-Panel) und ausführen:
   ```bash
   curl -fsSLO https://raw.githubusercontent.com/White-Gloss/glanz-buchung-meister/main/scripts/setup-ci-runner.sh
   RUNNER_TOKEN=XXXX bash setup-ci-runner.sh
   ```
   Das Skript installiert Docker, den PostgreSQL-Client und Google Chrome (für Lighthouse). Es legt den Benutzer `gh-runner` an, lädt den offiziellen Runner, prüft dessen Prüfsumme und startet ihn als Systemdienst.
4. **Umschalten:** GitHub → Settings → Secrets and variables → Actions → Reiter „Variables“ → „New repository variable“:
   - Name: `CI_RUNS_ON`
   - Wert: `["self-hosted","white-gloss-ci"]`
5. **Prüfen:** Unter Settings → Actions → Runners steht der Runner als „Idle“. Danach unter Actions den Lauf „CI“ eines offenen PRs neu starten.

## Zurück zu den GitHub-Runnern

Die Variable `CI_RUNS_ON` löschen. Ohne sie laufen alle Workflows wie bisher auf `ubuntu-latest`.

## Wartung

- Der Runner aktualisiert sich selbst.
- Systemupdates: `apt-get update && apt-get upgrade` auf dem VPS, wie bei jedem Server.
- Speicher: Docker-Abbilder gelegentlich mit `docker system prune -af` aufräumen.
- Runner entfernen: in GitHub unter Runners löschen, auf dem VPS `cd /opt/actions-runner && ./svc.sh stop && ./svc.sh uninstall`.
