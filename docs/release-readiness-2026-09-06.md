# White Gloss – vorbereiteter Veröffentlichungsstand

Stand: 6. September 2026. Dieser Stand integriert den aktuellen GitHub-main
`ec0eac2` einschließlich der neun seit dem ursprünglichen Audit hinzugekommenen
Commits. Die Performance-/Accessibility-Änderungen bleiben enthalten; die neue
Qonto-Anbindung wurde beim Zusammenführen erhalten. Es wurde nichts veröffentlicht.

## Umgesetzt

- **Build und Migration getrennt:** `npm run build` erstellt ein Artefakt ohne
  Datenbankzugriff. `scripts/migrate.mjs` ist ein ausdrücklicher Schritt, prüft vor
  jedem DDL das Zielmodell, serialisiert Migrationen und protokolliert keine
  unbereinigten Datenbankfehler. Ohne `DATABASE_URL` schlägt der Befehl fehl.
- **Freigabeprüfung:** `npm run check:release` prüft Konfiguration, Tabellen,
  Migrationshistorie und den tatsächlich für Kunden-Upserts erforderlichen
  eindeutigen Index. Der Check ist lesend. `server/middleware/00-release-readiness.ts`
  schützt auch den Produktionsstart: Ein unpassender Stand liefert vor dem
  eigentlichen Handler 503 mit `no-store`. Das lässt den bestehenden IONOS-
  Aktivierungshelfer einen ungeeigneten Release zurückweisen. Negative Prüfungen
  werden frühestens nach fünf Sekunden wiederholt.
- **Anmeldung:** Native Google- und E-Mail-Sitzungen werden unabhängig von den
  Grok-Broker-Credentials geprüft. Ein fehlendes Broker-Credentialpaar aktiviert
  keinen Broker. Produktion erhält niemals den gemeinsam genutzten `dev-user`.
  Betroffen: `src/lib/auth/server.ts`, `verify.server.ts`, `session-policy.ts`.
- **CI:** `npm run test:release` startet eine eigene isolierte Instanz, prüft ihre
  Kennung und führt SSR-, Buchungs-, Upload- und Sitemap-Prüfungen aus. Belegte
  Ports führen zum Abbruch. Eigene Prozesse werden anschließend beendet. Der
  GitHub-Workflow führt diese Prüfung nach dem Build aus und sichert Nachweise.
- **Produktions-Smoke:** `scripts/smoke-production.mjs` kann den öffentlichen
  Domainnamen gegen einen isolierten Loopback-Server prüfen. Die normalen
  Live-Prüfungen bleiben erhalten. Sitemap-Adressen werden XML-korrekt gelesen.
- **Inhalte:** Technische Datenschutzangaben zum tatsächlichen Foto-Upload,
  privaten Supabase-Speicher, Upload-Cookie und optionalen Resend-Versand ergänzt.
  CMS-Veröffentlichungsdaten werden auch bei PostgreSQL-Date-Werten als ISO-Datum
  ausgegeben. Betroffen: `src/routes/datenschutz.tsx`, `ratgeber.$slug.tsx`,
  `ratgeber.index.tsx`, `src/lib/cms-date.ts`.
- **Betriebsdokumentation:** README und Deploymentanleitung entsprechen jetzt
  Node 24, dem tatsächlichen lokalen Port, den verwendeten Variablennamen und
  dem eigenständigen Migrationsschritt.

## Bestätigter externer Freigabepunkt

Der Nutzer kennt die momentan verwendete Produktionsdatenbank nicht und hat
angegeben, die Seite mit einem Grok-Bot erstellt zu haben. Im Repository bestehen
Grok-Anbindungen und ein GitHub→IONOS-Ablauf. Die Erstellung mit Grok allein
belegt weder den derzeit aktiven Deploymentweg noch die Datenbankverbindung.

Das verbundene Supabase-Projekt `mvlhoibkkvmudxlevtlt` wurde ausschließlich über
Schema- und Storage-Metadaten gelesen: `public.bookings.id` ist dort **UUID**, und
die Spalten gehören zum älteren Buchungsmodell. Das aktuelle Repository erwartet
**integer**-Buchungen mit `shop_id`, `phone` und `total_cents` sowie weitere
Anwendungstabellen. Diese Modelle sind nicht austauschbar. Der dortige
`condition-photos`-Bucket ist privat und besitzt die passende 12-MB-/MIME-Grenze;
das bestätigt lediglich seine Speicherkonfiguration.

**Vor Live-Freigabe muss der tatsächliche Laufzeit-/Datenbankkontext am verwendeten
Hosting bestätigt werden.** Es liegt hier kein eingerichteter Zugriff auf die
geschützte Serverkonfiguration vor. Keine Root-Migration gegen das vorhandene
Supabase-UUID-Modell ausführen. Eine Datenübernahme in ein anderes Modell muss
als eigener Übergang mit Erhalt der vorhandenen Buchungen geplant werden.

## Ablauf nach bestätigtem Datenbankziel

1. Den geschützten Betriebskontext und eine wiederherstellbare Sicherung der
   tatsächlich genutzten Datenbank bestätigen. Bestehende Kunden-/Buchungsdaten
   bleiben erhalten; keine leere Datenbank als vermeintliche Reparatur anlegen.
2. Am kompatiblen Ziel mit dem vorhandenen Secret-Ladeverfahren die
   `DATABASE_URL` und Betriebsvariablen bereitstellen. Keine Werte in Git,
   Befehlszeilen oder Chat kopieren. Nur `DATABASE_URL` wird als DB-Verbindung
   gelesen; `POSTGRES_URL`/`SUPABASE_DB_URL` sind kein automatischer Ersatz.
