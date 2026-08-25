# WHITE GLOSS — Bestandsaufnahme (Phase 0) und Sicherheitsprüfung (Phase 1)

Stand: 2026-08-24 · Grundlage: Commit `dfaadab`

Dieses Dokument ist die geforderte Ausgangsanalyse vor dem schrittweisen
Plattform-Ausbau. Es verändert nichts am System. Jede Aussage ist mit der
Prüfmethode versehen, weil eine Bestandsaufnahme ohne Beleg wertlos ist.

## Wie gelesen werden muss

| Kennzeichnung        | Bedeutung                                                 |
| -------------------- | --------------------------------------------------------- |
| **geprüft**          | in dieser Umgebung ausgeführt und beobachtet              |
| **statisch geprüft** | im Quelltext nachvollzogen, nicht zur Laufzeit beobachtet |
| **nicht prüfbar**    | erfordert Zugang, den diese Umgebung nicht hat            |

**Grenze dieser Umgebung:** Der Analyse-Container erreicht weder Supabase noch
ERPNext, Resend, Lexware oder das IMAP-Postfach — die Netzwerkregel lässt nur
wenige Hosts zu. Alles, was echte Verbindungen zu diesen Diensten braucht, ist
deshalb **nicht prüfbar** und unten ausdrücklich so markiert. Das ist keine
Entwarnung, sondern eine offene Lücke in dieser Analyse.

---

## 1. Architektur-Zusammenfassung

**Frontend und Backend sind ein Programm.** TanStack Start rendert serverseitig
und liefert dieselben Module an den Browser aus; es gibt keinen getrennten
API-Dienst. Der Serverteil läuft unter Nitro.

| Schicht           | Umsetzung                                                                      |
| ----------------- | ------------------------------------------------------------------------------ |
| Framework         | TanStack Start 1.168 auf Vite 8, Nitro 3 (Beta)                                |
| Routing           | dateibasiert, 44 Routen; `src/routeTree.gen.ts` ist eingecheckt                |
| Serverlogik       | 89 Server-Funktionen in `src/lib/*.functions.ts`                               |
| Datenbank         | PostgreSQL bei Supabase — **zwei Zugriffswege**, siehe Abschnitt 5             |
| Authentifizierung | Supabase Auth; Rollen in `public.user_roles`, Prüfung über `has_role()`        |
| Storage           | zwei Supabase-Buckets: `gallery` (öffentlich), `condition-photos` (privat)     |
| ERPNext           | acht Deno-Edge-Functions unter `supabase/functions/`                           |
| E-Mail            | Resend für ausgehende Mail, IMAP nur lesend für den Posteingang                |
| Deployment        | GitHub Actions → IONOS-VPS über SSH, mit Smoke-Test und Rollback               |
| Analytics         | Ahrefs (ohne Einwilligung, cookielos), Google und Meta (nur nach Einwilligung) |
| Adminbereich      | 13 Seiten unter `/admin`, rund 5.500 Zeilen                                    |

Der Geschäftsprozess läuft heute so: Anfrage über den Buchungsassistenten →
`create_booking_public` in der Datenbank berechnet Preis, Rechnungsnummer und
Anzahlung → Mail und Handy-Benachrichtigung → Bearbeitung im Adminbereich →
optional Gegenangebot mit Token-Link → Bestätigung → Lexware-Rechnung →
Erinnerung per Cron.

---

## 2. Aktive Integrationen

