# White Gloss – 10-Punkte-Roadmap zum High-End-Agenturstandard

Stand: 10.08.2026

Status-Legende: **ERLEDIGT** · **IN ARBEIT** · **BLOCKIERT** · **OFFEN**

> Ein Punkt wird erst als ERLEDIGT markiert, wenn sein Abnahmekriterium tatsächlich erfüllt und überprüft wurde. Sichere, reversible und kostenfreie technische Arbeiten können selbstständig vorbereitet bzw. umgesetzt werden. Für Zugangsdaten, kostenpflichtige Änderungen, rechtlich sensible Einstellungen, DNS-/Domain-Eingriffe oder sonstige irreversible Produktionsänderungen ist eine ausdrückliche Freigabe erforderlich.

## Fortschritt

- [ ] **1. Domainmigration `whitegloss.de` → `white-gloss.de`** — **IN ARBEIT / P0**
  - Alte URLs 1:1 permanent auf die jeweilige neue URL weiterleiten.
  - Redirect-Ketten vermeiden.
  - Alte und neue Search-Console-Property sauber verbinden und Adressänderung durchführen.
  - **Technischer Teilpunkt ERLEDIGT (10.08.2026):** Der automatisierte Domain-Migrationsaudit bestätigt für `/`, `/leistungen`, `/preise`, `/qualitaet`, `/abholservice`, `/faq` und `/ratgeber` jeweils eine direkte permanente `301`-Weiterleitung von `whitegloss.de` auf denselben Pfad unter `white-gloss.de`. Der Audit läuft reproduzierbar per `npm run audit:domain-migration` und zusätzlich automatisiert in GitHub Actions.
  - **Offen:** Search Console / Adressänderung und die tatsächliche Verarbeitung der neuen Domain durch Google beobachten bzw. abschließen.
  - **Abnahme:** Weiterleitungen funktionieren dauerhaft und Google verarbeitet die neue Domain als Ziel.

- [x] **2. GitHub → IONOS automatisch deployen** — **ERLEDIGT / P0**
  - Genauen IONOS-Tarif identifizieren.
  - Passende Deployment-Architektur für Node/SSR wählen.
  - Deployment nur nach erfolgreicher Prüfung von `main` auslösen.
  - Rollback und Environment-Konfiguration dokumentieren.
  - **Verifiziert ERLEDIGT (10.08.2026):** Der bestehende IONOS-VPS wird nach erfolgreichem CI-Lauf auf `main` automatisiert aus GitHub Actions beliefert. Die Pipeline reproduziert den Produktions-Build, überträgt ein geprüftes Release-Paket, aktiviert Releases atomar, führt unmittelbar einen Live-Smoke-Test aus und rollt bei einem Fehlschlag auf das vorherige Release zurück.
  - **Produktionsnachweis:** Workflow `Deploy to IONOS VPS`, Run `31402673159`, für Commit `f6272f57401a79bdaac5ace174b6332aa5e92943` erfolgreich. Deployment-Konfiguration, Produktions-Build, Übertragung, atomare Aktivierung, Live-Smoke-Test und Bestätigung der aktiven Release-ID waren erfolgreich.
  - **Abnahme erfüllt:** Ein erfolgreicher Merge auf `main` erzeugt automatisch und reproduzierbar eine neue Produktion; fehlgeschlagene Builds beschädigen die bestehende Version nicht.

- [ ] **3. Core Web Vitals / Lighthouse real messen** — **IN ARBEIT / P1**
  - Mobile/Desktop für Startseite, Preise, Leistung und Buchungsflow messen.
  - LCP, INP und CLS beobachten.
  - Performance-Budgets definieren.
  - **Labor-Baseline ERLEDIGT (10.08.2026):** Mobile- und Desktop-Lighthouse-CI laufen reproduzierbar gegen `/`, `/preise`, `/leistungen` und `/abholservice`, jeweils mit drei Messläufen pro URL. Die definierten Accessibility-, Best-Practice-, SEO- und Performance-Schwellen werden automatisiert ausgewertet.
  - **Verifizierter Befund:** Desktop erfüllt die aktuellen Assertions. Mobile erfüllt sie bis auf den CLS der Seite `/abholservice`; gemessen wurden ca. `0,195–0,198` bei einem Zielwert von `<= 0,10`.
  - **Offen:** Ursache des mobilen Layout Shifts auf `/abholservice` beseitigen, anschließend erneut messen; danach stabile Produktionsmessungen sowie spätere Felddaten/CrUX auswerten und Budgets ggf. verschärfen.
  - **Abnahme:** Kernseiten erreichen wiederholbar gute Laborwerte und reale Felddaten zeigen keine kritischen CWV-Probleme.

- [ ] **4. End-to-End-Tests für Buchung und Kernflows** — **OFFEN / P1**
  - Paketwahl, Fahrzeug, Extras, Fotos, Termin und Anfrage automatisiert testen.
  - Pflichtfelder, Fehlerfälle und Mobile abdecken.
  - Zentrale Admin-Flows separat absichern.
  - **Sicherheitsgrenze:** Ein echter Produktions-E2E-Test darf keine Testbuchungen oder Testfotos in Live-Systeme schreiben. Für vollständige E2E-Abdeckung ist deshalb entweder eine isolierte Testkonfiguration oder Punkt 9 (Staging/Preview) erforderlich.
  - **Abnahme:** Regressionen in geschäftskritischen Flows blockieren einen Merge.

