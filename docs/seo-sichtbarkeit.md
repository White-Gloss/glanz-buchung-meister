# Sichtbarkeit in Google-Suche und Google Maps – Arbeitsstand

Stand: 17. Oktober 2026. Umsetzung des Arbeitsplans „Suchmaschinen-Aufgaben
für White-Gloss Detailing“ auf Basis der Rankingdaten vom 16. bis 17. Oktober
2026. Der Plan und diese Umsetzung versprechen keine bestimmten Platzierungen:
Suchergebnisse hängen unter anderem vom Suchbegriff und vom Standort der
suchenden Person ab.

## 1 – Ausgangslage

Abgerufener Zeitraum: 16.–17.10.2026. Organische Suche und Google Maps getrennt.

| Suchbegriff                         | Organisch | Maps | Hinweis                                       |
| ----------------------------------- | --------: | ---: | --------------------------------------------- |
| fahrzeugaufbereitung horb am neckar |         1 |    2 | starkes Ergebnis für genau diesen Begriff     |
| autoaufbereitung                    |         – |    – | im Zeitraum keine Platzierung verfügbar       |
| die übrigen zwölf Begriffe          |         – |    – | keine Positionen im abgerufenen Datenausschnitt |

„–“ heißt: Für diesen Begriff wurde im abgerufenen Datensatz keine Position
ausgewiesen. Das ist kein Rangplatz „ganz hinten“ und auch kein Beleg, dass die
Website dort gar nicht erscheint.

## 2 – Zuordnung Suchbegriff → Seite

Jede Seite hat genau einen Hauptbegriff; verwandte Begriffe stehen natürlich im
Text. Maßgeblich ist [`src/data/search-watchlist.ts`](../src/data/search-watchlist.ts).
Der Test [`src/lib/search-watchlist.test.ts`](../src/lib/search-watchlist.test.ts)
läuft mit `npm test` und prüft, dass

- jeder der 14 Begriffe genau einer indexierbaren Seite gehört,
- der Hauptbegriff im Title oder in der Description seiner Seite steht,
- verwandte Begriffe im sichtbaren Text der Seite vorkommen,
- kein Begriff mehr als viermal im Text seiner Leistungs- oder Ortsseite steht.

| Thema                     | Hauptbegriff                        | Verwandte Begriffe   | Seite                               |
| ------------------------- | ----------------------------------- | -------------------- | ----------------------------------- |
| Lokale Suche Horb         | fahrzeugaufbereitung horb am neckar | fahrzeugaufbereitung | `/`                                 |
| Fahrzeugaufbereitung      | autoaufbereitung                    | detailing            | `/leistungen/fahrzeugaufbereitung`  |
| Pflege von Fahrzeugen     | autopflege                          | kfz pflege           | `/leistungen`                       |
| Lackpflege und Politur    | auto polieren                       | lackaufbereitung     | `/leistungen/lackkorrektur`         |
| Keramik- und Lackschutz   | keramikversiegelung auto            | lackversiegelung auto | `/leistungen/keramikversiegelung`  |
| Innenraum                 | innenraumreinigung auto             | auto innenreinigung  | `/leistungen/innenraumreinigung`    |
| Leasingrückläufer         | leasing rückläufer reinigen         | –                    | `/leistungen/leasingrueckgabe`      |
| Lokale Suche Reutlingen   | fahrzeugaufbereitung reutlingen     | –                    | `/abholservice/reutlingen`          |

Reutlingen ist ein Abholgebiet. Die Seite sagt ausdrücklich, dass dort keine
Niederlassung und keine mobile Aufbereitung besteht und die Arbeit in Horb
erfolgt.

## 3 – Änderungen vom 17. Oktober 2026

Damit sich spätere Veränderungen einer Ursache zuordnen lassen:

