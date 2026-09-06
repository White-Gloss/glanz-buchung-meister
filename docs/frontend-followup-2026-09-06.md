# White Gloss – Fortsetzung der Optimierung

Stand: 6. September 2026. Repository White-Gloss/glanz-buchung-meister, Branch codex/performance-accessibility-seo. Diese Runde setzt auf 31c676153408699d2bec0f446aa139f87299e367 auf. Ausgangspunkt aller Änderungen bleibt c92e2d855b21112006d284a078886c98d635f9a4. Der tatsächliche lokale Checkout liegt unter C:/Users/info/Documents/Codex/2026-09-06/vercel-plugin-vercel-openai-curated-remote-3/work/glanz-buchung-meister.

## 1. Buchung, Fotoanfrage und Upload

Die vollständigen Abläufe wurden mit dem echten Produktionsserver und einer frischen PGlite-Datenbank geprüft. Resend und Supabase Storage wurden durch kontrollierte lokale Antworten ersetzt; andere serverseitige Fetch-Ziele waren blockiert. Es wurden keine echten Nachrichten versandt, keine Produktionsdaten verändert und keine externen Migrationen ausgeführt.

- Kundenspeicherung verwendet atomisches INSERT ... ON CONFLICT statt SELECT mit anschließendem INSERT. Datei: src/lib/bookings.functions.ts.
- Ungültige Kalenderdaten werden vor Datenbankschreibzugriff abgewiesen. Dateien: src/lib/calendar-date.ts, booking-schema.ts, public-form-validation.ts; Regression in booking-schema.test.ts.
- Uploadauswahl prüft Anzahl, Typ und 12-MB-Grenze vor dem Einlesen. Fehler sind mit dem Dateifeld verknüpft. Die Auswahl wird nicht mehr still auf acht Dateien gekürzt. Dateien: src/lib/upload-policy.ts, src/components/booking-photo-upload.tsx.
- Der Server validiert den gesamten Stapel, einschließlich Signatur und Base64-Obergrenze, vor dem ersten Upload. Bei technischen Abbrüchen werden nur die exakten zufälligen Pfade und Metadaten dieses Versuchs bereinigt. Eine fehlgeschlagene Inbox-Benachrichtigung verwandelt einen gespeicherten Upload nicht in einen Fehler. Dateien: src/lib/booking-photos.ts, bookings.functions.ts.
- Eine erratbare Vorgangsnummer reicht nicht mehr als Uploadnachweis. Neue Buchungen erhalten ein zufälliges HttpOnly-/SameSite=Strict-Cookie für sieben Tage. Bei HTTPS kommen Secure und ein __Host-Präfix hinzu. Die Datenbank speichert Hash und Ablaufzeit. Dateien: src/lib/booking-upload-capability.ts, booking-upload-cookie.server.ts, migrations/0006_booking_upload_capability.sql.
- Die separate Fotoanfrage übermittelt weiterhin ausdrücklich nur Beschreibung und Dateinamen. Der bestehende Produktumfang und Datenschutzhinweis bleiben erhalten; echte Aufnahmen werden nach einer Buchung nachgereicht.

Acht vollständige lokale Prüffälle bestanden: Buchung bis Referenz/Inbox/Mail; Upload ohne Cookie abgewiesen; ungültige zweite Datei ohne Schreibzugriff abgewiesen; Speicherfehler und erfolgreiche Wiederholung; Abbruch an der zweiten Datei mit Bereinigung und Erhalt früherer Aufnahmen; Fotoanfrage ohne Dateitransfer; freie Terminbestätigung trotz Mailproviderfehler; Cookie eines anderen Vorgangs abgewiesen. Die Oberfläche wurde zusätzlich mit gültiger Buchung, Fotoanfrage und Upload bis zur Erfolgsmeldung bedient.

## 2. Mobile Performance und Buildstabilität

src/components/preview-host-bridge.tsx lädt die Vorschau-Brücke und ihre Validierungsbibliothek erst in einem zulässigen eingebetteten Vorschaufenster. Die Komponente bleibt eingebunden; Ursprungskontrolle, Navigation und Cleanup bleiben erhalten. Sieben Regressionstests prüfen auch den Unmount während eines Imports. Projektabhängigkeiten und Lockfile blieben unverändert.

Die tatsächliche Browserprüfung deckte einen bestehenden Fehler der SSR-Nachbearbeitung auf: scripts/fix-ssr-exports.mjs war auf den Exportalias s festgelegt, Rolldown erzeugte nun u. Der Build meldete Erfolg, obwohl HTML 500 lieferte. Die Reparatur in scripts/ssr-namespace-repair.mjs erkennt unterschiedliche Aliasse; Tests laden die reparierten Module tatsächlich. Die Buildprüfung führt zusätzlich Node --check aus. Danach lieferten die Seiten wieder erfolgreich HTML.

