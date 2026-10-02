# SEO-Fertigstellung – 2. Oktober 2026

Geprüft im getrennten Clone auf Basis von `9ec3b63f08a90d72ced674ecf6844b9475a3d576`. Diese Änderungen sind lokal umgesetzt; dieser Nachweis belegt keine Veröffentlichung.

| Auditpunkt | Ergebnis und Nachweis |
| --- | --- |
| 3 – Suchvariante Autoaufbereitung | Auf `/leistungen` in Meta-Beschreibung und Einleitung ergänzt. Auf `/leistungen/fahrzeugaufbereitung` in Metatitel, Beschreibung und vorhandenen Einleitungssatz aufgenommen. Fahrzeugaufbereitung bleibt im H1 und in der Navigation. Dateien: `src/routes/leistungen.index.tsx`, `src/data/site.ts`. |
| 8 – Eine Suchintention je Leistungsseite | Bereits vorhanden: `src/lib/seo-intents.ts` ordnet jeder indexierbaren URL einen eigenen primären Themencluster und Zweck zu. Der vorhandene Test bestätigt 48 unterschiedliche Zuordnungen; das ist keine Aussage über Nachfrage oder Google-Rankings. Kein zusätzlicher Umbau nötig. |
| 11 – Service und Breadcrumb | Service- und Breadcrumb-JSON-LD bereits auf den Leistungsdetailseiten und Ortsvarianten vorhanden. Die Leistungsübersicht erhielt ein zusätzliches BreadcrumbList passend zu ihrer sichtbaren Navigation; Ausgabe nutzt die vorhandene sichere JSON-LD-Serialisierung. |
| 11 – Video | Kein VideoObject im aktuellen Quelltext. Die vorhandenen Videodaten enthalten kein belegtes Datum der ersten Veröffentlichung. Google führt `uploadDate` als Pflichtfeld. Eine Erstveröffentlichung ist nicht aus Dateimtime, Git-Commit oder heutigem Datum ableitbar. Für vollständige Videostrukturdaten bleibt das echte Veröffentlichungsdatum je Video nötig. |
| 15 – Sitemap und lastmod | Bereits umgesetzt: veröffentlichte CMS-Artikel erhalten in `src/lib/sitemap.ts` `updated_at`, ersatzweise `created_at`; ungültige/fehlende Werte werden weggelassen. Statische Seiten haben keine belegten Änderungsdaten und erhalten daher weiterhin kein lastmod. `src/lib/sitemap.server.ts` begrenzt CMS-Wartezeit, teilt laufende Abfragen und liefert bei Fehlern die statische Sitemap. Der Indexierungsfilter lässt 48 statische URLs zu. |
| 17 – CSP | Bereits vorhanden: `server/security-headers.ts` liefert außerhalb der gerahmten Vorschau eine strengere Report-Only-Policy ohne `unsafe-eval` und `wasm-unsafe-eval`. Die durchsetzende Policy enthält diese Freigaben weiterhin. Eine Umstellung erfordert zuerst Beobachtung der produktiven Buchung, Authentifizierung und Medien; die Header wurden hier nicht geändert. |

## Prüfung ohne Website-Server

- `node --experimental-strip-types --test src/lib/seo-policy.test.ts src/lib/seo-intents.test.ts src/lib/sitemap.test.ts src/lib/json-ld.test.ts`: 17 Tests bestanden.
- `npx eslint src/routes/leistungen.index.tsx src/data/site.ts --max-warnings=0`: bestanden.
- `git diff --check`: bestanden.
- Separat angefragter vorhandener `src/lib/city-seo.test.ts`: startet unter dem Node-Testlauf nicht, weil er `@/data`-Aliase verwendet. Er ist nicht Bestandteil des bestehenden `npm test`-Befehls. Keine Änderung an diesem Test.
- Direkte Live-Abrufe von Homepage, Leistungsseiten und Sitemap scheiterten in diesem Teilauftrag an einem TLS-Authentifizierungsfehler des HTTP-Clients; Web Reader lieferte für die geprüfte Leistungsseite/Sitemap `Internal Error`. Daraus folgt keine Aussage zur Erreichbarkeit der Website. Liveprüfung wird im Hauptauftrag gesondert dokumentiert.

## Fachquellen

Google verlangt für VideoObject unter anderem das echte Erstveröffentlichungsdatum: [Google Search Central – Video-Strukturdaten](https://developers.google.com/search/docs/appearance/structured-data/video).

Google nutzt lastmod bei konsistent verifizierbaren Angaben über bedeutende Seitenänderungen: [Google Search Central – Sitemap erstellen](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