| Integration         | Zweck                                                | Datenhoheit    | Status                                        |
| ------------------- | ---------------------------------------------------- | -------------- | --------------------------------------------- |
| Supabase (Postgres) | Buchungen, Inhalte, Kundennotizen, Zustandsmeldungen | Website        | produktiv, tragend                            |
| Supabase Auth       | Adminanmeldung, Rollen                               | Supabase       | produktiv, tragend                            |
| Supabase Storage    | Fahrzeugfotos, Galerie                               | Website        | produktiv                                     |
| ERPNext             | Kunde, Fahrzeug, Auftrag                             | ERPNext (Ziel) | **im Aufbau**, Schreibpfade default-deny      |
| Resend              | ausgehende Mail                                      | —              | produktiv, Schlüssel fehlt in dieser Umgebung |
| IONOS IMAP          | Posteingang, nur lesend                              | Postfach       | produktiv, Zugangsdaten fehlen hier           |
| Lexware             | Rechnungen                                           | Lexware        | produktiv vorgesehen, Schlüssel fehlt hier    |
| Anthropic           | KI-Assistent im Adminbereich                         | —              | optional, ohne Schlüssel unsichtbar           |
| Telegram / WhatsApp | Benachrichtigung aufs Geschäftshandy                 | —              | optional                                      |
| Ahrefs Analytics    | Reichweitenmessung, cookielos                        | Ahrefs         | seit heute aktiv                              |
| Google Ads / GA4    | Conversion, Analytics                                | Google         | nur nach Einwilligung                         |
| Meta Pixel / CAPI   | Conversion                                           | Meta           | nur nach Einwilligung                         |
| GitHub Actions      | CI und Deployment                                    | —              | produktiv                                     |

### Vermutlich veraltet — noch nichts löschen

Der Startauftrag nennt „alte Lovable-Reste", „frühere CRM-/ERP-Versuche" und
„doppelte Mail-Systeme". **Gesucht, nicht gefunden:** kein Treffer für
`lovable`, `zoho`, `vercel`, `netlify` oder `firebase` im Quelltext; die
einzigen Erwähnungen stehen in `TODO-user.md` und in `package-lock.json`
(transitive Paketnamen). Es gibt genau ein Mail-System (Resend) und genau eine
ERP-Zielplattform (ERPNext). _(statisch geprüft)_

---

## 3. Security-Findings nach Kritikalität

### Keine kritischen Funde

**P0 — nichts offen.** Die drei P0-Verdachtsmomente aus dem Startauftrag habe
ich gezielt geprüft und entkräftet:

**`.env` im Repository enthält keine Secrets.** Die Datei führt zehn Werte,
alle öffentlich: Supabase-URL und Publishable Key, Meta-Pixel-ID, drei
Google-IDs, der Ahrefs-Schlüssel. Sie stehen ohnehin im Quelltext jeder Seite.
Die Datei erklärt das in eigenen Kommentaren und warnt ausdrücklich davor, das
CAPI-Token dort abzulegen. _(geprüft)_

**Die Git-Historie ist sauber.** Ich habe den flachen Klon auf die vollen 755
Commits erweitert und jede je committete `.env`-Fassung sowie sämtliche Patches
gegen bekannte Secret-Formate geprüft (Anthropic, Resend, Supabase-JWT, Meta,
Telegram, Postgres-URLs, Slack). Einziger Treffer: eine als solche
gekennzeichnete Beispielzeichenkette in einer Anleitung. _(geprüft)_

**Keine Serversecrets im Client-Bundle.** Elf Secret-Namen im ausgelieferten
JavaScript gesucht. Die sieben Treffer sind ausnahmslos **Namen in
Admin-Hilfetexten**, keine Werte — eine Stelle sagt sogar ausdrücklich „der
Wert wird hier absichtlich niemals angezeigt". Der Service-Role-Key wird
ausschließlich über `process.env` bzw. `Deno.env` gelesen, nie mit
`VITE_`-Präfix. _(geprüft)_

### Bestätigt tragfähig

