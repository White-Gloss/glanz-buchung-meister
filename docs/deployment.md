# Deployment auf IONOS – technische Vorgaben

Die Website wird auf `white-gloss.de` betrieben. Dieses Projekt ist **keine rein statische Website**, sondern eine Node-/SSR-Anwendung (TanStack Start + Nitro). Der versionierte IONOS-Workflow und die Grok-Anbindungen bestehen parallel. Vor Freigabe muss feststehen, welcher Betrieb und welche Datenbank tatsächlich verwendet werden; siehe [Releasevorbereitung vom 6. September 2026](release-readiness-2026-09-06.md).

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
3. Das bestätigte Produktions-Datenbankziel sichern, ausstehende Root-Migrationen im geschützten Serverkontext ausführen und `npm run check:release` bestehen lassen. Das UUID-Altschema aus `supabase/migrations` ist kein kompatibles Ziel.
4. Änderung nach ausdrücklicher Veröffentlichungsfreigabe nach `main` mergen.
5. GitHub Actions reproduziert genau diesen Build und überträgt `.output/` auf IONOS. Der Build selbst führt keine Migrationen mehr aus.
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
| `SUPABASE_SERVICE_ROLE_KEY`                         | **Pflicht** — Foto-Upload der Kundschaft |
| `ANTHROPIC_API_KEY`                                 | KI-Assistent im Adminbereich            |
| `IMAP_HOST`                                         | Posteingang im Adminbereich             |
| `IMAP_USER`                                         | Postfachname für den Posteingang        |
| `IMAP_PASSWORD`                                     | Postfachpasswort für den Posteingang    |
| `DATABASE_URL` | direkte Datenbankverbindung; nur dieser Variablenname wird gelesen |
| `BETTER_AUTH_SECRET` | dauerhafter Signaturschlüssel, mindestens 32 Zeichen |

### Warum `SUPABASE_SERVICE_ROLE_KEY` nicht optional ist

Interessenten haben im privaten Foto-Speicher keine eigene Schreib-
berechtigung mehr — die anonyme Regel wurde mit der Sicherheitshärtung
entfernt, damit niemand am Server vorbei beliebige Dateien ablegen kann.
Jeder Upload läuft seither über den Server, der sich dafür mit diesem
Schlüssel ausweist.

Fehlt der Wert, schlägt **jeder** Foto- und Video-Upload fehl. Die Kundschaft
sieht nur „Der Upload ist derzeit nicht verfügbar", und im Adminbereich geht
schlicht nichts mehr ein — was von dort aus nicht von einer ruhigen Woche zu
unterscheiden ist. Die Seite **Zustandsmeldungen** im Adminbereich zeigt
deshalb einen roten Hinweis, sobald der Schlüssel fehlt.

Derselbe Schlüssel trägt das Aufräumen verwaister Aufnahmen (siehe unten).

### Verwaiste Aufnahmen aufräumen

Aufnahmen wandern schon beim Auswählen in den Speicher, damit das Absenden
später schnell geht. Bricht jemand das Formular danach ab, bleibt die Datei
liegen, ohne dass je eine Meldung dazu entsteht.

Unten auf der Seite **Zustandsmeldungen** steht dafür „Speicher aufräumen":
erst **Nachsehen** — das zählt nur —, dann bei Bedarf löschen. Verschont
bleiben immer Aufnahmen, die zu einer Meldung gehören, sowie alles aus den
letzten sieben Tagen, weil dort ein Formular noch offen sein kann.

**Nicht per Datenbankbefehl aufräumen.** Ein `DELETE` auf `storage.objects`
entfernt nur den Verzeichniseintrag, nicht die Datei — der Platz bliebe
belegt, nur eben unsichtbar. Löschen darf ausschließlich die
Storage-Schnittstelle, und die verlangt den Serverschlüssel.

## KI-Assistent und Bildbewertung

Ohne `ANTHROPIC_API_KEY` ist der Assistent vollständig inaktiv und im
Adminbereich unsichtbar — es erscheint kein Knopf, der nur Fehler wirft.

