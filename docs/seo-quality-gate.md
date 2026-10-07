# SEO-Qualitätsgate – ergänzt am 7. Oktober 2026

## Verbindlicher Stand

Eine Werkstatt: Arnistal 27, 72160 Horb am Neckar. Andere Städte sind Abholgebiete.
Keine neuen Standort-, Bewertungs-, Leistungs- oder Haltbarkeitsbehauptungen.
Preise, Buchungsauswahl, Uploads und Backend-Integrationen bleiben bestehen.
Lokales Website-Hosting ist ausdrücklich verboten. Lint, Typprüfung, Unit-Tests
und Builds starten keinen Website-Server. SSR-/Formular-/Viewport-Prüfungen
laufen ausschließlich im bereits isolierten Linux-GitHub-CI-Job.

## Eine Quelle für Indexierung

`src/lib/seo-policy.ts` steuert SSR-Robots, Sitemap, Matrix-Routing und interne Links.
`sitemap-static.xml` bleibt das vollständige URL-Inventar, nicht die auszuliefernde
Sitemap. Die Route filtert es vor der CMS-Ergänzung und auch für den CMS-Ausfall.

| Gruppe | URLs | HTTP / Indexierung |
| --- | ---: | --- |
| Öffentliche Hubs, Leistungsseiten, Ratgeber, Abholgebiete | 54 | 200, index, Self-Canonical, Sitemap |
| Angebotene Leistung × Stadt ohne vollständigen Nachweis | 171 | 200, noindex,follow, Self-Canonical, keine Sitemap |
| Scheinwerferaufbereitung × Stadt, aktuell nicht angeboten | 19 | 301 zur zentralen Erläuterung, keine Sitemap |
| Zentrale Scheinwerfer-Erläuterung und sechs rechtliche Hilfsseiten | 7 | 200, noindex,follow, Self-Canonical, keine Sitemap |

Das ist eine bewusste Verringerung indexierbarer Duplikate, keine Zusage steigender
Rankings. Kurzfristige Rückgänge sind möglich. Fehlende Belege bedeuten nicht
nachgewiesene Abwesenheit von Nachfrage. Der derzeit leere Nachweiskatalog ist
deshalb ausdrücklich ein offener Prüfstatus.

## Matrixseiten freigeben

Vor einem `localSeoEvidence`-Eintrag müssen nachweislich vorliegen:

1. Tatsächliche Verfügbarkeit der Leistung für diesen Abholort.
2. GSC-Impressionen für genau den Leistung-/Ortsintent ODER bestätigtes Suchvolumen,
   mit Suchanfrage, Zeitraum und prüfbarer Quellenreferenz. Allgemeine Nachfrage
   nach Keramikversiegelung oder nach einer Stadt genügt nicht.
3. Mindestens zwei verschiedene belegte ortsspezifische Betriebsinformationen.
4. Ein echter, veröffentlichbarer Ortsnachweis (Auftrag, Foto oder unveränderte
   echte Bewertung), datenschutzgerecht, mit HTTPS-Nachweislink.
5. Inhaltliche Einzelprüfung, eindeutiger Suchintent in `seoIntents`, Prüfung
   gegen konkurrierende Hub-/Ratgeberseiten und bestandene CI.

Die Fakten und der Nachweislink werden auf der freigegebenen Seite sichtbar.
Keine privaten Kundendaten oder internen Auftragsnummern in clientseitige Dateien
eintragen. Der Code prüft Vollständigkeit, nicht Wahrheit; die Quellenprüfung
bleibt eine menschlich nachvollziehbare redaktionelle Freigabe.

Die Mindestbelege sind unsere Qualitätsregel, keine von Google vorgeschriebene
Zahl. Google garantiert weder Indexierung noch Rankings oder Rich Results.

## Dauerhaftes Redirect-Verzeichnis

