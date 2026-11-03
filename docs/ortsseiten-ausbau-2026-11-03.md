# Ortsseiten ausbauen – Stand 3. November 2026

Ziel: Die 19 Abholgebiet-Seiten (`/abholservice/{ort}`) sollen sich durch
**echte Ortsangaben** unterscheiden, nicht durch umformulierte Texte.
Keine Rankingzusage. Keine neuen Matrixseiten.

## 1 – Ausgangslage

### Textähnlichkeit

Gemessen aus dem Quellcode mit derselben Methode wie die CI
(`scripts/qa/check-seo.mjs`: 5-Wort-Shingles, Jaccard). Der Ortsname wurde
ausgeblendet, damit nur der Rest des Textes verglichen wird. Navigation und
Fußzeile sind nicht enthalten; auf der echten Seite liegt die Ähnlichkeit
daher eher höher.

| Kennzahl                               | Wert                          |
| -------------------------------------- | ----------------------------- |
| Seitenpaare                            | 171                           |
| Durchschnittliche Ähnlichkeit          | 76 %                          |
| Höchster Wert                          | 90 % (Böblingen ↔ Reutlingen) |
| Paare über 70 %                        | 134                           |
| Ortsspezifische Wörter je Seite        | 10 (Calw) bis 57 (Sulz)       |
| Wörter je Seite insgesamt              | rund 570–630                  |

Ortsspezifisch sind heute nur `blurb` und `pickupNote` in `src/data/site.ts`.
Der Rest ist Vorlage. Das entspricht dem Muster, das Google in den
Spam-Richtlinien als Doorway-Missbrauch beschreibt:
https://developers.google.com/search/docs/essentials/spam-policies#doorway-abuse

Umschreiben, Synonyme oder automatisch erzeugte Varianten lösen das nicht. Sie
fallen unter „Scaled content abuse“ derselben Richtlinie und können der
gesamten Website schaden. Nur echte, nachprüfbare Angaben schaffen Mehrwert.

### Search Console (Eigenschaft `https://white-gloss.de/`)

Zeitraum laut Bericht: 09.08.–31.10.2026, Websuche, Filter „Seite enthält
/abholservice/“. Abgerufen am 03.11.2026.

| Seite                  | Klicks | Impressionen | Ø Position |
| ---------------------- | -----: | -----------: | ---------: |
| `tuebingen`            |      0 |           33 |       13,2 |
| `horb-am-neckar`       |      1 |           27 |        4,9 |
| `freudenstadt`         |      0 |           23 |        3,1 |
| `reutlingen`           |      0 |           21 |        8,0 |
| `nagold`               |      0 |           21 |       14,2 |
| `oberndorf-am-neckar`  |      0 |           13 |        9,2 |
| `balingen`             |      0 |           12 |        4,2 |
| `rottweil`             |      0 |           12 |        7,2 |
| `boeblingen`           |      0 |            9 |        4,1 |
| `calw`                 |      0 |            4 |       24,8 |

Nicht ausgewiesen: Rottenburg, Herrenberg, Sindelfingen und die sechs am
07.10.2026 ergänzten Orte. Zum Vergleich: gesamte Website 100 Klicks,
1.040 Impressionen.

Ausgewiesene Suchanfragen für diese Seiten: „lackierarbeiten tübingen“ (3),
„firma“ (1), „clean style center aufbereitung reutlingen“ (1),
„fahrzeugaufbereitung nagold“ (1). Die übrigen Anfragen hält Google als
anonymisiert zurück. Fehlende Zeilen sind kein Beleg für fehlende Nachfrage.

**Bewertung:** Die Ortsseiten haben sehr wenig Suchvolumen. Kein Ort rechtfertigt
eine Sonderbehandlung allein aus diesen Zahlen. Die meisten Impressionen haben
Tübingen, Freudenstadt, Reutlingen und Nagold.

## 2 – Was gebaut ist

| Teil                                  | Datei                                   |
| ------------------------------------- | --------------------------------------- |
| Datenmodell für bestätigte Ortsangaben | `src/data/local-proof.ts`              |
| Prüfung (Vollständigkeit, Datenschutz) | `src/lib/local-proof.ts`               |
| Abschnitt „Aus {Ort}“ auf der Ortsseite | `src/components/city-local-proof.tsx` |
| Ortsfragen im FAQ-Block der Ortsseite  | `src/components/city-landing.tsx`      |
| Tests (`npm test`)                     | `src/lib/local-proof.test.ts`          |

- Der Katalog ist **leer**. Ohne Eintrag ändert sich keine Seite. Die geplante
  Rankingauswertung (Mitte November, `seo-sichtbarkeit.md` Abschnitt 6) wird
  dadurch nicht verfälscht.
- Ein Eintrag erzeugt direkt nach dem Seitenkopf einen Abschnitt mit
  Abholtagen, Übergabehinweis und echten Aufträgen (optional mit Foto aus der
  Galerie). Ortsfragen erscheinen zusätzlich im bestehenden FAQ-Block.
- Der Test lehnt ab: unbekannte Orte oder Leistungen, nicht buchbare Leistungen,
  unbekannte Fotos, Daten in der Zukunft, fehlendes Einverständnis, zu kurze
  Texte sowie vermutete Kennzeichen, E-Mail-Adressen, Telefonnummern und
  Straßenangaben.
