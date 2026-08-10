# White Gloss – 10-Punkte-Roadmap zum High-End-Agenturstandard

Stand: 10.08.2026

Status-Legende: **ERLEDIGT** · **IN ARBEIT** · **BLOCKIERT** · **OFFEN**

> Ein Punkt wird erst als ERLEDIGT markiert, wenn sein Abnahmekriterium tatsächlich erfüllt und überprüft wurde. Sichere, reversible und kostenfreie technische Arbeiten können selbstständig vorbereitet bzw. umgesetzt werden. Für Zugangsdaten, kostenpflichtige Änderungen, rechtlich sensible Einstellungen, DNS-/Domain-Eingriffe oder sonstige irreversible Produktionsänderungen ist eine ausdrückliche Freigabe erforderlich.

## Fortschritt

- [ ] **1. Domainmigration `whitegloss.de` → `white-gloss.de`** — **IN ARBEIT / P0**
  - Alte URLs 1:1 permanent auf die jeweilige neue URL weiterleiten.
  - Redirect-Ketten vermeiden.
  - Alte und neue Search-Console-Property sauber verbinden und Adressänderung durchführen.
  - **Abnahme:** Weiterleitungen funktionieren dauerhaft und Google verarbeitet die neue Domain als Ziel.

- [ ] **2. GitHub → IONOS automatisch deployen** — **BLOCKIERT / P0**
  - Genauen IONOS-Tarif identifizieren.
  - Passende Deployment-Architektur für Node/SSR wählen.
  - Deployment nur nach erfolgreicher Prüfung von `main` auslösen.
  - Rollback und Environment-Konfiguration dokumentieren.
  - **Abnahme:** Ein erfolgreicher Merge auf `main` erzeugt automatisch und reproduzierbar eine neue Produktion; fehlgeschlagene Builds beschädigen die bestehende Version nicht.

- [ ] **3. Core Web Vitals / Lighthouse real messen** — **OFFEN / P1**
  - Mobile/Desktop für Startseite, Preise, Leistung und Buchungsflow messen.
  - LCP, INP und CLS beobachten.
  - Performance-Budgets definieren.
  - **Abnahme:** Kernseiten erreichen wiederholbar gute Laborwerte und reale Felddaten zeigen keine kritischen CWV-Probleme.

- [ ] **4. End-to-End-Tests für Buchung und Kernflows** — **OFFEN / P1**
  - Paketwahl, Fahrzeug, Extras, Fotos, Termin und Anfrage automatisiert testen.
  - Pflichtfelder, Fehlerfälle und Mobile abdecken.
  - Zentrale Admin-Flows separat absichern.
  - **Abnahme:** Regressionen in geschäftskritischen Flows blockieren einen Merge.

- [ ] **5. Post-Deploy Smoke-Tests** — **OFFEN / P1**
  - Nach Deployment `/`, `/preise`, `/leistungen`, `/sitemap.xml` und `/admin` prüfen.
  - HTTP-Status und Kerninhalte validieren.
  - **Abnahme:** Produktion wird unmittelbar nach jedem Release automatisch auf Erreichbarkeit und Kernfunktionen geprüft.

- [ ] **6. Monitoring und Fehleralarme** — **OFFEN / P1**
  - Uptime-Monitoring für Domain und Kernrouten.
  - Frontend-/Serverfehler zentral erfassen.
  - Alarmierung bei 5xx/Ausfällen/erhöhter Fehlerquote.
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