Für jeden der 19 Slugs aus `cities` gilt:
`/leistungen/scheinwerferaufbereitung/{stadt}` → 301 →
`/leistungen/scheinwerferaufbereitung` (200, noindex).
Grund: Leistung derzeit nicht angeboten; eine einzige Erläuterung hat mehr Nutzen
als einzelne Ortsvarianten. Kein Redirect auf die Startseite, keine Kette, keine Änderung
anderer Leistungs-URLs. Bei Änderungen an Ziel oder Verfügbarkeit Register und
Tests gemeinsam aktualisieren. Weitere Konsolidierungen benötigen Einzelbelege.

## Suchintents und interne Links

`src/lib/seo-intents.ts` erfasst alle 54 indexierbaren statischen Seiten. Der Test
verhindert fehlende Zuordnungen und identische Primärcluster. Er ersetzt keine
GSC-Query/Seiten-Analyse: verschiedene Formulierungen können trotzdem denselben
Intent haben. Der Crawl bezieht auch veröffentlichte CMS-Artikel ein: ein
redaktionell freigegebener Override kann in `cmsSeoIntents` stehen; sonst dient
der im CMS veröffentlichte Titel als vorläufiges Informations-Cluster. Leere
Zuordnungen und identische Cluster werden abgelehnt. Das ist kein Suchvolumen-
Nachweis: CMS-Neuveröffentlichungen zusätzlich semantisch/redaktionell prüfen.

Homepage: Anbieter in Horb; Leistungsindex: Auswahl; einzelne Leistung: Umfang
und Anfrage; Stadt-Hub: Fahrzeugaufbereitung + Stadt mit Abholung und Übergabe; Preise: Paketvergleich; Ratgeber:
abgegrenzte Wissensfrage. Der Foto-Anfrageweg für Dellen wird bewusst von der
Leistungsbeschreibung getrennt. Nichtindexierbare Matrixseiten sind keine
seitenweiten Navigationsziele mehr. URLs und direkte Buchungswege bleiben nutzbar.

Die 18 auswärtigen Stadt-Hubs tragen „Fahrzeugaufbereitung + Stadt“ im Title
und internen Linktext; H1, Beschreibung, Leistungsübersicht und echte Ablauf-/
Preis-FAQs verbinden die Aufbereitung mit dem jeweiligen Abholgebiet. Beispiel:
`/abholservice/nagold` ist das indexierbare Ziel für „Fahrzeugaufbereitung Nagold“.
Der Horber Hub konzentriert sich auf Abholung; der allgemeine Horber Anbieter-
Intent gehört der Homepage. Ein URL-Pfad mit „abholservice“ verhindert diese
inhaltliche Ausrichtung nicht. Keine zusätzliche gleichgerichtete Matrix-URL
freigeben, ohne den bestehenden Hub-Intent dabei zu berücksichtigen.

Das echte Google-Unternehmensprofil wurde am 27.09.2026 geprüft: Der öffentliche
Beitrag zum Hol-/Bringservice bestätigt die Abholgebiete. Die neun sichtbaren
Bewertungen enthalten keinen konkreten Bezug zu einer auswärtigen Stadt und
Leistung. Allgemeines Kundenlob wird keinem Abholort zugeschrieben. Das ist
kein Grund, die Stadt-Hubs auszuschließen, aber kein vollständiger Nachweis für
zusätzliche Matrixseiten nach dem oben vereinbarten Qualitäts-Gate.

## Prüfen und veröffentlichen

- Lokal ohne Server: `npm run lint`, `npm run typecheck`, `npm test`,
  `node --test src/lib/seo-policy.test.ts src/lib/seo-intents.test.ts`, `npm run build`.
- CI: vorhandene isolierte Buchungs-/Upload-/Integrationsprüfungen plus Crawl
  aller 251 Inventar-URLs und veröffentlichter CMS-Artikel. Status, Canonical,
  Robots, Title, Description, H1, JSON-LD, Sitemap, Eingangslinks und Ortsangaben.