- Der Test prüft Form und Datenschutz, **nicht die Wahrheit**. Jeder Eintrag
  bleibt eine Bestätigung des Betreibers.
- Der Keyword-Test (`search-watchlist.test.ts`) zählt die neuen Texte mit. Mehr
  als vier Nennungen eines beobachteten Suchbegriffs je Seite schlagen fehl.
- Keine strukturierten Daten für Fragen oder Bewertungen: FAQ-Rich-Results
  zeigt Google seit 2023 nur noch für ausgewählte Behörden- und
  Gesundheitswebsites, und selbst ausgezeichnete Bewertungen des eigenen
  Betriebs („self-serving reviews“) erscheinen nicht als Rich Result.

## 3 – Routenmessung für die sechs Orte ohne Entfernung

Google Maps, 03.11.2026, Start Arnistal 27, 72160 Horb am Neckar, Ziel
Ortsmitte, Auto, vorgeschlagene schnellste Route bei damaliger Verkehrslage.

| Ort            | km   | Min. | Route laut Maps           | Staffel bei diesem Wert |
| -------------- | ---: | ---: | ------------------------- | ----------------------- |
| Empfingen      |  9,8 |   12 | K4762                     | bis 10 km: kostenlos    |
| Schopfloch     | 10,8 |   11 | K4760                     | bis 20 km: 50 €         |
| Sulz am Neckar | 12,0 |   13 | L424, K5509               | bis 20 km: 50 €         |
| Vöhringen      | 16,6 |   19 | L424                      | bis 20 km: 50 €         |
| Dornstetten    | 18,5 |   19 | K4760                     | bis 20 km: 50 €         |
| Dornhan        | 19,3 |   23 | K5508 (Umleitung wegen Sperrung Neunthausen) | bis 20 km: 50 € |

**Nicht übernommen.** `km` und `minutes` bleiben `null`, wie am 07.10.2026
festgelegt. Gründe:

- Ortsmitte ist nicht die Abholadresse. Teilorte (z. B. Wiesenstetten,
  Marschalkenzimmern, Aach, Hallwangen) können über einer Staffelgrenze liegen.
- Empfingen (9,8 km) und Schopfloch (10,8 km) liegen direkt an der 10-km-Grenze,
  Dornhan (19,3 km) und Dornstetten (18,5 km) nahe der 20-km-Grenze.
- Ein eingetragener Wert wird sofort ein verbindlich angezeigter Preis.

Entscheidung des Betreibers: Werte je Ort bestätigen oder bewusst bei
„auf Anfrage“ bleiben.

## 4 – Ausfüllhilfe für den Betreiber

Pro Ort in `src/data/local-proof.ts` eintragen. Nur echte Angaben.

```ts
export const localProof: Partial<Record<string, CityLocalProof>> = {
  tuebingen: {
    confirmedAt: "JJJJ-MM-TT",              // Tag deiner Bestätigung
    pickupDays: "…",                       // nur wenn wirklich so geplant
    handover: "…",                         // z. B. Übergabe am Arbeitsplatz
    references: [
      {
        month: "JJJJ-MM",
        vehicle: "Marke Modell",           // ohne Kennzeichen
        service: "innenraumreinigung",     // Slug aus services
        summary: "Was gemacht wurde und warum, 1–3 Sätze.",
        photoId: "customer-09",            // optional, nur passendes Foto
        consent: true,                     // Kunde hat zugestimmt
      },
    ],
    faqs: [{ question: "Echte Kundenfrage?", answer: "Antwort." }],
  },
};
```

Was einen Ort wirklich stärkt, in dieser Reihenfolge:

1. **Echter Auftrag aus dem Ort** mit Fahrzeug, Leistung und Monat, ideal mit
   Foto (Kennzeichen unkenntlich, Personen nur mit Einverständnis).
2. **Tatsächliche Abholtage** je Region, falls Touren gebündelt werden.
3. **Konkrete Übergabe**, z. B. am Arbeitsplatz, falls angeboten.
4. **Echte Kundenfragen** aus dem Ort mit sachlicher Antwort.
5. **Bestätigte Entfernung** für die sechs offenen Orte (Abschnitt 3).

Nicht eintragen: Namen, Straßen, Kennzeichen, Telefonnummern, erfundene oder
umformulierte Bewertungen, allgemeines Lob ohne Ortsbezug, Haltbarkeits- oder
Ergebnisversprechen.

## 5 – Reihenfolge

1. Rankingauswertung Mitte November abwarten (`seo-sichtbarkeit.md`).
2. Mit höchstens vier Orten beginnen, Vorschlag: Tübingen, Freudenstadt,
   Reutlingen, Nagold (meiste Impressionen).
3. Eintragen → `npm test` → PR → CI → Veröffentlichung über den freigegebenen Weg.
4. Änderung mit Datum in `seo-sichtbarkeit.md` Abschnitt 3 nachtragen.
5. Vier bis acht Wochen warten, dann je Seite in der Search Console vergleichen.
6. Zusätzlich im Google-Unternehmensprofil die 19 Servicegebiete pflegen
   (offen, `seo-sichtbarkeit.md` Abschnitt 5). Für Google Maps wirkt das
   stärker als jede Ortsseite.