| Bereich              | Befund                                                                                                                                                                                                                                                                                                   | Methode          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Adminautorisierung   | alle 89 Server-Funktionen mit Anmeldepflicht prüfen zusätzlich die Adminrolle serverseitig; kein Frontend-Verstecken als einzige Sperre                                                                                                                                                                  | statisch geprüft |
| RLS                  | auf allen 12 Tabellen aktiviert                                                                                                                                                                                                                                                                          | statisch geprüft |
| Fahrzeugfotos        | privater Bucket. Die anonyme Upload-Policy wurde in `20260812231500_security_hardening.sql` wieder entfernt; geschrieben wird ausschließlich serverseitig mit der Service-Role, nach Prüfung von MIME-Typ, Größe und Dateisignatur. Lesen und Löschen nur Admin, Anzeige über kurzlebige signierte Links | statisch geprüft |
| CSRF                 | Middleware für alle zustandsändernden Server-Funktionen                                                                                                                                                                                                                                                  | statisch geprüft |
| Preisberechnung      | verbindlich in der Datenbank, nicht im Browser                                                                                                                                                                                                                                                           | statisch geprüft |
| Statuswerte          | `bookings_status_check` in der Datenbank und `bookingStatuses` im Code führen dieselben sechs Werte in derselben Reihenfolge; ein unbekannter Status kann nicht gespeichert werden                                                                                                                       | statisch geprüft |
| Buchungs-Wettlauf    | `pg_advisory_xact_lock` je Kalendertag plus Tageslimit                                                                                                                                                                                                                                                   | statisch geprüft |
| ERPNext-Schreibpfade | default-deny, revisionsgebundene Freigabe, Lease vor jedem externen Schreibvorgang                                                                                                                                                                                                                       | statisch geprüft |

### Offene Risiken

| Stufe             | Befund                                                                                                                                                                    | Wirkung                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **mittel**        | Die Drosselung öffentlicher Schreibpfade liegt im Arbeitsspeicher **je Prozess**. Bei mehreren Instanzen oder wechselnden Adressen greift sie schwächer als sie aussieht. | Missbrauch von Formularen und Uploads |
| **niedrig**       | Nitro läuft auf `3.0.260603-beta`.                                                                                                                                        | siehe Abschnitt 6                     |
| **nicht prüfbar** | Session-Ablauf, Brute-Force-Schutz und Passwort-Reset liegen bei Supabase Auth und sind hier nicht beobachtbar.                                                           | offen                                 |

---

## 4. Prüfungen, die in dieser Umgebung liefen

| Prüfung                                                               | Ergebnis                                                               |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `npm run lint`                                                        | sauber                                                                 |
| `npm run typecheck`                                                   | sauber                                                                 |
| `npm run typecheck:functions` (Deno)                                  | in dieser Umgebung durch gesperrtes `jsr.io` blockiert; in der CI grün |
| `npm test`                                                            | 28 Dateien, 109 Tests                                                  |
| `npm run build`                                                       | erfolgreich                                                            |
| `npm audit --omit=dev`                                                | 0 Schwachstellen                                                       |
| 25 öffentliche Routen per HTTP                                        | alle erreichbar                                                        |
| Horizontales Scrollen, 5 Seiten × 5 Viewports (360/430/768/1280/1920) | **kein Überlauf**, 25 von 25                                           |

Die Viewport-Prüfung ist eine Messung, keine Gestaltungsbewertung: Sie zeigt,
dass nichts horizontal überläuft. Ob Abstände, Typografie und Tap-Ziele auf
kleinen Geräten gut sind, ist damit **nicht** beantwortet (Phase 16).

---

## 5. Architektur-Risiken

### Zwei Wege in dieselbe Datenbank

`src/lib/db.server.ts` spricht Postgres direkt über `pg` an, daneben existiert
der Supabase-Client. Beide greifen auf dieselben Tabellen zu, aber unter
verschiedenen Regeln: der direkte Weg umgeht RLS und setzt stattdessen einen
Actor-Kontext, der Supabase-Weg unterliegt RLS.

Das ist erkennbar Absicht und heute konsistent umgesetzt. Es ist trotzdem die
größte Stelle, an der künftige Änderungen auseinanderlaufen können — wer eine
RLS-Policy verschärft, ändert am direkten Weg nichts.

### Doppelte Wahrheit steht bevor, nicht dahinter

Heute ist die Datenhoheit eindeutig: Buchungen, Inhalte und Notizen gehören der
Website, ERPNext hat nur Kunde und Fahrzeugauftrag, und die Schreibpfade sind
default-deny. Der Zielzustand verschiebt Kunde, Auftrag, Angebot und Rechnung
nach ERPNext. **Der Übergang ist das Risiko**, nicht der jetzige Stand: Solange
beide Seiten dieselben Daten führen, braucht jede Änderung eine benannte
führende Quelle.

