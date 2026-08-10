# IONOS-VPS für White Gloss

## Verifizierter Produktionsstand

Am 10. August 2026 wurden Cloud Panel und Server geprüft:

- VPS `VPS 6-8-240` mit Ubuntu 24.04, 6 vCore, 8 GB RAM und
  240 GB NVMe SSD,
- Node.js 22.23.2 als Produktionslaufzeit,
- Caddy auf Port 80/443 mit gültigem TLS für `white-gloss.de`,
- `white-gloss.service` als aktiver, gehärteter systemd-Dienst,
- Anwendung ausschließlich auf `127.0.0.1:3000`,
- UFW mit ausschließlich 22, 80 und 443 als eingehenden Freigaben,
- atomare Releases unter `/srv/white-gloss-releases/<commit-sha>`,
- aktiver Symlink `/srv/white-gloss-current`,
- Produktionsvariablen in `/etc/white-gloss/environment` mit Modus `0600`
  und Eigentümer `root:root`.

Der Tarif ist für die bestehende TanStack-Start-/Nitro-Anwendung geeignet.
Eine Vertragsänderung, ein neuer Reverse Proxy oder eine DNS-Umschaltung sind
nicht erforderlich.

## Sicherheitsmodell der Automation

Der bereits vorhandene manuelle Benutzer `deploy` bleibt Laufzeitbenutzer des
Node-Dienstes. Sein SSH-Schlüssel wird nicht in GitHub gespeichert, weil dieser
Benutzer für manuelle Administration vollständiges `sudo` besitzt.

GitHub Actions verwendet stattdessen den separaten Benutzer
`white-gloss-ci` und einen ausschließlich dafür erzeugten ED25519-Schlüssel:

- kein Login als `root`,
- keine Mitgliedschaft in `sudo` oder einer Laufzeitgruppe,
- SSH-Key mit der Option `restrict`,
- Uploads nur nach `/home/white-gloss-ci/incoming`,
- genau zwei erlaubte privilegierte Operationen über
  `/usr/local/sbin/white-gloss-deploy`: `activate` und `rollback`.

Der root-eigene Helfer ist im Repository unter
`scripts/deploy-ionos-release.sh` versioniert. Vor jedem Deployment vergleicht
GitHub seine SHA-256-Prüfsumme mit der installierten Serverversion. Eine Änderung
am privilegierten Helfer kann deshalb nicht automatisch wirksam werden.

Der Helfer akzeptiert ausschließlich 40-stellige Git-Commit-IDs und den exakt
dazugehörigen Uploadpfad. Er prüft Eigentümer und Inhalt des Archivs, verwirft
Pfade außerhalb von `.output`, lehnt symbolische Links ab, legt root-eigene
Releases an, schaltet den Symlink atomar um und startet nur
`white-gloss.service` neu. Ein lokaler Healthcheck muss innerhalb von
30 Sekunden erfolgreich sein; andernfalls wird sofort auf den vorherigen
Release-Stand zurückgeschaltet.

## Einmalige Servervorbereitung

Die folgenden Schritte wurden am 10. August 2026 ausgeführt und anschließend
gegen den weiterhin aktiven Produktionsdienst geprüft:

1. Systembenutzer und Uploadverzeichnis anlegen:

   ```sh
   useradd --create-home --shell /bin/bash white-gloss-ci
   install -d -o white-gloss-ci -g white-gloss-ci -m 700 \
     /home/white-gloss-ci/.ssh
   install -d -o white-gloss-ci -g white-gloss-ci -m 700 \
     /home/white-gloss-ci/incoming
   ```

2. Den CI-Public-Key mit `restrict` in
   `/home/white-gloss-ci/.ssh/authorized_keys` hinterlegen.
3. Den geprüften Helfer root-eigen und unveränderbar für den CI-Benutzer nach
   `/usr/local/sbin/white-gloss-deploy` installieren.
4. In `/etc/sudoers.d/white-gloss-ci` ausschließlich die beiden Helferaufrufe
   erlauben und die Datei mit `visudo -cf` prüfen.
5. Login, Upload, Ablehnung ungültiger Argumente und den lokalen Healthcheck
   testen, bevor GitHub das erste Release aktivieren darf.

Caddy, Firewall, systemd-Dienst und Produktionsvariablen werden dabei nicht
verändert.

Der installierte CI-Schlüssel hat den Fingerprint
`SHA256:iE4j5JHCiZWshvkuOwDjkYvOegshxIc6luJB0e9JYEg`. Der manuelle
`deploy`-Schlüssel ist davon getrennt. Die Prüfungen bestätigten außerdem:

- `white-gloss-ci` besitzt ausschließlich seine eigene Primärgruppe,
- direkter `systemctl`- und Root-Shell-Zugriff werden abgewiesen,
- `/etc/white-gloss/environment` ist für den CI-Benutzer nicht lesbar,
- ein ungültiger Release-Identifier wird vor jeder Änderung abgewiesen,
- SFTP-Upload und SHA-256-Abgleich funktionieren,
- `white-gloss.service` und der aktive Release-Symlink blieben während der
  Vorbereitung unverändert.

## GitHub-Konfiguration

Das Environment `production` enthält ausschließlich diese Deployment-Secrets:

- `IONOS_SSH_HOST`
- `IONOS_SSH_USER` (`white-gloss-ci`)
- `IONOS_SSH_PRIVATE_KEY`
- `IONOS_SSH_KNOWN_HOSTS`
- optional `IONOS_SSH_PORT` (Standard: `22`)

Der Workflow bleibt ohne die Repository-Variable
`IONOS_DEPLOY_ENABLED=true` deaktiviert. Die Variable wird erst gesetzt, wenn
Servervorbereitung, Prüfsummenabgleich und End-to-End-Test erfolgreich waren.

Produktionsgeheimnisse von Supabase, Resend und weiteren Diensten verbleiben
ausschließlich in `/etc/white-gloss/environment`; sie werden weder in GitHub
noch in Release-Archive kopiert.

## Automatischer Ablauf

1. `CI` prüft einen Push nach `main` vollständig.
2. Der Deployment-Workflow akzeptiert nur einen erfolgreichen `push`-Lauf aus
   diesem Repository und verwirft überholte `main`-Revisionen.
3. GitHub baut exakt den geprüften Commit erneut mit Node.js 24.
4. Nur `.output` wird gepackt, übertragen und per SHA-256 verifiziert.
5. Der root-eigene Helfer aktiviert das Release atomar und führt den lokalen
   Healthcheck aus.
6. Anschließend prüft der vollständige Produktions-Smoke-Test
   `https://white-gloss.de`.
7. Bei einem fehlgeschlagenen Live-Test wird der vorherige Commit reaktiviert
   und erneut geprüft.
8. Zum Schluss muss der aktive Server-Symlink exakt auf den geprüften Commit
   zeigen.
