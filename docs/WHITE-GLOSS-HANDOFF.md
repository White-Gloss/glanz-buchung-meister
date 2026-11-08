# White-Gloss Website – Recovery und Abnahme

Stand: 8. November 2026. Entwicklung auf isoliertem Branch; keine Produktionsfreigabe.

## Maßgeblicher Stand

- main: `d20a8e1b7e868add1e99fc6279227d085d3f8c03` (erneut live abgeglichen).
- Ausgang PR #318: `b30f7234b3035278d2c52f9ce36daf4316ada1e9`.
- Branch: `codex/website-recovery-20261108`.
- [Draft-PR #323](https://github.com/White-Gloss/glanz-buchung-meister/pull/323).
- Geprüfter Entwicklungscommit: `05f3066f7c86dbe5658835ef86368cb896517f27`.
- PR #317 und #318 bleiben unverändert offen; #319–#322 sind gemergt.
- Repository-Berechtigungen pull/push/admin bestätigt. AGENTS.md, vollständiger Website-Audit vom 7.11. und WEBSITE-STUDIO-RELEASE.md gelesen.

## Recovery und Erhalt der bisherigen Arbeit

Der Integrationscommit `d340d89ad1be61068fe9a382798db3592a0ebf8e` verbindet main und den bestehenden Studio-Head als Eltern. Alle 111 vorbereiteten PR-Dateien wurden übernommen. Einzig package.json war beidseitig geändert; die Testlisten wurden vereinigt. Lockfile und Studio-Abhängigkeiten blieben erhalten, keine neue Abhängigkeit wurde ergänzt.

Die zwölf weiteren Dateien der neueren main-Entwicklung wurden per Git-Blob-Vergleich unverändert nachgewiesen, einschließlich Google-Tag, OpenAI-Einwilligung und Buchungsfunktionen. Bestehende PRs wurden weder geschlossen noch umgeschrieben. Der aus #317 übernommene Fix korrigiert ausschließlich Abholpreis-Anzeigen, keine Preisregeln.

## Implementiert und geprüft

1. **CMS bei ausgeschaltetem Studio:** Bestehende FAQ-, Blog- und Zusatzleistungsverwaltung bleibt ohne Migration 0025 nutzbar. Anmeldung, Betreiberrechte und abgeschaltetes Feature werden serverseitig für jede Operation geprüft. Shop/Typ/ID, Zeilensperre und exakter Datenbankzeitstempel sichern Konflikte. Bereits versionierte/archivierte Studio-Einträge sind gesperrt. Die bisherige unmittelbare Veröffentlichung ist im Button ausdrücklich benannt.
2. **Private Altentwürfe:** Unveröffentlichte Inhalte ohne Revisionsverweise erscheinen vollständig im Studio. Vor dem ersten Schreibvorgang wird ihre ursprüngliche private Fassung gesichert, ohne sie zu veröffentlichen. Lesen verändert keine Daten.
3. **Blog-Kurztext:** Bearbeiten, Vorschau, Veröffentlichen und Wiederherstellen berücksichtigen `extra.note` über das versionierte `content.lead`; 4.000 Zeichen und weitere vorhandene Metadaten bleiben erhalten.
4. **Medien-Verlassensschutz:** Ungespeicherte Alttexte, Bildunterschriften und Freigaben sowie laufende Uploads/Speichervorgänge fließen in den gemeinsamen Navigations-/Reloadschutz ein. Veröffentlichung wartet auf gespeicherte Angaben. Laufende Medienvorgänge können nicht über Verwerfen unterbrochen werden.
5. **Galerie-Browserprüfung:** Beide Vollbilder müssen vor Weiterblättern und Schließen erfolgreich dekodiert sein. Acht genaue Bildnachweise sind verpflichtend. Keine generische Ausnahme für Netzwerkabbrüche, keine deaktivierten Tests.
6. **Bestehende Studio-Funktionen integriert:** Betreiberzugriff, private Uploads, Format-/Größenprüfung, WebP-Neukodierung ohne EXIF/GPS, Entwurf/Vorschau/Publikation, Revisionen/Restore, Galerie, Über-uns und regionale Inhalte. Sicherheitsreview ergab im geprüften Code keinen weiteren belegten Blocker; dies ist keine Freigabe der unbekannten Produktionskonfiguration.

Geänderte Dateien des zusätzlichen Recovery-/Korrekturpakets, zusätzlich zum übernommenen Stand aus #318:

- `src/components/cms-editor.tsx`
- `src/components/cms-legacy-editor.tsx`
- `src/lib/cms.functions.ts`
- `src/lib/cms.availability.ts`
- `src/lib/cms.availability.test.ts`
- `src/lib/cms-legacy.store.ts`
- `src/lib/cms-legacy.store.test.ts`
- `src/lib/cms.store.ts`
- `src/lib/cms.store.test.ts`
- `src/lib/cms.model.ts`
- `src/lib/cms.model.test.ts`
- `scripts/qa/isolated-server.mjs`
- `scripts/qa/check-website-studio.mjs`
- `src/components/website-studio.tsx`
- `src/components/website-studio-media.tsx`
- `src/components/website-studio-fields.tsx`
- `src/components/website-studio-activity.ts`
- `src/components/website-studio-activity.test.ts`
- `src/components/website-studio-render.test.mjs`
- `src/lib/studio-media-access.test.ts`
- `scripts/qa/check-cross-browser.mjs`
- `scripts/qa/gallery-image.mjs`
- `scripts/qa-gallery-image.test.mjs`
- `scripts/qa/export-review-images.mjs`
- `package.json`
- `WEBSITE-STUDIO-RELEASE.md`
- `docs/WHITE-GLOSS-HANDOFF.md`
- `docs/plans/2026-11-08-website-recovery.md`

## Prüfbelege

[CI 42443407513](https://github.com/White-Gloss/glanz-buchung-meister/actions/runs/42443407513) am Commit `05f3066f7c86dbe5658835ef86368cb896517f27`: **success**; alle vier Jobs verify, schema, studio und cross-browser erfolgreich.

- `npm audit --omit=dev --audit-level=moderate`: null gemeldete Schwachstellen.
- Lint, Anwendungstypen, Funktionstypen, Produktionsbuild und Shell-Syntax erfolgreich.
- Hauptsuite: **843 Fälle, 842 bestanden, 0 fehlgeschlagen, 1 bestehender Skip** (`stage is private, preserves source, reveals no credential and refuses overwrite`; bereits im alten #318-Lauf übersprungen und hier nicht verändert).
- Zusätzlich **9 SEO-Policy/Intent-Tests und 3 Ortsstrukturtests bestanden**.
- Isolierte SSR-, Ablauf-, Sitemap-, SEO-, Responsive-, Buchungs-UI-, Lighthouse- und Hero-Stabilitätsprüfungen erfolgreich.
- Studio-Browserprüfung einschließlich Legacy-CRUD ohne Studio-Schema, Rechte/Flag/Konfliktgrenzen, Upload/Freigabe/Entzug/Restore und Medien-Verlassensschutz erfolgreich.
- Firefox und WebKit auf Linux bei 390/1440 px: 24 bestehende Prüfblöcke und zusätzlich 8 verpflichtende dekodierte Galerie-Bildnachweise bestanden. Chromium separat in der Haupt-/Studio-Suite.
- Schemajob baut die Migrationen isoliert auf und prüft Zugriffsregeln sowie konkurrierende Freigaben; keine Produktivdatenbank verwendet.

Artefakte desselben Laufs: [isolated-qa-results](https://github.com/White-Gloss/glanz-buchung-meister/actions/runs/42443407513/artifacts/13602887333), [studio-qa-results](https://github.com/White-Gloss/glanz-buchung-meister/actions/runs/42443407513/artifacts/13602816844), [cross-browser-qa-results](https://github.com/White-Gloss/glanz-buchung-meister/actions/runs/42443407513/artifacts/13602292411).

### Aufgetretene Fehler und Korrekturen

- Lauf 42442534022: Legacy-Textarea wurde über ein bei gefülltem Feld mehrdeutiges Label gesucht; korrigiert auf Rolle und exakten Namen. Drei fehlende Typangaben im neuen Rendertest ergänzt. Veraltete Testerwartung zur ausdrücklichen Studio-Abschaltung im isolierten CI korrigiert.
- Lauf 42442757728: Studio und Schema am Commit `1d418d7` erfolgreich; durch den nächsten Prüfcommit ersetzte Jobs sind kein vollständiger Erfolgsnachweis.
- Lauf 42442876620: 838 Haupttests bestanden, ein bestehender Test übersprungen, null Fehler; zusätzlich 9 SEO- und 3 Ortsstrukturtests bestanden. Schema, Studio, SSR, Abläufe, Sitemap, SEO, Responsive und Buchungs-UI erfolgreich. Hauptjob während Lighthouse durch den nächsten Push abgebrochen; deshalb kein vollständiger Lauf.
- Dessen Cross-browser-Fehler `NS_BINDING_ABORTED` betraf ausschließlich das erste Vollbild customer-16. Der Test ersetzte es vor Abschluss des Downloads. Die neue explizite Dekodierungsprüfung behebt die Testabfolge und prüft dabei die Bildanzeige strenger.
- Lokale serverlose Prüfung durch den Hauptagenten: 30 Tracking/Consent, 11 CMS-Modell/Flag, 3 Medienzustand sowie 4 Galerie- und 8 Diagnosefälle bestanden. Kein lokaler Website-Server gestartet.

## Lighthouse und visuelle Prüfung

**Isolierter Produktionsbuild dieses PRs, Startseite, jeweils drei Messungen:**

| Profil | Performance | Accessibility / Best Practices / SEO | LCP (ms) | CLS | TBT (ms) |
| --- | --- | --- | --- | --- | --- |
| Mobil | 98 / 98 / 97 | jeweils 100 / 100 / 100 | 2409,456 / 2407,581 / 2408,095 | 0 / 0 / 0 | 62 / 49 / 81,5 |
| Desktop | 100 / 100 / 100 | jeweils 100 / 100 / 100 | 492,232 / 497,333 / 491,220 | 0 / 0 / 0 | 0 / 0 / 0 |

**Veröffentlichte Website, getrennte Laborprüfung [42443407514](https://github.com/White-Gloss/glanz-buchung-meister/actions/runs/42443407514), jeweils Median aus drei Läufen:**

| Profil/Seite | Performance (Spanne) | LCP (ms) | CLS |
| --- | --- | --- | --- |
| Mobil / | 98 (97–98) | 2439,255 | 0 |
| Mobil /preise | 100 | 1202,998 | 0 |
| Mobil /leistungen | 100 | 1235,065 | 0 |
| Mobil /abholservice | 100 | 1356,164 | 0 |
| Desktop / | 100 | 509,137 | 0 |
| Desktop /preise | 100 | 283,316 | 0,025 |
| Desktop /leistungen | 100 | 362,443 | 0 |
| Desktop /abholservice | 100 | 364,291 | 0 |

Accessibility, Best Practices und SEO jeweils 100. Ein vorheriger Live-Lauf 42442876621 hatte bei der mobilen Startseite eine größere Performance-Streuung von 75–98 (Median 98); dieser Ausreißer wird nicht verschwiegen oder als Codeverbesserung ausgelegt. Die Live-Läufe messen den unveränderten produktiven Stand.

Search Console Core Web Vitals am 8.11. gelesen, Berichtstand 6.11.: Für Mobil und Computer **nicht genügend Nutzungsdaten in den letzten 90 Tagen**. Deshalb kein belastbarer realer INP-/Core-Web-Vitals-Nachweis.

Die Scores sind synthetische Labordaten, keine Messung tatsächlicher Kunden. TBT ist kein INP. Keine behauptete Performance-Verbesserung ohne vergleichbare Vorher-/Nachher-Messung. Automatisierte Accessibility-Scores sind kein vollständiger WCAG-2.2-AA-Nachweis.

Aktuelle CI-Screenshots der Startseite (Desktop/Mobil), Ortsseite Nagold, Ergebnisvideos, Studio-Vorschau/Mediathek und mobilen Legacy-Verwaltung visuell gelesen. Keine in diesen Ausschnitten bestätigte neue Layoutregression. Automatisierte horizontale Layout- und Bildprüfungen bestanden. Zusätzlich wurde die produktive Startseite in Opera lesend geöffnet/visuell betrachtet. Das ersetzt keine vollständige manuelle Prüfung aller Seiten auf echten Geräten.

## Produktion und Freigabegrenzen

Letzter bestätigter produktiver Release: main `d20a8e1`. Hostinger-Deployment [42440424446](https://github.com/White-Gloss/glanz-buchung-meister/actions/runs/42440424446) erfolgreich, einschließlich atomarer Aktivierung, Live Smoke und Abgleich der aktiven Release-ID. Production Smoke 42440491786 und Live Visual Check 42440491848 ebenfalls erfolgreich.

Der Hostinger-Workflow kann nach erfolgreicher CI eines main-Pushs bei `HOSTINGER_DEPLOY_ENABLED=true` automatisch ausliefern; zusätzlich gibt es einen manuellen Auslöser. Die aktuelle Variableneinstellung und produktive Environment-Freigaben wurden nicht bestätigt. Ein gezielter API-Leseversuch für diese Variable wurde vom GitHub-Connector als nicht unterstützter Fetch-Endpunkt abgewiesen. **Ein späterer Merge braucht deshalb vorher eine ausdrückliche Freigabe einschließlich seiner möglichen Deploymentwirkung.**

Es erfolgten kein main-Merge, Deployment, produktive Migration/Aktivierung, produktiver Upload, Testbuchung, Kundenkontakt oder Kundendaten-/Preisregeländerung.

## Offene, nicht ersetzbare Nachweise

- **Hosting:** Der erste gemeinsame Abruf lieferte kein Ergebnis; getrennte erneute Abrufe waren erfolgreich. VPS 2077393 (`srv2077393.hstgr.cloud`, Ubuntu 24.04, KVM 4) läuft. Die Hostinger-DNS-Zone verweist für @ und panel auf seine IPv4 `187.126.4.225`; www ist CNAME auf white-gloss.de. CPU zuletzt 1,34 %, RAM 4,47 GB, belegter Datenträger 37,69 GB (Messpunkt 8.11., 03:16 UTC). Zwei Providerbackups bestätigt, neuestes 4.11. 04:21 UTC, älteres 27.10. Ein Backup-Eintrag belegt keinen erfolgreichen Restore. Privater Medienpfad, Dateirechte, DB-Migrationsrecht, aktuelles Backup vor Release und isolierter Restore-Nachweis bleiben offen.
- **Geräte und Barrierefreiheit:** Linux-Chromium/Firefox/WebKit und Viewports belegen keine physischen iOS-/Android-Geräte, native Safari-/Windows-Browser oder VoiceOver-/Screenreader-Bedienung. HEIC ist nicht unterstützt; Uploads erlauben JPEG, PNG und WebP.
- **SEO/Redaktion:** 19 Ortsseiten und Noindex-Schutz für 171 dünne Leistung-Ort-Kombinationen bleiben erhalten. Keine erfundenen Niederlassungen/Referenzen. Search Console wurde lesend geprüft (Details unten); eine aktuelle URL-genaue Freigabe aller Ortsseiten, Bing-Daten und reale INP-Felddaten fehlen. Freigegebene Unternehmensgeschichte, Werkstattbilder, Bildrechte und ortsspezifische Referenzfälle sind noch erforderlich.
- **Über uns:** Ohne echte veröffentlichte Fassung bleibt die Seite 404/noindex und außerhalb der Sitemap. Das ist der beabsichtigte Schutz, kein fertiger öffentlicher Unternehmensinhalt.
- **Rollback:** Feature aus stoppt Studio und seine Medien; bereits in cms_items veröffentlichte FAQ-/Blog-/Zusatzleistungstexte werden dadurch nicht inhaltlich zurückgesetzt. Für Inhalte ist eine bewusste Wiederherstellung nötig. Details im Release-Dokument.

## Search-Console-Nachweis

Am 8.11. über die angemeldete Domain-Property `sc-domain:white-gloss.de` gelesen, keine Indexierungsanforderung oder Validierung ausgelöst:

- Sitemap `https://white-gloss.de/sitemap.xml`: **Erfolgreich**, eingereicht 10.10., zuletzt gelesen 3.11.2026, **54 erkannte Seiten**, 0 Videos.
- Seitenindexierung: **46 indexiert, 36 nicht indexiert**, ausdrücklich **Berichtstand 23.10.2026**. Das sind keine frischen Zahlen zum neuen Entwicklungsstand.
- Nicht indexiert: noindex 9; Weiterleitung 2; alternative kanonische Seite 3; gecrawlt, derzeit nicht indexiert 2; gefunden, derzeit nicht indexiert 20. Die 20 Fälle sind als Validierung gestartet angezeigt, noindex/Weiterleitung als fehlgeschlagen. Das ist kein pauschaler Codefehler: beabsichtigte Noindex-/Canonical-/Weiterleitungsregeln müssen erhalten bleiben.
- Sitemap-Erkennung ist nicht gleich Indexierung. Die zwei Berichte haben unterschiedliche Zeitstände und Mengen. Ranking oder Indexierung aller 19 Ortsseiten werden nicht behauptet.

## Exakter nächster Schritt

Draft-PR #323 anhand dieser Nachweise prüfen. Vor einer Produktionsentscheidung über den vorhandenen Hostinger-Zugang Medienpfad/Rechte, DB-Migrationsrecht, Backup mit isolierter Wiederherstellbarkeit und Deployment-Auslöser verifizieren. Danach konkrete Freigabe für Merge/Deployment und getrennt für Migration 0025 und Studio-Aktivierung einholen. Die Aktivierungsreihenfolge und der datenerhaltende Rückweg stehen in WEBSITE-STUDIO-RELEASE.md. Fehlende reale redaktionelle Inhalte erst nach Bereitstellung gezielt ergänzen und freigeben.

Der abschließende Dokumentationscommit ergänzt nur diesen Bericht, den Plan und den Release-Verweis; der Anwendungscode entspricht dem oben genannten geprüften Commit.
