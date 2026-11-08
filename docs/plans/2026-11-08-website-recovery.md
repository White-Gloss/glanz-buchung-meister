# Website Recovery Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vorbereitete Website-Studio-Funktionen auf aktuellem main integrieren und bestehende Inhaltsbearbeitung bei deaktiviertem Studio erhalten.
**Architecture:** Die vorhandene TanStack-/CMS-Architektur bleibt erhalten. Unveränderte Git-Blobs sichern die bisherigen Implementierungen; nur der gemeinsame Testbefehl und reproduzierte Funktionsfehler werden gezielt geändert.
**Tech Stack:** TypeScript, React, TanStack Start, PostgreSQL, Node-Test, Playwright, GitHub Actions.

## Global Constraints

Kein main-Merge, Deployment, produktive Migration oder Aktivierung ohne gesonderte Freigabe. Keine Preisregel-/Kundendatenänderung, Testbuchung oder Kunden-E-Mail. Keine lokalen Website-Server; Browser-Flowtests ausschließlich im vorhandenen Linux-GitHub-CI.

---

### Task 1: Aktuellen Entwicklungsstand integrieren
**Files:** package.json; alle 111 in PR #318 bestätigten Pfade; docs/WHITE-GLOSS-HANDOFF.md.
**Interfaces:** Konsumiert main d20a8e1 und PR318 b30f723; liefert isolierten Branch mit beiden Historien und vereinigtem npm-test-Befehl.
- [x] Aktuelle Rechte, Anweisungen, Audit, PRs, Baumdifferenzen und alten CI-Nachweis prüfen.
- [x] Einzige Überlappung package.json bestimmen; OpenAI-Test in Studio-Testliste erhalten.
- [x] `node --experimental-strip-types --test src/lib/googleTag.test.ts src/lib/openai-conversions.test.ts`: 30 Tests bestanden.
- [ ] Branch als Draft-PR sichern, vorhandene vollständige CI auswerten.

### Task 2: Bisherige CMS-Bearbeitung erhalten
**Files:** src/components/cms-editor.tsx, src/lib/cms.functions.ts, src/lib/cms.availability.ts; vorgeschlagen src/components/cms-legacy-editor.tsx, src/lib/cms-legacy.store.ts und passende Tests.
**Interfaces:** Bestehende listCms/upsertCms/deleteCms; Studio-Freischaltung und bestehende Betreiber-Anmeldung.
- [ ] Flag aus: bestehende CMS-Typen über bisherigen Datenvertrag bearbeiten, ohne Migration 0025 vorauszusetzen.
- [ ] Flag an: WebsiteStudio mit Entwurf/Veröffentlichung/Fassungen verwenden; keine Umgehung durch Legacy-Schreibpfad.
- [ ] Lese-/Schreibfehler sichtbar; keine unbemerkte leere Liste bei Fehler.
- [ ] Regressionen für Flag aus/an, fehlende Migration und gesperrte Betreiberrechte ausführen; bestehenden Studio-CI-Lauf ergänzen.

### Task 3: Prüfen und übergeben
**Files:** WEBSITE-STUDIO-RELEASE.md, docs/WHITE-GLOSS-HANDOFF.md.
**Interfaces:** Bestehende CI verify/schema/studio/cross-browser und zugehörige Artefakte.
- [ ] Unabhängige Reviews bearbeiten, reproduzierte Fehler mit fokussierten Tests korrigieren.
- [ ] Lint, beide Typprüfungen, Haupttests, SEO, Build, Datenbank-/Rechte- und Browserprüfungen am abschließenden Commit bestehen.
- [ ] Tatsächliche Lighthouse-Labordaten getrennt von Produktionsmessungen/Felddaten dokumentieren.
- [ ] Fehlende reale Geräte-, Indexierungs-, Hosting-/Backup- und redaktionelle Nachweise explizit offenhalten.

## Redaktionelle und betriebliche Entscheidungen

Neue Inhaberhistorie, Werkstattbilder, Bildrechte und lokale Referenzfälle benötigen echte freigegebene Inhalte. Produktive Einrichtung und Restore-Nachweis werden erst nach gesonderter Freigabe ausgeführt. Daraus folgt keine Sperre für die hier erlaubte Entwicklungsarbeit.