Lighthouse 13.4.1, lokaler Node-Produktionsbuild, Windows/Chrome, gleiche Mobiledefaults beziehungsweise explizite Desktopkonfiguration. Je Route/Gerät drei Abschlussläufe, Median. Vergleich zur vorigen abgeschlossenen Runde:

| Route / Gerät | Performance | LCP | CLS | Übertragung |
|---|---:|---:|---:|---:|
| / · Mobil | 91 → 91 | 2.93 → 2.96 s | 0.0087 → 0.0285 | 409 → 393 KiB |
| /preise · Mobil | 90 → 91 | 2.94 → 2.85 s | 0.0067 → 0.0067 | 316 → 301 KiB |
| / · Desktop | 100 → 100 | 0.72 → 0.68 s | 0.0010 → 0.0010 | 561 → 546 KiB |
| /preise · Desktop | 100 → 99 | 0.69 → 0.74 s | 0.0035 → 0.0162 | 330 → 315 KiB |

Accessibility und SEO liegen jeweils bei 100. Best Practices bleibt bei 77 aufgrund des bestehenden lokalen Grok-Vorschauskripts. Die endgültigen Messungen werden vollständig geliefert; die bessere Zwischenserie mit 92/91 mobil wird nicht als Endstand ausgewiesen. Der geringere Transfer ist reproduzierbar, ein verlässlicher weiterer LCP-Gewinn auf der Startseite ist in den Abschlussläufen nicht nachgewiesen. Die Reflowkorrektur bleibt trotz geringfügig höherer CLS auf der Desktop-Preisseite bestehen; alle gemessenen CLS-Werte liegen unter 0,1. Dies sind Labordaten. TBT ist kein Nachweis für INP; alle TBT-Mediane stehen in messwerte-fortsetzung.json.

## 3. Vertiefte Barrierefreiheit

- Nach einem Seitenwechsel fokussiert src/components/route-focus.tsx den tatsächlich gerenderten Hauptinhalt. Hashnavigation und reine Queryänderungen bleiben unberührt. Ausgelöst wird dies über das vorhandene onRendered-Ereignis des Routers. Prüffälle: Footerlink und Navigation per Tab/Enter aus dem geöffneten Menü, jeweils Fokus main-content.
- Der vorher absolut positionierte Titelbereich in styles.css kann mit Inhalt und Textgröße wachsen. Dadurch werden Titel bei niedriger Ansicht nicht mehr unter dem Kopfbereich abgeschnitten. Die normale Darstellung behält Mindesthöhe und Schichtung.
- 24 abschließende axe-/Reflowprüfungen auf acht Routen und drei Viewports: keine automatisierten WCAG-A/AA-Verstöße, kein horizontaler Überlauf, keine unerwarteten Konsolenfehler. Der 404-Hinweis der absichtlich unbekannten Route ist erwartet.
- Zehn zusätzliche Prüfungen auf Preise, Kontakt, Dellen, Danke und Buchungsanker: 320×256-Reflow sowie 200-Prozent-Basisschrift. Screenshots wurden visuell kontrolliert. Das kleine Menü hielt 20 Tab-Schritte sichtbar innerhalb des Dialogs; Escape schloss es und stellte den Fokus auf Menü öffnen wieder her.

Echter Browserzoom reagierte in der steuerbaren Headless-Umgebung nicht auf das Tastenkürzel. Screenreader-Audio, native Screenreaderbedienung und physische Mobilgeräte waren hier nicht verfügbar. Geprüft wurden DOM-/Accessibility-Struktur, Fokus, Textvergrößerung und die [von W3C beschriebene Reflowbreite entsprechend 400-Prozent-Zoom](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), kein behaupteter vollständiger Screenreader-/Zoomnachweis. Eine umfassende WCAG-2.2-AA-Konformitätsbehauptung wird nicht abgegeben.

## 4. Dynamische CMS-Sitemap

public/sitemap.xml wurde unverändert nach src/data/sitemap-static.xml verschoben. Die neue Route src/routes/sitemap[.]xml.ts liefert /sitemap.xml dynamisch. src/lib/sitemap.ts und sitemap.server.ts ergänzen ausschließlich veröffentlichte, routbare CMS-Blogs des vorhandenen Shops, ohne vollständige Artikeltexte zu laden. Statische Einträge und dieselbe Auswahl bei doppelten Slugs wie in der Detailroute bleiben erhalten. Ungültige Slugs werden ausgeschlossen; XML und Änderungsdaten werden korrekt ausgegeben.

