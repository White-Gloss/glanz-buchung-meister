# Prüfprotokoll

Stand: 2. Oktober 2026. Kein lokaler Website-Server und keine Veröffentlichung.

| Prüfung | Ergebnis |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund` | Erfolgreich, 451 Pakete; keine neue Abhängigkeit eingeführt. |
| `npm run lint` | Erfolgreich: 0 Fehler, 5 bestehende Warnungen. |
| `npm run typecheck` | Nach Korrektur des Telefon-Fallbacks erfolgreich. |
| Vorhandene SEO/Sitemap/JSON-LD-Tests | 17 bestanden. |
| `node --test src/lib/seo-policy.test.ts src/lib/seo-intents.test.ts` | 6 bestanden. |
| `node --check scripts/qa/check-responsive.mjs` | Erfolgreich; das Skript wurde hier nicht ausgeführt. |
| Polish-Detektor für die 3 geänderten UI-Dateien | Keine Befunde. |
| Unabhängiger Quellcode-Review | Keine konkreten Bugs/Regressionen im Diff gefunden. |
| `npm test` unter Windows/Sandbox | Nicht vollständig bestanden: Linux-Deploymenttest benötigt `sha256sum`; Hosting-Guard-/Inspector-Tests liefen in Zeitlimits. Kein Erfolg behauptet; bestehende Linux-CI entscheidet zusätzlich. |
| Lokaler Build | Erfolgreich nach Wiederholung ohne Sandbox; SSR-Verträge bestanden. Kein Website-Server gestartet. |
| Bestehende Linux-CI, erster Durchlauf | Installation, Audit, Lint, Typprüfung, vollständige Unit-Tests, Datenbankregeln, Build, SSR und SEO bestanden. Browserprüfung scheiterte an einem zu breiten Dialog-Locator im neuen Test. |
| Desktop-/Mobilbilder und Video-Tastaturprüfung | Video-Locator auf den benannten Videodialog begrenzt; erneute Prüfung im bestehenden Linux-CI-Job ausstehend. |
| Live-Domain | Referenz geprüft, neue Version nicht veröffentlicht. |

## Trennung der Nachweise

Die Bilder und isolierten Abläufe der neuen Version werden nur auf dem
bestehenden Linux-GitHub-CI-Runner erstellt. Lokal sind ausschließlich
Dateien, Compiler und Tests ohne Website-Server ausgeführt worden.
Eine grüne CI wird nicht als IONOS-Veröffentlichung bezeichnet.