### Rechnungen an zwei Stellen

Die Website erzeugt PDF-Belege (`bookingDocument.ts`), Lexware erzeugt die
verbindliche Rechnung, und ERPNext soll die Rechnungsinstanz werden. Die
Website-Belege sind als „RECHNUNG · ENTWURF" gekennzeichnet, tragen aber keine
Steuernummer. Vor dem Umzug nach ERPNext muss festgelegt werden, welche der
drei Stellen die Rechnung tatsächlich stellt.

---

## 6. Nitro-Beta

`nitro@3.0.260603-beta` ist als direkte devDependency gepinnt. TanStack Start
1.168 setzt Nitro 3 voraus; eine stabile 3.0 existiert nicht. Die Beta ist also
keine Nachlässigkeit, sondern die einzige Möglichkeit, dieses Framework zu
verwenden. Die Version ist exakt gepinnt, der Build ist reproduzierbar, das
Deployment läuft darüber.

**Empfehlung: nicht anfassen.** Ein Wechsel wäre ein Framework-Wechsel. Sinnvoll
ist, die Version bewusst zu halten und beim Erscheinen einer stabilen 3.0 mit
Changelog, Build, Tests und Smoke-Test zu wechseln.

---

## 7. Nicht anfassen

Diese Bereiche funktionieren, sind bewusst gebaut und brauchen keinen Umbau:

- der Buchungsassistent samt Validierung, Drosselung und Tageslimit
- `create_booking_public` als verbindliche Preis- und Nummerninstanz
- die ERPNext-Schleusen (Readiness, Preview, Write-Gate, Lease, Durability)
- die Einwilligungslogik für Google und Meta samt versioniertem Schlüssel
- die Content-Security-Policy
- die Deployment-Kette mit Smoke-Test und Rollback
- die Adminautorisierung

---

## 8. Quick Wins

| Aufwand | Nutzen | Maßnahme                                                                                                          |
| ------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| klein   | mittel | `.env.example` mit allen 28 Servervariablen als Platzhalter — heute muss man sie aus dem Quelltext zusammensuchen |
| klein   | klein  | Steuernummer in die Belegentwürfe, sobald sie vorliegt                                                            |
| mittel  | hoch   | Diagnoseseite, die je Dienst zeigt: konfiguriert, erreichbar, letzter Fehler                                      |

---

## 9. Priorisierte Tabelle

| Prio | Bereich      | Problem                                       | Ursache                       | Auswirkung                                                               | Risiko  | Lösung                                                                            | Aufwand | Abhängigkeiten    | Prüfung                      |
| ---- | ------------ | --------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------- | ------- | ----------------- | ---------------------------- |
| P0   | —            | keine kritischen Funde                        | —                             | —                                                                        | —       | —                                                                                 | —       | —                 | Abschnitt 3                  |
| P1   | Drosselung   | greift nur je Prozess                         | In-Memory-Zähler              | Formularmissbrauch bei mehreren Instanzen                                | mittel  | Zähler in die Datenbank oder vorgelagerte WAF                                     | M       | Deployment        | Lasttest über zwei Instanzen |
| P1   | Betrieb      | kein Fehler-Monitoring                        | nie eingerichtet              | Störungen fallen erst durch Kundenmeldung auf                            | mittel  | Sentry o. ä. für Client und Server                                                | M       | Hosting-Variablen | Fehler künstlich auslösen    |
| P1   | ERPNext      | Datenhoheit noch nicht verbindlich festgelegt | Übergangszustand              | doppelte Wahrheit bei Kunde/Auftrag                                      | hoch    | Zielmodell je Datentyp schriftlich festlegen, dann migrieren                      | L       | ERPNext-Zugang    | Abgleich beider Seiten       |
| P2   | Statusmodell | erlaubte Übergänge nicht festgelegt           | nie definiert                 | unzulässige Sprünge möglich, etwa von „Storniert“ zurück auf „Bestätigt“ | mittel  | Übergangstabelle festlegen — **braucht eine fachliche Entscheidung des Betriebs** | M       | Buchungen, Admin  | Übergangstabelle testen      |
| P2   | Buchung      | keine Zwischenspeicherung bei Abbruch         | nie gebaut                    | abgebrochene Anfragen gehen verloren                                     | mittel  | Entwurf lokal sichern und wiederaufnehmen                                         | M       | Wizard            | Abbruch und Rückkehr testen  |
| P3   | Belege       | Entwürfe ohne Steuernummer                    | Daten fehlen noch             | Beleg unvollständig                                                      | niedrig | Feld ausgeben, sobald hinterlegt                                                  | S       | Steuernummer      | PDF sichten                  |
| P4   | Tracking     | Funnel nicht durchgängig messbar              | Ereignisse nur teilweise      | Werbewirkung nicht beurteilbar                                           | niedrig | Ereignismodell definieren und umsetzen                                            | M       | Consent           | Ereignisse zählen            |
| P5   | Performance  | jsPDF und html2canvas im Client (585 kB)      | Beleg wird im Browser erzeugt | langsamer Erststart                                                      | niedrig | erst bei Bedarf nachladen oder serverseitig erzeugen                              | M       | Unterlagen-Seite  | Bundle vorher/nachher        |