3. `npm run db:migrate` aus dem geprüften Checkout ausführen. Die unabhängigen
   Dateien `0006_booking_upload_capability.sql` und `0006_qonto_invoice.sql`
   werden über ihren vollständigen Namen geführt. Bereits angewandte Dateien
   bleiben unverändert. `--initialize` ist nur für eine ausdrücklich bestätigte,
   leere Neuinstallation gedacht, niemals für das bestehende UUID-Modell.
4. `npm run check:release` muss vollständig bestehen. Benötigt werden insbesondere
   eine stabile Auth-Signatur, geschützte Anmeldung, HTTPS-Storage-URL und die
   Schlüssel/Absender für den vollständigen Buchungs- und Mailbetrieb.
5. Nach ausdrücklichem Veröffentlichungsauftrag die geprüfte Änderung über den
   vorhandenen Review-/CI-Prozess nach `main` übernehmen. Der IONOS-Workflow wird
   nur bei aktivierter Repository-Variable ausgeführt, reproduziert den Build
   und aktiviert das Artefakt nach den vorhandenen Prüfungen. Grok/Vercel-
   Veröffentlichungen benötigen den entsprechend bestätigten Zielkontext.
6. Live-Erreichbarkeit, Authentifizierung und tatsächliche Providerzustellung
   am freigegebenen System prüfen. Der bestehende Smoke-Test bleibt aktiv; bei
   Fehlern gilt der vorhandene Rollbackablauf. Nur additive Migrationen aus
   dieser Runde sind enthalten; ein Rollback der Anwendung löscht keine Spalten.

Die Datenbank- und Providerprüfungen im Entwicklungsablauf verwenden PGlite und
lokale Testantworten. Sie beweisen keine echte E-Mail-Zustellung, keine
Google-Anmeldung mit einem realen Konto und keine Produktionsdatenübernahme.
Die zuvor dokumentierten Lighthouse-Messwerte sind historisch: Für diesen
Veröffentlichungsstand wird kein neu gemessener Lighthouse- oder Feldwert behauptet.
Native Screenreader-/Geräteprüfungen und reale Core Web Vitals bleiben offen.

## Tatsächlich ausgeführte Abschlussprüfungen

| Prüfung | Ergebnis |
|---|---|
| Node-Produktionsbuild und SSR-Nachbearbeitung | bestanden |
| TypeScript der Anwendung | bestanden |
| Deno-Typprüfung der Supabase-Funktionen | bestanden, keine Functions ausgeführt |
| ESLint | 0 Fehler, 3 bestehende Warnungen |
| npm test | 223 Tests bestanden, einschließlich Auth- und Release-Regressionen |
| npm audit, Produktionsabhängigkeiten | 0 bekannte Schwachstellen |
| Isolierter Release-Runner | 5 SSR-Tests einschließlich 130 Stadtseiten, 8 Buchungs-/Uploadfälle, 4 Sitemapfälle bestanden |
| HTTPS hinter Reverse Proxy | Upload-Cookie mit __Host-, Secure, HttpOnly und SameSite=Strict; berechtigter Folgeupload bestanden |
| Produktionskonfiguration fehlt | Startseite und Auth-Endpunkt liefern generische 503 und no-store vor dem Handler |
| Vollständiger Produktions-Smoke gegen isolierten Build | 18 Kernseiten, 183 Sitemap-URLs, 404, robots, Google-Verifizierungsdateien, Sicherheitsheader und Auth-Origin/401 bestanden |
| Browserprüfung | Startseite Desktop/Mobil und Datenschutz Mobil visuell geprüft, kein horizontaler Überlauf, keine erfassten Browserfehler |

Der erste lokale Produktions-Smoke meldete erwartungswidrig das Grok-
Vorschauskript. Ursache war ein unvollständiger simulierter Proxy-Kontext;
`X-Forwarded-Host` fehlte. Mit dem vollständigen Host-/Protokollkontext bestand
derselbe Build sämtliche Prüfungen. Die bestehende Brandinglogik und alle
Produktionsprüfungen blieben erhalten; beide Protokolle liegen im Nachweisarchiv.

Die PostgreSQL-16-Prüfungen für das separate Supabase-Altschema und dessen RLS
wurden hier nicht erneut ausgeführt. Sie bleiben im vorhandenen CI-Job erhalten.
Es wurde kein neuer GitHub-Workflow gestartet, kein Produktionskonto angemeldet,
keine echte Nachricht gesendet und keine externe Migration ausgeführt.

## Reproduzierbare lokale Prüfung

```sh
npm ci
npm run lint
npm run typecheck
npm run typecheck:functions
npm test
npm run build
npm run test:release
```

Der normale Build verwendet Node als Standardziel, Vercel bei entsprechendem
Laufzeitflag. `NITRO_PRESET` kann das Ziel ausdrücklich festlegen. Für die isolierte
Node-Prüfung ist `node-server` erforderlich. Die QA-Umgebung setzt
`ALLOW_LOCAL_PGLITE=1` nur bei leerer Datenbank-URL und Loopback-Bindung. Diese
Ausnahme gehört nicht in den öffentlichen Betrieb.

Bei laufendem isoliertem QA-Server kann der komplette Produktions-Smoke auf
POSIX-Systemen so ausgeführt werden (PowerShell: Variablen über `$env:` setzen):

```sh
SMOKE_BASE_URL=http://127.0.0.1:8082 \
SMOKE_PUBLIC_ORIGIN=https://white-gloss.de \
npm run smoke:production
```

Die Abweichung zwischen Abrufziel und öffentlichem Origin wird nur für
Loopback-Ziele akzeptiert. Öffentliche Status-, Canonical-, Sicherheitsheader-,
Sitemap-, Indexierungs- und Loginprüfungen werden dabei nicht ausgelassen.
