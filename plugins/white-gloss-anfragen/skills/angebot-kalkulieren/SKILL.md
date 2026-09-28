---
name: angebot-kalkulieren
description: Berechnet für White Gloss Detailing (Fahrzeugaufbereitung in Horb am Neckar) den voraussichtlichen Preis einer Anfrage genau wie der Online-Rechner auf white-gloss.de – Paket mal Fahrzeugklasse, Extras und Hol- und Bringservice – und listet die Positionen für den Auftrag in Bitrix24 auf. Verwenden, wenn Lars wissen will, was eine Aufbereitung kostet, oder einen Richtpreis, ein Angebot oder einen Kostenvoranschlag berechnen lassen möchte („was kostet Keramik beim SUV aus Tübingen“, „rechne mir das Angebot“, „Positionen für Bitrix“), und immer, wenn ein Antwortentwurf einen Preis braucht. Das Ergebnis ist stets ein unverbindlicher Richtpreis.
argument-hint: "[Paket, Fahrzeug oder Klasse, Extras, Abholort oder km]"
---

# Richtpreis berechnen

Rechne nie aus dem Gedächtnis. Grundlage sind zwei Dateien im Ordner dieses Skills (Basisverzeichnis, das beim Laden des Skills angezeigt wird):

- `references/website-daten.json` – Pakete, Fahrzeugklassen, Extras, Abholstaffel, Orte, Leistungsseiten und FAQ, automatisch aus dem Website-Code erzeugt. Nie von Hand ändern.
- `scripts/angebot.mjs` – rechnet exakt wie der Online-Rechner der Website und schreibt Beträge wie die Website.

## 1. Angaben zuordnen

| Angabe         | Zuordnung                                                                                                                                                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paket          | `basis`, `premium` oder `keramik`. Das Skript versteht auch die sichtbaren Namen (Basisreinigung, Reinigung & Politur, Keramikschutz) und alte Bezeichnungen (Pur, Signature, Premium Glanz, High-End Keramik). Will der Kunde nur einzelne Leistungen, ohne `--paket` rechnen.           |
| Fahrzeugklasse | Nach Länge und Art des Fahrzeugs gemäß `hint` der Klassen: `kompakt`, `suv` oder `transporter`. Liegt das Modell nahe an einer Grenze oder ist es eine lange Limousine, beide Klassen rechnen und als Grenzfall markieren – die Website sagt „Grenzfälle klären wir vor Auftragsannahme“. |
| Extras         | IDs oder Namen aus `--liste`. Nur, was der Kunde nennt oder Lars vorgibt – nichts dazuerfinden.                                                                                                                                                                                           |
| Abholung       | Ort aus der Abholliste (`--ort`) oder Straßenkilometer ab der Werkstatt in Horb (`--km`). Ohne Angabe gilt Selbstanlieferung. Entfernungen nur schätzen, wenn es nicht anders geht, und dann als Annahme kennzeichnen.                                                                    |

Fehlt eine Angabe, triff eine sichtbar markierte Annahme oder frage nach. Nie stillschweigend raten.

## 2. Rechnen

`<skill>` steht für das Basisverzeichnis dieses Skills:

```bash
node "<skill>/scripts/angebot.mjs" --paket keramik --klasse suv --extras ozon,tierhaar --ort Tübingen
node "<skill>/scripts/angebot.mjs" --paket basis --klasse kompakt --km 18 --json
node "<skill>/scripts/angebot.mjs" --liste
```

Exit-Code 2 bedeutet eine unbekannte Angabe; die Meldung nennt die gültigen Werte. Eingabe korrigieren, nicht umgehen.

Läuft Node nicht, dieselbe Rechnung von Hand mit den Werten aus der JSON-Datei durchführen und den Rechenweg zeigen:

1. Jede Position = Grundpreis × Klassenfaktor, auf Cent gerundet. Positionen sind das Paket und jedes gewählte Extra. Steht ein Extra für das gewählte Paket in `includedExtras`, kostet es 0 €. Extras mit `requestable: false` werden nicht berechnet.
2. Abholung ohne Klassenfaktor: Im Paket `pickup.freeWithPackageId` bis `pickup.freeUpToKm` km 0 €. Sonst gilt die erste Stufe in `pickup.tiers`, deren `maxKm` die Entfernung erreicht. Liegt die Entfernung darüber, ist die Abholung „auf Anfrage“: nicht im Betrag, als offen kennzeichnen.
3. Richtpreis = Summe aller Positionen. Beträge wie auf der Website schreiben, z. B. `1.123,75 €`, ganze Beträge ohne Cent, z. B. `349 €`.

## 3. Ergebnis darstellen

1. **Richtpreis** mit dem Zusatz „voraussichtlich“ und `vatNote` (inkl. MwSt.).
2. Die Positionstabelle aus dem Skript.
3. **Annahmen und offene Punkte**: geschätzte Klasse oder Entfernung, fehlende Angaben, Positionen „nach Prüfung“, Abholung auf Anfrage, Grenzfälle.
4. Auf Wunsch **Positionen für Bitrix24**: Name und Betrag je Position. Das entspricht dem, was die Website beim Anlegen einer Anfrage überträgt: Paket und Extras mit Klassenfaktor, Abholung als „Hol- und Bringservice“. Verbindlich wird es erst, wenn Lars nach Sichtung der Fotos bzw. Begutachtung Preis und Zeitraum im Leitstand freigibt.

Formulierungen: „voraussichtlich“, „Richtpreis“, „ab“. Nie „Festpreis“, „verbindlich“ oder „garantiert“ und keine Rabatte – über Preisnachlässe entscheidet nur Lars.

## Kein Online-Richtpreis

In diesen Fällen nicht rechnen, sondern den passenden Hinweis geben:

- **Luxus-, Sport- und Sammlerfahrzeuge** (etwa ab 80.000 € Fahrzeugwert): laut Website nicht über den Online-Rechner. Erst Telefonat, dann Angebot nach Begutachtung.
- **Geschäftskunden, Flotten, Autohäuser, mehrere Leasingfahrzeuge**: individuelle Kalkulation durch Lars nach Anzahl, Zustand und Logistik.
- **Dellenentfernung / Smart Repair**: Preis und Zusage erst nach Begutachtung. Bei kleinen Stellen reicht oft ein Foto für eine erste Einschätzung.
- **Lederreparatur**: Preise je Stelle aus `services` → `lederreparatur` → `priceRows`, erst nach Materialprüfung.
- **Scheinwerferaufbereitung**: derzeit nicht buchbar (`pendingApproval`).
- **Leasingrückgabe**: Einstiegspreis `fromPrice` der Leistungsseite, der Umfang wird individuell abgestimmt.

## Wenn Daten nicht passen

Nennt der Kunde einen anderen Preis (älteres Angebot, alter Aushang), nicht angleichen: beide Werte nennen und Lars entscheiden lassen. Wirken die Daten veraltet, das Plugin nicht selbst ändern. Die Datei wird aus dem Website-Code neu erzeugt; das Vorgehen steht in der README des Plugins.