---

## 10. Empfohlene Reihenfolge

1. **P1 Monitoring** — ab hier sieht man Fehler, statt sie zu vermuten. Sollte vor größeren Umbauten stehen, weil es alle folgenden Schritte absichert.
2. **P1 Drosselung** — hängt an der Frage, ob mehr als eine Instanz läuft; die ist vorher zu klären.
3. **P1 Datenhoheit ERPNext** — erst schriftlich festlegen, dann Code. Ohne ERPNext-Zugang nicht abschließbar.
4. **P2 Statusmodell** — nur die Übergangsregeln fehlen; sie sind fachlich zu entscheiden, nicht technisch abzuleiten.
5. **P2 Buchungsentwurf sichern** — direkter Conversion-Effekt.
6. danach P3 bis P5.

## 11. Was diese Analyse offen lässt

- Laufzeitverhalten aller Dienste mit echten Zugangsdaten
- Zustellbarkeit der Mails, SPF, DKIM, DMARC
- ERPNext-Verhalten im Fehlerfall am echten System
- Sitzungs- und Passwortlogik von Supabase Auth
- gestalterische Qualität auf kleinen Geräten
- Core Web Vitals unter realen Bedingungen
- Backup- und Wiederherstellungsfähigkeit

---

## 12. Korrektur an dieser Analyse

Die erste Fassung dieses Dokuments führte als P1 auf, anonyme Aufrufer dürften
in `condition-photos` beliebige Pfade anlegen. **Das ist falsch.** Die Policy
aus `20260806120000_condition_reports.sql` wurde in
`20260812231500_security_hardening.sql` wieder entfernt; seitdem schreibt
ausschließlich der Server mit der Service-Role, nach Prüfung von MIME-Typ,
Größe und Dateisignatur.

Ursache: Ich hatte die anlegende Migration gelesen, aber nicht die spätere, die
sie zurücknimmt. Maßgeblich ist immer die Summe aller Migrationen, nie eine
einzelne.

### Nachtrag zur Korrektur

Auch der P2-Eintrag zum Statusmodell war zur Hälfte falsch. Er behauptete
„Status als Zeichenketten" und legte nahe, das Vokabular sei ungesichert. Es
ist gesichert: `bookings_status_check` in
`20260807230000_booking_workflow.sql` lässt genau die sechs Werte zu, die
`bookingStatuses` im Code führt — gleiche Werte, gleiche Reihenfolge.

Offen ist allein, welche **Übergänge** zwischen diesen Werten erlaubt sein
sollen. Das ist keine technische Ableitung, sondern eine Frage an den Betrieb:
Darf eine stornierte Buchung wieder bestätigt werden? Darf „Bezahlt" zurück?
Solange das nicht entschieden ist, wäre jede Übergangstabelle geraten.