| Seite                              | Änderung                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/leistungen/fahrzeugaufbereitung` | Absatz zu den Bereichen der Aufbereitung (mit „Detailing“), Abschnitte Geeignet für, Ergebnis, Vorab-Hinweise, Anfrage. Title/Description unverändert. |
| `/leistungen/innenraumreinigung`   | Bearbeitete Innenraumbereiche („Auto-Innenreinigung“), Angaben bei stärkerer Verschmutzung, weitere Abschnitte. Title/Description unverändert.     |
| `/leistungen/lackkorrektur`        | Title „Lackkorrektur & Auto polieren in Horb“, Description mit „Lackaufbereitung“, behandelbare Lackmängel und Grenzen der Politur.               |
| `/leistungen/keramikversiegelung`  | Vergleich Sprühversiegelung, Wachs und Keramik („Lackversiegelung im Vergleich“), Ergebnis ohne Laufzeitversprechen. Title/Description unverändert. |
| `/leistungen/leasingrueckgabe`     | Description „Leasingrückläufer reinigen und aufbereiten …“, angebotene Arbeiten, Anfrage vor der Rückgabe.                                       |
| `/leistungen`                      | Description „Autopflege und Kfz-Pflege …“, Einleitung mit Link zu den Geschäftskunden.                                                          |
| alle buchbaren Leistungsseiten     | Kasten „So fragen Sie an“: Fahrzeugmodell, gewünschte Leistung, Fotos; Anfrage- und Telefonlink.                                                 |
| seitenweit                         | Firmenname „White-Gloss Detailing“ wie im Unternehmensprofil; strukturierte Daten mit `alternateName` „White Gloss“.                            |

Bewusst unverändert: Title und Description der Startseite (Platz 1 organisch)
und die Stadtseiten einschließlich Reutlingen.

## 4 – Lokale Angaben

Überall genau diese Angaben verwenden:

```
White-Gloss Detailing
Arnistal 27, 72160 Horb am Neckar
+4915233540284 (Anzeige auf der Website: 0152 33540284)
info@white-gloss.de
https://white-gloss.de
```

Geprüft am 17.10.2026: Website, Impressum, Fußzeile, Kontaktseite und
strukturierte Daten nennen dieselbe Adresse, Telefonnummer und E-Mail. Die alte
Domain `whitegloss.de` erscheint auf der Website nicht mehr. Der Firmenname
lautete auf der Website bisher „White Gloss Detailing“; im Unternehmensprofil
steht „White-Gloss Detailing“. Die Website ist jetzt angeglichen, nicht das
Profil, damit am gut platzierten Maps-Eintrag nichts geändert werden muss.

Einzugsgebiet: Die Website führt 19 Abholorte. Jede Ortsseite erklärt die
angebotenen Leistungen, die Übergabe und dass gearbeitet wird ausschließlich in
der Werkstatt in Horb. Ein Unternehmensprofil fasst bis zu 20 Servicegebiete;
dort dieselben 19 Orte führen (Liste in
[`google-unternehmensprofil-ausfuellen.md`](google-unternehmensprofil-ausfuellen.md)).

## 5 – Unternehmensprofil: Aufgaben für den Inhaber

Das Profil lässt sich nicht aus dem Code pflegen. Das Ausfüllblatt
[`google-unternehmensprofil-ausfuellen.md`](google-unternehmensprofil-ausfuellen.md)
ist auf den Website-Stand vom 17.10.2026 gebracht. Offen sind:

1. **Name nicht ändern.** „White-Gloss Detailing“ bleibt; die Website folgt ihm.
2. **Servicegebiete** auf die 19 Abholorte der Website bringen.
3. **Leistungen prüfen:** „Scheinwerfer-Aufbereitung“ entfernen, falls
   eingetragen; die Website führt sie derzeit als nicht buchbar. Keine Texte mit
   „Desinfektion“, „jahrelang“ oder anderen Versprechen, die die Website nicht
   macht.
4. **Produkte** mit den Paketnamen der Website: Basisreinigung, Reinigung &
   Politur, Keramikschutz. Alte Namen wie „Basis Pflege“, „Premium Glanz“ oder
   „High-End Keramik“ ersetzen.
5. **Öffnungszeiten** wie auf der Website: Montag bis Freitag 09:00–17:00 Uhr,
   Samstag und Sonntag geschlossen.
6. **Fotos:** eigene, aktuelle Bilder; Kennzeichen unkenntlich, Personen nur
   mit Einverständnis. Die 19 Kundenfotos der Website wurden am 17.10.2026
   durchgesehen: Kennzeichen sind abgedeckt oder nicht lesbar. Auf
   `customer-02` steht am linken Bildrand eine Person – Einverständnis
   bestätigen oder das Bild zuschneiden.
7. **Verzeichniseinträge** (Das Örtliche, Gelbe Seiten usw.), die noch mit
   „White Gloss Detailing“ angelegt wurden, auf „White-Gloss Detailing“
   angleichen.

## 6 – Regelmäßige Kontrolle

Alle vier Wochen dieselben 14 Begriffe abrufen und unten eintragen. Dabei gilt:

- Organische Suche und Maps getrennt betrachten; eine gute Position in der einen
  bedeutet nicht dieselbe in der anderen.
- Immer den exakten Suchbegriff und den ausgewiesenen Zeitraum notieren.
- Eine fehlende Position ist keine schlechte Position, sondern fehlende Daten.
- Nach einer Änderung vier bis acht Wochen warten, bevor sie bewertet wird.
- Nicht mehrere Seiten zum selben Thema gleichzeitig ändern. Neue Änderungen
  in Abschnitt 3 mit Datum nachtragen.
- Verschlechtert sich ein Begriff, zuerst die zugeordnete Seite aus Abschnitt 2
  prüfen: verständlich, aktuell, Kontaktmöglichkeit sichtbar? Ist ein Begriff
  gut platziert, die Seite und die lokalen Angaben aktuell halten.
- Ergänzend in der Search Console prüfen, welche Seite zu welcher Suchanfrage
  Impressionen erhält.

### Verlauf

| Abruf      | Zeitraum      | Suchbegriff                         | Organisch | Maps | Veränderung | Notiz                                   |
| ---------- | ------------- | ----------------------------------- | --------: | ---: | ----------- | --------------------------------------- |
| 17.10.2026 | 16.–17.10.2026 | fahrzeugaufbereitung horb am neckar |         1 |    2 | Ausgangswert |                                         |
| 17.10.2026 | 16.–17.10.2026 | autoaufbereitung                    |         – |    – | Ausgangswert | keine Platzierung verfügbar             |
| 17.10.2026 | 16.–17.10.2026 | übrige zwölf Begriffe               |         – |    – | Ausgangswert | nicht im abgerufenen Datenausschnitt    |

Nächster sinnvoller Abruf: frühestens Mitte November 2026, vier Wochen nach
Veröffentlichung der Änderungen aus Abschnitt 3. Für eine Bewertung aller
Begriffe werden vollständige aktuelle Rankingdaten benötigt.

## 7 – Reihenfolge und Stand

| Schritt                                   | Stand 17.10.2026                                                    |
| ----------------------------------------- | ------------------------------------------------------------------- |
| 1. Kontakt- und Standortangaben abgleichen | Website erledigt; Profil und Verzeichnisse: Abschnitt 5            |
| 2. Leistungsseiten prüfen                  | erledigt (fünf Kernleistungen, siehe Abschnitt 3)                   |
| 3. Suchbegriffe zuordnen                   | erledigt; Zuordnung im Code, durch Test abgesichert                 |
| 4. Lokale Aussagen prüfen                  | erledigt; Horb als einziger Standort, 19 Abholgebiete               |
| 5. Kontaktaufnahme vereinfachen            | erledigt; Anfragekasten auf jeder buchbaren Leistungsseite          |
| 6. Suchergebnisse erneut auswerten         | offen; nächster Abruf frühestens Mitte November 2026 (Abschnitt 6)  |