- Ähnlichkeit: 5-Wort-Shingle-Jaccard als Diagnose, kein angeblicher Rankingwert.
  Nicht indexierbare Matrixduplikate bleiben bewusst sichtbar im Bericht.
- Nur nach erfolgreicher CI und Diff-Prüfung nach main. Das vorhandene
  `Deploy IONOS`-Workflow veröffentlicht nach erfolgreicher Main-CI mit
  bestehendem Smoke-Test/Rollback. Keine alternativen Deploy-Wege.
- Nach Deployment: `node scripts/qa/check-seo.mjs --live` ist ein rein lesender
  HTTPS-Crawl der veröffentlichten Domain, kein lokaler Server. Niemals echte
  Anfragen, Nachrichten oder Uploads für Smoke-Tests auslösen.
- Schema-Tests sind keine Google-Rich-Results-Zertifizierung. Öffentliche URLs
  zusätzlich mit Google Rich Results / Schema.org prüfen; nicht jede Service-
  Auszeichnung hat Anspruch auf eine Google-Sonderdarstellung.

## Messung und offene externe Nachweise

GSC ist direkt im Eigentümerkonto erreichbar; ein Drittanbieter-Connector
muss dafür nicht zusätzlich autorisiert werden. Der vollständige verfügbare
Query-/Seiten-Export, Nicht-Marken-Export, Indexierungsreport und die Liste der
indexierten URLs wurden am 27.09.2026 lokal außerhalb des öffentlichen Repos
gesichert. Query-Seiten-Paare bei der Einzelprüfung zusätzlich auswerten. Ein
sichtbarer Tabellenausschnitt darf nicht als vollständiger Export gelten.
Anonymisierte Suchanfragen verhindern eine vollständige Markenaufteilung.
GSC liefert keine Buchungs-Conversions; hierfür bestehende, consent-konforme
Analytics-Daten verwenden. Keine neuen Tracking-Systeme ohne gesonderten Auftrag.

14/28/90 Tage nach Veröffentlichung: Qualitätsseiten im Index, Nicht-Marken-
Impressionen/Klicks (Markenfilter dokumentieren), CTR, relevante Query-Seiten-
Paare und Top-10-Anteil sowie vorhandene organische Buchungs-/Kontakt-Conversions.
Vergleichsfenster, Datenlücken, Saison und geänderten URL-Bestand offenlegen.
Seiten mit Impressionen ohne Klicks auf Suchintent/Snippet prüfen. Seiten ohne
belastbare lokale Belege nicht allein wegen eines Kalendertermins freigeben.

Core Web Vitals: LCP ≤ 2,5 s, INP < 200 ms, CLS < 0,1 anstreben. GSC meldete
am 27.09.2026 nicht genügend Felddaten. Labormessungen und TBT sind kein Nachweis
für bestandenes Feld-INP. Bestehende responsive AVIF-Bilder, Hero-Priorität,
lokale Fonts, verzögertes Video und Cache-Regeln erhalten und Regressionen prüfen.

## Quellen

Die sechs zusätzlichen Abholgebiete vom 07.10.2026 sowie ihre Quellen und die
noch offene Freigabe von Leistungs-Ortsseiten sind in
[`ortsseiten-2026-10-07.md`](ortsseiten-2026-10-07.md) dokumentiert. Die Zahlen
oben beschreiben den Codebestand; ein Live-Nachweis muss zum Release gehören.

- https://developers.google.com/search/docs/essentials/spam-policies
- https://developers.google.com/search/docs/crawling-indexing/block-indexing
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/appearance/structured-data/local-business
- https://developers.google.com/search/docs/appearance/core-web-vitals

Ein gewöhnliches Suchergebnis belegt weder Suchvolumen noch echte lokale
Referenzen. Wettbewerberdaten dienen der Intent-Prüfung, nicht als Textvorlage.
