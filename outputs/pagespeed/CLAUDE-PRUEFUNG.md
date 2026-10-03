# PageSpeed-Reparatur White Gloss, 3. Oktober 2026

Repository: White-Gloss/glanz-buchung-meister. Basis und vor der Änderung aktive IONOS-Release: 8e900aa082fa2f502290a85a6036fcc9a0b3a95a. Branch: codex/pagespeed-20261003. Den aktuellen Head und seine eigenen CI-Ergebnisse prüfen; kein älteres Grün übernehmen.

## Belegter Ausgangspunkt

Google-PageSpeed-Bericht: https://pagespeed.web.dev/analysis/https-white-gloss-de/5r8hjl3zho?form_factor=mobile&hl=de, 03.10.2026 22:48:25 MESZ, Lighthouse 13.5.0. Homepage mobil: 87/100/100/100; FCP 1951 ms, LCP 2401 ms, TBT 0 ms, CLS 0.195, Speed Index 1951 ms. Desktop: 100/100/100/100, CLS 0.028. Keine CrUX-Felddaten im Bericht. Details: baseline.json; vollständige ursprüngliche DOM-Nachweise und Screenshots liegen im Arbeitsordner.

## Ursachen und Korrekturen

- Das nach Hydration eingeblendete Consent-Banner änderte bottom der Hero-Copy: gemeldeter Layoutshift 0.188. hero-clearance.css verschiebt sie jetzt mittels individueller CSS-translate-Eigenschaft. Die ursprünglichen Basispositionen und die bestehende transform-Scrollanimation bleiben erhalten. Banner und CTA dürfen sich nicht überdecken.
- Der erst nach Hydration gerenderte Pausebutton vergrößerte die mobile Controls-Zeile: gemeldeter Layoutshift 0.007. scroll-film-hero.tsx reserviert dessen Fläche von SSR an. Ohne aktivierte Bewegung bleibt der Button unsichtbar, deaktiviert und ohne Tastatur-/Screenreaderzugriff.
- Vier globale blockierende CSS-Dateien sind in public.css zusammengeführt, in unveränderter Reihenfolge: styles.css, refinement.css, luxury.css, hero-clearance.css. Root lädt eine globale Datei; die Komponenten-CSS bleibt separat. Kein verzögertes Print-CSS und keine Abschwächung der CSP. Im lokalen Produktionsbuild: eine globale CSS-Datei, keine verbleibenden CSS-Imports. Der reale SSR-Head und die Darstellung werden in Linux-CI geprüft.
- Die zusätzliche Prüfung fand bei 844×390 eine von der 544px-Mindesthöhe verursachte Überdeckung der Hero-Links durch Consent. Kurzes Querformat erhält deshalb eine kompakte Copy-Anordnung über den Filmkontrollen; alle Originaltexte bleiben erhalten. Die geometrische Prüfung verlangt zusätzlich, dass Copy und Controls zwischen Header und Banner sichtbar bleiben.
- Die öffentliche Live-HTML-Variante enthält kein Grok-Extensions-Skript. Die isolierte Kopie wählte anhand ihres Loopback-Hosts irrtümlich den alten Vorschau-Zweig. Loopback wird daher wie eine öffentliche Seite behandelt; echte Grok-Vorschaudomains bleiben erhalten. Das ist eine Korrektur der Messumgebung und kein behaupteter Ladegewinn in Produktion. Fremdrequests werden weiterhin nicht still aus der Messung entfernt.

## Verifikation und Grenzen

Lokal bestanden: Produktionsbuild, TypeScript, ESLint (0 Fehler, 5 bestehende Warnungen), Prüfung der Produktionsabhängigkeiten (0 gemeldete Schwachstellen), alle 15 Scrollfilm-Tests, Syntax- und Diffprüfung. Der erste Build scheiterte am eingeschränkten Windows-Dateizugriff; Wiederholung mit Dateizugriff bestand. Ein bestehender Test der Hosting-Sperre lief unter Windows in einen Zeitabbruch; das ist kein bestandener Test. Die unveränderte CI führt den vollständigen Testbestand aus.

Neue Messung ausschließlich innerhalb der bestehenden isolierten Linux-GitHub-QA: Lighthouse 13.5.0, je drei Läufe mobile/desktop gegen den tatsächlichen PR-Build. Rohberichte, Einstellungen, Fremdrequests, Einzelwerte, Mediane und noch fehlende 100-Ziele stehen im Artifact isolated-qa-results unter lighthouse/. Kein Score wird aus geschätzten Einsparungen abgeleitet. Anfängliche externe Requests machen die Messung ungültig. Das bestehende Live-LHCI ersetzt diese Messung nicht.

hero-stability/ dokumentiert erste Besuche ohne gespeicherte Einwilligung bei 390×844, 844×390 und 1440×900, CLS-Ursachen, CTA-/Banner-Geometrie, Screenshots und Film-/Pauseprüfung. Fallbacks werden ausdrücklich als nicht interaktiv geprüft gekennzeichnet.

Die erste Linux-CI bestand die allgemeinen Tests, stoppte aber an einer veralteten CSS-Dateinamenerwartung im Kompressionstest. Die Erwartung wurde auf den gebündelten Assetnamen umgestellt, Kompressions- und Cache-Prüfungen beibehalten. Der zweite Lauf bestand bestehende SSR-/Flow-/Sitemap-/SEO-/Responsive-/Buchungsprüfungen und dokumentierte den Querformatfehler. Neue Messwerte stets aus dem aktuellen Head lesen; diese beiden Läufe sind kein finales Grün.

Lighthouse-Prüfungen sind Laborergebnisse der gemessenen URLs. Eine erfolgreiche PR-CI beweist weder Veröffentlichung noch Google-PageSpeed-100 auf der Live-Seite. Veröffentlichung separat über den bestehenden IONOS-Weg bestätigen: Release-SHA, aktiver Dienst, öffentliche Smoke-Prüfung und neue PageSpeed-Messung.

Keine lokalen Website-Server starten, keine Sperren entfernen, keine echten Kundenanfragen/Uploads/Nachrichten auslösen. Fotos, Filmdateien, Schrift, Preise und Buchungs-/CRM-/Consent-Logik sind unverändert.