- [x] **5. Post-Deploy Smoke-Tests** — **ERLEDIGT / P1**
  - Nach Deployment `/`, `/preise`, `/leistungen`, `/sitemap.xml` und `/admin` prüfen.
  - HTTP-Status und Kerninhalte validieren.
  - **Umgesetzt:** Ein read-only Produktions-Smoke-Test prüft Kernseiten, Canonicals, Sitemap, robots.txt und zentrale Security-Header; ein GitHub-Workflow führt ihn zusätzlich regelmäßig aus.
  - **Verifiziert (10.08.2026):** Live-Test erfolgreich; `/`, `/preise`, `/leistungen` und `/admin` liefern HTTP 200, die Sitemap liefert HTTP 200 und enthält 29 URLs, robots.txt liefert HTTP 200.
  - **Post-Deploy-Verknüpfung verifiziert (10.08.2026):** Der IONOS-Produktionsworkflow führt den Live-Smoke-Test unmittelbar nach atomarer Release-Aktivierung aus. Im erfolgreichen Run `31402673159` für Commit `f6272f57401a79bdaac5ace174b6332aa5e92943` war der Smoke-Test erfolgreich; bei Fehlschlag ist ein automatischer Rollback auf das vorherige Release vorgesehen.
  - **Abnahme erfüllt:** Produktion wird unmittelbar nach jedem Release automatisch auf Erreichbarkeit und Kernfunktionen geprüft.

- [ ] **6. Monitoring und Fehleralarme** — **IN ARBEIT / P1**
  - Uptime-Monitoring für Domain und Kernrouten.
  - Frontend-/Serverfehler zentral erfassen.
  - Alarmierung bei 5xx/Ausfällen/erhöhter Fehlerquote.
  - **Umgesetzt:** Die Live-Seite wird über GitHub Actions alle sechs Stunden mit dem read-only Smoke-Test geprüft.
  - **Offen:** Zentrales Exception-/Fehlermonitoring und gezielte Alarmierung ergänzen.
  - **Abnahme:** Kritische Fehler werden automatisch erkannt, protokolliert und gemeldet.

- [ ] **7. Trust / Social Proof / echte Referenzen** — **OFFEN / P1**
  - Echte Vorher/Nachher-Fahrzeuge veröffentlichen.
  - Google-Bewertungen glaubwürdig integrieren.
  - Werkstatt, Prozesse, Produkte und Qualifikationen zeigen.
  - B2B-/Leasing-/Keramik-Referenzen mit realen Projekten belegen.
  - **Abnahme:** Besucher sehen innerhalb weniger Sekunden reale Beweise für Qualität, Erfahrung und Zuverlässigkeit.

- [ ] **8. Consent Mode v2 + präzisere Conversion-Messung** — **OFFEN / P2**
  - Consent-Zustände sauber an Google weitergeben.
  - Qualifizierte Anfragen und echte Aufträge getrennt messen.
  - Conversion-Wert und Transaktions-ID konsistent verwenden.
  - Enhanced Conversions nur nach fachlicher/datenschutzrechtlicher Prüfung.
  - **Abnahme:** Kampagnen können auf belastbaren, deduplizierten Conversion-Daten optimiert werden.

- [ ] **9. Staging / Preview vor Produktion** — **OFFEN / P2**
  - Separate Preview-/Staging-URL einrichten.
  - Produktionsnahe Konfiguration ohne Live-Kundendaten.
  - PRs/Release-Branches vor Produktion testen.
  - **Abnahme:** Größere Änderungen sind vollständig testbar, ohne die Live-Seite zu beeinflussen.

- [ ] **10. Local Authority und lokale Google-Signale** — **IN ARBEIT / P1**
  - Google Business Profile vollständig und konsistent pflegen.
  - Name, Adresse, Telefon, Öffnungszeiten und Website überall identisch halten.
  - Echte Bewertungen systematisch aufbauen und beantworten.
  - Relevante lokale Erwähnungen/Branchenverzeichnisse/Partnerschaften aufbauen.
  - **Abnahme:** Website, Search Console, Unternehmensprofil und externe lokale Signale arbeiten widerspruchsfrei zusammen.

## Aktueller technischer Stand

Die Website hat bereits eine starke Grundlage: technische SEO, strukturierte Leistungs- und Stadtseiten, Sitemap, Canonicals, interne Verlinkung, strukturierte Daten, Buchungsflow, CI sowie Performance-orientierte Bild-/Bundle-Strategien. Die Roadmap konzentriert sich deshalb bewusst auf die verbleibenden Unterschiede zu einem belastbaren Agentur-/Enterprise-Betrieb statt auf zusätzliche dekorative Änderungen.

Die technischen Quality-Gates und Bedienbefehle sind zusätzlich in `docs/quality-gates.md` dokumentiert.