Ist der Schlüssel gesetzt, gilt: Für jede Anfrage werden Daten an Anthropic
übertragen. Das ist eine **Auftragsverarbeitung nach Art. 28 DSGVO** und
setzt einen entsprechenden Vertrag mit dem Anbieter sowie einen Eintrag im
Verarbeitungsverzeichnis voraus. Der Schlüssel gehört deshalb erst dann auf
den Server, wenn beides vorliegt.

Was übertragen wird:

| Funktion             | Übertragen wird                                              |
| -------------------- | ------------------------------------------------------------ |
| Antwortentwürfe      | Buchungsdaten inkl. Name und Kennzeichen, keine Kontaktdaten |
| Fragen zu den Zahlen | Buchungsliste ohne Namen                                     |
| Website-Texte        | nur das eingegebene Thema                                    |
| Bildbewertung        | ausgewählte Fotos, Fahrzeug, Kennzeichen, Zustandstext       |

Die Bildbewertung unter `/admin/zustand` ist die einzige Stelle, an der
Fotos aus dem privaten Bucket den Server verlassen. Sie läuft ausschließlich
auf ausdrücklichen Knopfdruck, nie automatisch beim Eingang einer Meldung.
Videos und Dateien über rund 3,7 MB werden übersprungen und im Ergebnis
benannt. Die Datenschutzerklärung führt diese Übermittlung in Abschnitt 7
auf — wird der Assistent abgeschaltet, gehört dieser Abschnitt entfernt.

## Posteingang im Adminbereich

Der Adminbereich kann das bestehende Postfach unter `/admin/posteingang`
anzeigen. Dafür sind drei Werte nötig; optional kommen zwei weitere hinzu:

| Variable        | Pflicht | Bedeutung                                                  | IONOS-Vorgabe   |
| --------------- | ------- | ---------------------------------------------------------- | --------------- |
| `IMAP_HOST`     | ja      | Adresse des Mailservers                                    | `imap.ionos.de` |
| `IMAP_USER`     | ja      | vollständige Mailadresse, z. B. `info@white-gloss.de`      | –               |
| `IMAP_PASSWORD` | ja      | Passwort dieses Postfachs                                  | –               |
| `IMAP_PORT`     | nein    | Port des Mailservers                                       | `993`           |
| `IMAP_SECURE`   | nein    | direkte Verschlüsselung; leiten sich sonst aus dem Port ab | `true`          |

`IMAP_PASSWORD` ist das Passwort des echten Firmenpostfachs und damit eines der
empfindlichsten Geheimnisse überhaupt. Es gehört ausschließlich in
`/etc/white-gloss/environment`, niemals ins Repository, niemals mit
`VITE_`-Präfix und niemals in einen Chatverlauf.

Fehlt einer der drei Pflichtwerte, zeigt die Seite einen Einrichtungshinweis
statt einer Fehlermeldung; der übrige Adminbereich bleibt unberührt.

Die Verbindung öffnet das Postfach **schreibgeschützt**. Nachrichten werden
weder als gelesen markiert noch verschoben, gelöscht oder in der Datenbank
gespeichert; Anhänge werden nur mit Namen und Größe aufgeführt und nicht zum
Herunterladen angeboten.

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
6. isolierte SSR-, Buchungs-, Upload- und Sitemap-Prüfung am erzeugten Node-Build

`npm run build` ist datenbankfrei. `npm run db:migrate` ist ein eigener,
expliziter Schritt und lehnt fehlende URLs, das UUID-Altschema und unbestätigte
leere Ziele ab. `--initialize` ist ausschließlich für eine zuvor bestätigte,
leere Neuanlage vorgesehen, niemals als Reparatur einer bestehenden Datenbank.
Die beiden Dateien mit Präfix `0006_` sind unabhängige Migrationen; die Historie
verwendet ihre vollständigen Dateinamen. Keine bereits angewandte Datei umbenennen.

Die erste Produktionsanfrage prüft Konfiguration, Schema und Migrationsstand
lesend, bevor ein Handler läuft. Bei einem Problem antwortet sie mit 503 und
`no-store`; damit kann der vorhandene Aktivierungshelfer den fehlerhaften Stand
nicht als gesund bestätigen. Eine negative Prüfung wird frühestens nach fünf
Sekunden wiederholt. Es wird weder eine Datenbank angelegt noch ein Schema
automatisch umgeschrieben.

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
