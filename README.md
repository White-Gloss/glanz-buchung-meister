# White Gloss Detailing

Website und Buchungssystem für White Gloss Detailing, gebaut mit TanStack Start,
React, TypeScript, Tailwind CSS und Nitro. Die Produktionsarchitektur ist eine
Node-/SSR-Anwendung auf IONOS.

## Verbindlich: kein lokales Hosting

Der Betreiber untersagt den Start der Website auf lokalen Rechnern, auch für
Vorschauen oder Tests. Entwicklungs-, Preview- und QA-Startbefehle brechen ab.
Vite blockiert auch direkte Dev-/Preview-Aufrufe. Der erzeugte Node-Build prüft
vor dem Laden der Anwendung seinen Ausführungskontext: nur das aktive IONOS-
Release oder der vorhandene isolierte Linux-GitHub-CI-Job darf starten.
Es gibt keinen lokalen Freigabeschalter. Auch `CI=true` oder
`NODE_ENV=production` allein heben die Sperre nicht auf.

Dateibearbeitung, Installation, Builds, Lint und Typprüfung bleiben lokal
erlaubt. Keine Docker-, Tunnel- oder statischen Ersatzserver verwenden.
Die Projektsperre schützt die vorgesehenen Startwege; sie ist keine
Betriebssystem-Sicherheitsgrenze gegen absichtlich veränderten Code oder
beliebige andere Serverprogramme. Eine Aufhebung braucht eine neue
ausdrückliche Betreiberanweisung.

## Lokal bearbeiten, ohne Webserver

Benötigt werden Git, npm und Node.js `24` (wie in CI).

```sh
git clone https://github.com/White-Gloss/glanz-buchung-meister.git
cd glanz-buchung-meister
npm ci
npm run typecheck
npm run build
```

Diese Schritte erstellen nur Dateien. Browserprüfungen verwenden
`https://white-gloss.de` und dürfen keine echten Kundenanfragen auslösen.

## Umgebungsvariablen

Login, Buchungen, Galerie, Ratgeber und dynamische Preise benötigen folgende
Umgebungsvariablen:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL` (die Anwendung liest keine alternativen Datenbankvariablen)
- `BETTER_AUTH_SECRET` (dauerhafter serverseitiger Wert, mindestens 32 Zeichen)
- `SUPABASE_SERVICE_ROLE_KEY` für den privaten Datei-Upload
- `RESEND_API_KEY` und `MAIL_FROM` für Buchungsmails

Der Release-Check prüft diese Betriebsfunktionen vor der Freigabe. Ohne
vollständige Konfiguration oder mit unpassendem Datenbankschema antwortet ein
Produktionsbuild mit 503. Die isolierten Flowtests laufen ausschließlich im
vorhandenen Linux-GitHub-CI-Job, nicht auf Entwicklerrechnern.

Für die Anzeigenmessung (jeweils optional — ohne die Variablen bleibt die
betreffende Anbindung vollständig inaktiv):

- `VITE_GOOGLE_ADS_CONVERSION_ID` und `VITE_GOOGLE_ADS_CONVERSION_LABEL`
- `VITE_META_PIXEL_ID` — Meta Pixel im Browser
- `META_PIXEL_ID` und `META_CAPI_ACCESS_TOKEN` — serverseitige Conversions API
- `META_TEST_EVENT_CODE` — optional, für den Testereignis-Reiter im Events Manager

Google-Tag und Meta-Pixel laden ausschließlich nach erteilter
Cookie-Einwilligung. Ohne Zustimmung wird weder ein Skript geladen noch ein
Ereignis gesendet — auch serverseitig nicht.

Zugangsdaten gehören in die geschützten Umgebungsvariablen des
Produktionshostings. Für lokale Builds sind keine Produktionsgeheimnisse nötig.
Geheimnisse dürfen nicht
in Git veröffentlicht werden. `META_CAPI_ACCESS_TOKEN` darf nicht mit
`VITE_`-Präfix gesetzt werden, sonst landet das Token im öffentlichen
Browser-Bundle.

## Prüfen und bauen

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Der Build greift auf keine Datenbank zu. Vor einem freigegebenen Produktionsstart
muss das tatsächliche Datenbankziel bestätigt, mit `npm run db:migrate` aktualisiert
und mit `npm run check:release` lesend geprüft sein. Beide Befehle laufen im
geschützten Serverkontext; Secretwerte niemals in Befehlszeilen oder Chat kopieren.

Den Produktionsstart übernimmt ausschließlich die vorhandene systemd-Unit auf
IONOS aus dem aktiven Release. Der direkte lokale Aufruf des Node-Builds ist
gesperrt. `npm run test:release` bleibt dem Linux-GitHub-CI-Job vorbehalten.

Zusätzliche Produktions- und SEO-Prüfungen:

```sh
npm run smoke:production
npm run audit:domain-migration
npm run lighthouse:mobile
npm run lighthouse:desktop
```

## Deployment

Die Zielarchitektur für IONOS sowie Build-, Start-, Secret- und Rollback-Regeln
stehen in [`docs/deployment.md`](docs/deployment.md). Ein GitHub→IONOS-Workflow ist
bereits vorhanden. Die Freigabebedingungen für diesen Stand, einschließlich des
noch zu bestätigenden Produktions-Datenbankziels, stehen in
[`docs/release-readiness-2026-09-06.md`](docs/release-readiness-2026-09-06.md).

Die technischen Quality Gates sind in
[`docs/quality-gates.md`](docs/quality-gates.md) dokumentiert.

Der neue Ablauf mit persönlicher Inhaberbestätigung, Abgabeplätzen, Audit,
dauerhaftem Nachrichtenversand und IONOS-Timer steht in
[`docs/booking-workflow-operations.md`](docs/booking-workflow-operations.md).
Die vorhandene Meta Cloud API wird anhand von
[`docs/whatsapp-setup.md`](docs/whatsapp-setup.md) verbunden; `.env.example`
enthält ausschließlich leere Konfigurationsfelder.
