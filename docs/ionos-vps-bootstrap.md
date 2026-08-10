# IONOS-VPS für White Gloss vorbereiten

## Verifizierter Tarifstand

Am 10. August 2026 wurde im IONOS Cloud Panel der aktive Server geprüft:

- virtuelle Maschine `VPS 6-8-240`,
- Ubuntu 24.04,
- 6 vCore,
- 8 GB RAM,
- 240 GB NVMe SSD,
- Root-/SSH-Zugang.

Der Tarif ist damit für die bestehende TanStack-Start-/Nitro-Anwendung geeignet.
Er stellt einen dauerhaft laufenden Node-Prozess, SSH-Deployments, systemd und
atomare Releases bereit. Eine Vertragsänderung ist nicht erforderlich.

## Sicherheitsmodell

GitHub Actions meldet sich nicht als `root`, sondern als eigener Benutzer
`white-gloss` per SSH-Schlüssel an. Der Benutzer darf ausschließlich den
Dienst `white-gloss.service` ohne Passwort neu starten. Der bekannte
SSH-Hostschlüssel wird fest in GitHub hinterlegt; `ssh-keyscan` läuft nicht bei
jedem Deployment erneut.

Produktionsgeheimnisse liegen in
`/etc/white-gloss/white-gloss.env` auf dem VPS. Sie werden weder in GitHub noch
in Release-Archive kopiert. Der systemd-Dienst bindet die Anwendung nur an
`127.0.0.1:3000`; HTTPS und der öffentliche Zugriff erfolgen später über den
Reverse Proxy.

## Einmalige Vorbereitung – noch nicht ausgeführt

Die folgenden Änderungen benötigen eine ausdrückliche Produktionsfreigabe und
werden deshalb nicht automatisch ausgeführt:

1. Node.js 24 auf dem VPS installieren und mit `node --version` prüfen.
2. Systembenutzer und Verzeichnisse anlegen:

   ```sh
   useradd --create-home --shell /bin/bash white-gloss
   install -d -o white-gloss -g white-gloss -m 750 /opt/white-gloss/releases
   install -d -o root -g white-gloss -m 750 /etc/white-gloss
   install -o root -g white-gloss -m 640 /dev/null /etc/white-gloss/white-gloss.env
   ```

3. Einen ausschließlich für GitHub Actions erzeugten öffentlichen SSH-Schlüssel
   in `/home/white-gloss/.ssh/authorized_keys` hinterlegen.
4. `/etc/systemd/system/white-gloss.service` anlegen:

   ```ini
   [Unit]
   Description=White Gloss Node SSR
   After=network-online.target
   Wants=network-online.target

   [Service]
   Type=simple
   User=white-gloss
   Group=white-gloss
   WorkingDirectory=/opt/white-gloss/current
   Environment=NODE_ENV=production
   Environment=HOST=127.0.0.1
   Environment=PORT=3000
   EnvironmentFile=/etc/white-gloss/white-gloss.env
   ExecStart=/usr/bin/node /opt/white-gloss/current/server/index.mjs
   Restart=on-failure
   RestartSec=5
   NoNewPrivileges=true
   PrivateTmp=true
   ProtectSystem=strict
   ProtectHome=true
   ReadWritePaths=/opt/white-gloss

   [Install]
   WantedBy=multi-user.target
   ```

5. In `/etc/sudoers.d/white-gloss-deploy` ausschließlich diesen Neustart
   erlauben und die Datei mit `visudo -cf` prüfen:

   ```text
   white-gloss ALL=(root) NOPASSWD: /usr/bin/systemctl restart white-gloss.service
   ```

6. Reverse Proxy, TLS und Firewall prüfen. DNS wird erst nach separater
   Bestätigung umgeschaltet.

## Noch nicht gesetzte GitHub-Konfiguration

Der Workflow bleibt standardmäßig deaktiviert. Erst nach der Servervorbereitung
werden im GitHub-Environment `production` diese Secrets hinterlegt:

- `IONOS_SSH_HOST`
- `IONOS_SSH_USER` (`white-gloss`)
- `IONOS_SSH_PRIVATE_KEY`
- `IONOS_SSH_KNOWN_HOSTS`
- optional `IONOS_SSH_PORT` (Standard: `22`)

Anschließend wird die Repository-Variable `IONOS_DEPLOY_ENABLED=true` gesetzt.
Bis dahin überspringt GitHub das Deployment vollständig.

## Automatischer Ablauf nach Freigabe

1. Der normale Workflow `CI` prüft den neuen `main`-Commit.
2. Nur bei erfolgreicher CI und aktiviertem Deployment startet der IONOS-Job.
3. Der Job reproduziert den Build für exakt den geprüften Commit.
4. `.output/` wird als unveränderliches Release auf den VPS übertragen.
5. Ein Symlink aktiviert das Release atomar; systemd startet den Dienst neu.
6. Zuerst läuft ein lokaler Healthcheck auf dem VPS, danach der bestehende
   Produktions-Smoke-Test gegen `https://white-gloss.de`.
7. Schlägt einer der Tests fehl, wird – sofern vorhanden – das vorherige Release
   wieder aktiviert.
