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
am privilegierten Helfer kann deshalb nicht automatisch wirksam werden. Dasselbe
gilt für die unter `ops/white-gloss.service` versionierte systemd-Unit.

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

Ein isolierter Neustarttest zeigte, dass Nitro den HTTP-Server nach `SIGTERM`
erfolgreich schließt, der Node-Prozess zuvor aber noch bis zum Idle-Timeout des
PostgreSQL-Pools auf eine ungenutzte Verbindung wartete. Der Pool verwendet
deshalb `allowExitOnIdle`: Aktive Abfragen werden weiterhin abgeschlossen,
untätige Datenbank-Sockets halten den bereits gestoppten HTTP-Prozess jedoch
nicht mehr künstlich am Leben. `TimeoutStopSec=15` und `SendSIGKILL=yes` bleiben
als begrenztes Sicherheitsnetz für tatsächlich hängende Prozesse bestehen. So
kann ein Deployment nicht bis zum systemd-Standardlimit von 90 Sekunden im
502-Zustand hängen bleiben. Unit und Helfer werden vor jedem Deployment per
SHA-256 auf Konfigurationsdrift geprüft.

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

## Terminerinnerungen: der Zeitgeber

**Prüfen Sie zuerst, ob schon etwas läuft.** Diese Anleitung beschrieb bis
jetzt keinen Zeitplan, und im Repository stand keiner. Ob auf dem Server
einmal von Hand ein Crontab-Eintrag angelegt wurde, lässt sich nur dort
sehen:

```bash
sudo systemctl list-timers --all | grep -i white-gloss
sudo crontab -l; sudo crontab -l -u deploy
sudo ls -la /etc/cron.d /etc/cron.hourly
```

Findet sich nichts, wird der Endpunkt nicht aufgerufen — und dann geht keine
Terminerinnerung hinaus, egal ob `REMINDER_CRON_SECRET` gesetzt ist. Die
Anzeige im Adminbereich sagt nur, dass das Geheimnis hinterlegt ist; ob
jemand den Endpunkt tatsächlich anstößt, kann sie nicht wissen.

### Einrichten

Zwei versionierte Dateien liegen unter `ops/`:

| Datei                          | Aufgabe                       |
| ------------------------------ | ----------------------------- |
| `white-gloss-reminder.service` | ruft den Endpunkt einmal auf  |
| `white-gloss-reminder.timer`   | stößt den Dienst stündlich an |

```bash
sudo install -o root -g root -m 0644 \
  ops/white-gloss-reminder.service ops/white-gloss-reminder.timer \
  /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now white-gloss-reminder.timer
```

Kontrolle:

```bash
systemctl list-timers white-gloss-reminder.timer   # wann als Nächstes?
sudo systemctl start white-gloss-reminder.service  # einmal von Hand
journalctl -u white-gloss-reminder.service -n 20   # was kam zurück?
```

Ein erfolgreicher Lauf antwortet mit `{"ok":true,...}` und den Zählern des
Durchgangs. `401` bedeutet, dass `REMINDER_CRON_SECRET` in
`/etc/white-gloss/environment` nicht zu dem passt, was die Anwendung geladen
hat — nach einer Änderung dieser Datei muss `white-gloss.service` neu
gestartet werden. `503` bedeutet, dass die Variable in der Anwendung ganz
fehlt.

### Warum ein Timer und kein Crontab-Eintrag

Der Zeitplan gehört so zum selben versionierten Betriebsstand wie
`white-gloss.service`, läuft unter demselben Benutzer, liest dieselbe
Umgebungsdatei und schreibt in dasselbe Journal. Ein Crontab-Eintrag wäre
nirgends im Repository sichtbar — genau der Zustand, der dazu geführt hat,
dass sich nicht mehr sagen ließ, ob die Erinnerungen laufen.

### Das Geheimnis steht nicht in der Prozessliste

Der Aufruf reicht die Kopfzeile über `curl --config -` von der
Standardeingabe herein. Stünde der Wert stattdessen als
`-H "Authorization: ..."` im Aufruf, könnte ihn jeder Benutzer des Servers
während des Laufs in der Prozessliste mitlesen. So steht er nur in der
Prozessumgebung — dort, wo der Node-Dienst seine Zugangsdaten ohnehin hält.

### Stündlich genügt

`runDueAppointmentReminders` sucht Termine in den nächsten 25 Stunden und
hält in der Datenbank fest, welche Buchung ihre Erinnerung schon bekommen
hat. Ein Lauf zu viel schadet deshalb nicht, ein verspäteter Lauf holt nach —
die 25 Stunden sind genau dieser Puffer. `Persistent=true` sorgt dafür, dass
ein während eines Neustarts ausgefallener Lauf nachgeholt wird.

Rechnungen entstehen **nicht** in diesem Lauf. Der Endpunkt versendet
ausschließlich Terminerinnerungen; die Endrechnung braucht weiterhin eine
ausdrückliche Freigabe im Adminbereich.

## Automatischer Ablauf

1. `CI` prüft einen Push nach `main` vollständig.
2. Der Deployment-Workflow akzeptiert nur einen erfolgreichen `push`-Lauf aus
   diesem Repository und verwirft überholte `main`-Revisionen.
3. GitHub baut exakt den geprüften Commit erneut mit Node.js 24.
4. Nur `.output` wird gepackt und übertragen; Archiv, privilegierter Helfer und
   systemd-Unit werden per SHA-256 verifiziert.
5. Der root-eigene Helfer aktiviert das Release atomar und führt den lokalen
   Healthcheck aus.
6. Anschließend prüft der vollständige Produktions-Smoke-Test
   `https://white-gloss.de`.
7. Bei einem fehlgeschlagenen Live-Test wird der vorherige Commit reaktiviert
   und erneut geprüft.
8. Zum Schluss muss der aktive Server-Symlink exakt auf den geprüften Commit
   zeigen.