Eine hängende CMS-Abfrage begrenzt die Antwort nicht unbegrenzt: nach zwei Sekunden wird die vollständige statische Sitemap geliefert, mit höchstens einer weiterlaufenden Abfrage. Erfolgreiche Antworten verlangen Revalidierung; Fallbacks tragen no-store. Die zuerst vorgesehene Nitro-Headerregel überschrieb no-store im echten HTTP-Test und wurde daher entfernt.

Vier HTTP-Prüfungen bestanden: 184 URLs nach Veröffentlichung eines Testartikels bei ausgeschlossenen Entwürfen; Testartikel mit richtigem H1/Canonical erreichbar; unmittelbar wieder 183 URLs nach Zurückziehen; 183 statische URLs mit no-store bei simuliertem CMS-Ausfall. Zehn unabhängige Regressionstests bestehen ebenfalls. docs/google-anbindung.md beschreibt den neuen Ablauf.

## 5. Abschließende Prüfungen und Übergabe

| Prüfung | Ergebnis |
|---|---|
| Node-Produktionsbuild und SSR-Syntaxprüfung | bestanden |
| TypeScript | bestanden |
| ESLint | 0 Fehler; 3 bereits vorhandene Warnungen |
| npm test | 195 Tests bestanden |
| npm run test:frontend | 5 Tests bestanden, inklusive sämtlicher 130 Stadt-Leistungs-Seiten |
| npm run test:flows | 8 Buchungs-/Uploadfälle und 4 Sitemapfälle bestanden |
| axe / Reflow | 24 Prüfungen ohne Befunde oder Überlauf |
| Erweiterte Text-/Reflowprüfung | 10 Zustände geprüft |
| Menütastatur | 20 Schritte ohne Fokusverlust oder unsichtbares Ziel; Escape und Menü-Seitenwechsel bestanden |
| Git-Diff und Patch | auf Formatfehler und Rückwärtsanwendbarkeit geprüft |

Ein SSR-Seriendurchlauf brach mit einem Timeout ab; derselbe unveränderte Endstand bestand die unmittelbare Wiederholung einschließlich aller 130 Stadtseiten in etwa drei Sekunden. Sowohl der fehlgeschlagene als auch der bestandene Durchlauf bleiben im Nachweisarchiv. Die drei Lintwarnungen betreffen weiterhin channel-inbox.tsx, cms-editor.tsx und den gemischten Export in media.tsx.

Die reproduzierbaren isolierten Ablaufskripte stehen im Repository unter scripts/qa/. scripts/qa/README.md dokumentiert npm run qa:serve und npm run test:flows. Sie erzwingen eine lokale Identitätsprüfung vor den synthetischen Schreibtests und speichern Ergebnisse nur im ignorierten Verzeichnis .qa-output.

**Für einen später freigegebenen Release:** Migration 0006 über den bestehenden Migrationsablauf vor dem Start des neuen Codes anwenden; anschließend den vorhandenen Build-/Deploymentablauf verwenden. Neue Uploadnachweise gelten sieben Tage im ursprünglichen Browser. Alte Vorgänge ohne Nachweis sowie ein anderer Browser können nicht mehr allein mit einer WG-Nummer hochladen. Die Oberfläche und Fehlermeldung erklären diese Einschränkung.

Die vorhandene öffentliche Website wurde nur lesend auf Hostingheader geprüft: HTTP 200, Caddy, revalidierendes HTML-Caching und HSTS. Der optimierte Code wurde nicht veröffentlicht. Seine Wirkung auf das tatsächliche CDN/Hosting, reale Zustellung bei Resend/Supabase und echte Core-Web-Vitals-Felddaten bleiben Prüfungen nach einem freigegebenen Release. Wenn sowohl Upload als auch Bereinigung technisch scheitern, kann weiterhin eine manuelle Bereinigung nötig sein; dieser Fall wird generisch protokolliert. Authentifizierte Adminabläufe waren nicht Teil dieser synthetischen Kundentests.

Die vollständigen Änderungen liegen bereits im lokalen Git-Checkout. aenderungen.patch umfasst beide Runden ab dem Ausgangscommit; fortsetzung.patch ausschließlich diese Runde. Die ZIP enthält vollständige geänderte Dateien und eine Liste entfernter Pfade. Ein Git-Patch berücksichtigt auch das Entfernen der alten statischen Sitemap automatisch. Kein Push, Pull Request oder Deployment wurde durchgeführt.
