# White-Gloss: Vorschau und Prüfnachweise

Stand: 2. Oktober 2026. Lesend geprüft am Ausgangscommit
`9ec3b63f08a90d72ced674ecf6844b9475a3d576` des getrennten Clones.

## Ergebnis

Im geprüften Repository und den gezielt geprüften lokalen Betriebsunterlagen
ist kein vorhandenes, freigegebenes Ziel für eine getrennte IONOS-Vorschau
belegt. Eine Vorschau wurde deshalb nicht veröffentlicht. Der laufende
Produktionsstand wurde nicht verändert; kein lokaler Website-Server wurde
gestartet. Die Betreiberregel erlaubt Veröffentlichungen ausschließlich über
den vorhandenen freigegebenen IONOS-Weg.

## Belegte Hindernisse

- `docs/deployment.md` dokumentiert als Hauptdomain `https://white-gloss.de`
  und den produktiven Node-/SSR-Betrieb. Ein getrenntes Vorschauziel fehlt.
- `scripts/deploy-ionos-release.sh:5–13` legt die Ziele fest:
  `/srv/white-gloss-releases`, `/srv/white-gloss-current`,
  `white-gloss.service`, `/home/white-gloss-ci/incoming` und
  `http://127.0.0.1:3000/`. Es gibt kein separates Vorschauargument.
  `/var/lib/white-gloss-deploy` ist das geschützte Archiv-Staging des
  Produktionshelfers, keine veröffentlichte Testwebsite.
- `ops/white-gloss.service` verwendet `/srv/white-gloss-current` und
  `/etc/white-gloss/environment`. Eine separate Vorschau-Unit oder
  Vorschauumgebung ist im geprüften `ops/` nicht vorhanden.
- `scripts/hosting-policy.mjs:38–55` erlaubt SSR nur aus dem aktiven
  Linux-IONOS-Release oder dem bestehenden isolierten Linux-GitHub-CI-Job.
  Ein anderer IONOS-Pfad wird vom erzeugten Server zurückgewiesen. Die
  vorhandene Sperre wurde nicht geändert.
- `docs/quality-gates.md:16` nennt `https://staging.example.de` lediglich
  als Beispiel für `SMOKE_BASE_URL`; daraus folgt kein verfügbares Ziel.
- Im Benutzerprofil fehlt `.ssh`; im Clone fehlen lokale IONOS- und
  Vorschau-Konfigurationsdateien. Passende IONOS-/SSH-/Vorschauvariablen
  wurden in der aktuellen Shell nicht gefunden. Der Produktionsworkflow
  referenziert `IONOS_SSH_HOST`, `IONOS_SSH_USER`,
  `IONOS_SSH_PRIVATE_KEY`, `IONOS_SSH_KNOWN_HOSTS` und `IONOS_SSH_PORT`.
  Ihre aktuelle Existenz in GitHub wurde in dieser Teilprüfung nicht geprüft.
- `docs/ionos-vps-bootstrap.md` beschreibt den Benutzer `white-gloss-ci`
  mit Uploadrechten und ausschließlich `activate`/`rollback` über den
  root-eigenen Produktionshelfer. Diese Rechte belegen keine Berechtigung
  zum Einrichten eines zweiten Dienstes oder Reverse-Proxy-Ziels.

## Zulässige CI-Screenshot-Alternative

Der bereits bestehende isolierte Linux-GitHub-CI-Job darf den gebauten Stand
mit synthetischen Daten prüfen. Dort erzeugte Screenshots können als
CI-Artefakte zur visuellen Abnahme bereitgestellt werden. Die Prüfung bleibt
auf dem vorhandenen Linux-Runner und wird nicht auf diesen Rechner verlagert.
Sie veröffentlicht keine Website und erzeugt keine echten Kundenanfragen,
Nachrichten oder Uploads. Eine bloß erfolgreiche lokale Übersetzung ist kein
Screenshot- oder Browsernachweis.

Für die Übergabe müssen der konkrete Commit, der konkrete CI-Lauf, dessen
Prüfergebnis und tatsächlich vorhandene Screenshot-Artefakte zusammen
angegeben werden. Solange diese Artefakte für den geänderten Commit fehlen,
bleibt die visuelle Abnahme offen. Read-only Browserprüfungen des bisherigen
IONOS-Produktionsstands ergänzen diese Abnahme, belegen aber nicht die
Darstellung noch unveröffentlichter Änderungen.

## Mindestvoraussetzungen für eine getrennte IONOS-Vorschau

1. Ein vom Betreiber freigegebenes separates IONOS-Ziel: Vorschauadresse,
   Serveridentität und zuständiger Bereitstellungsweg müssen feststehen.
2. Ein getrenntes Releaseverzeichnis, eine eigene systemd-Unit, ein eigener
   Loopback-Port sowie ein eigener Caddy-/HTTPS-Eintrag. Produktionssymlink,
   Produktionsdienst und Produktionsumgebung dürfen dafür nicht ersetzt
   werden. Die Einrichtung benötigt einen dafür berechtigten Serverzugang.
3. Eine eigene geschützte Vorschauumgebung mit synthetischen Daten.
   Produktionsdatenbank, Kundenmedien, CRM-Schreibzugriffe, Benachrichtigungen,
   Rechnungen, Zahlungen und Werbetracking müssen ausgeschlossen sein.
4. Zugriffsschutz und `noindex` für das Vorschauziel sowie eine passende
   Origin-/Authentifizierungskonfiguration. Ein `noindex` allein ersetzt
   keinen Zugriffsschutz.
5. Ein separat geprüfter Hostingvertrag für genau dieses IONOS-Ziel.
   Die lokale Hosting-Sperre bleibt vollständig bestehen; CI-Variablen
   dürfen nicht zur Umgehung vorgetäuscht werden. Der bestehende
   Produktionshelfer wird nicht ungeprüft erweitert oder überschrieben.
6. Ein reproduzierbarer Bereitstellungs- und Rücknahmeweg für die Vorschau
   einschließlich aktivem Commitnachweis, Startprüfung und read-only
   Browserprüfung. Erst danach ist eine konkrete Vorschauadresse als
   verfügbar zu melden.

Diese Voraussetzungen sind eine vorbereitete Übergabe. Sie wurden nicht
auf dem Server eingerichtet oder als vorhanden bestätigt.
