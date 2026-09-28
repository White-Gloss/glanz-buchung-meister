# Tonalität, Aufbau und Bausteine

Werte in `{geschweiften Klammern}` stammen aus `../angebot-kalkulieren/references/website-daten.json` (Pfad relativ zum Basisverzeichnis des Skills; Felder `company`, `openingHours`, `dropOffTimes`, `paymentNote`). `<spitze Klammern>` füllst du aus der Anfrage und dem Richtpreis.

## Grundton

- Freundlich, ruhig, sachlich. Kurze Sätze, klare Wörter; Fachbegriffe nur mit kurzer Erklärung.
- „Wir“ für White Gloss; unterschrieben wird mit Lars' Namen.
- Ehrlich über Grenzen: Nicht jeder Kratzer lässt sich auspolieren, nicht jeder Geruch verschwindet vollständig. Nie mehr versprechen als die Website.
- Keine Superlative und Werbefloskeln („perfekt“, „makellos“, „wie neu“, „100 %“), keine Ausrufezeichenketten, keine Emojis in E-Mails.
- Keine Vergleiche mit anderen Anbietern und keine abwertenden Aussagen über sie.

## Anrede

- Standard ist **Sie**. Duzt der Kunde selbst, antworte mit **du** – so halten es auch die automatischen Eingangsmails von White Gloss.
- Sie: „Guten Tag Frau Berger,“ bzw. „Guten Tag Herr Berger,“ nur, wenn die Anrede eindeutig aus der Nachricht hervorgeht (Signatur, eigene Nennung). Sonst „Guten Tag Anna Berger,“ mit Vor- und Nachnamen, ohne Namen „Guten Tag,“. Das Geschlecht nie aus dem Vornamen ableiten.
- du: „Hallo Anna,“.
- Gruß: „Freundliche Grüße“ (Sie) bzw. „Viele Grüße“ (du).

## Leistungsnamen

Immer die sichtbaren Namen der Website verwenden, nie alte Bezeichnungen:

| Nicht                     | Sondern                    |
| ------------------------- | -------------------------- |
| Pur, Basis Pflege         | Basisreinigung             |
| Signature, Premium Glanz  | Reinigung & Politur        |
| Keramik, High-End Keramik | Keramikschutz              |
| Interior Gloss            | Innenraumreinigung         |
| Ceramic Gloss             | Keramikversiegelung        |
| Lackatelier               | Lackkorrektur              |
| Air Pure                  | Geruchsbehandlung mit Ozon |
| Lichtklar                 | Scheinwerferaufbereitung   |
| Engine Finish             | Motorraumreinigung         |
| Soft Top Care             | Cabrioverdeckpflege        |
| Private Client            | Luxusfahrzeuge             |
| B2B                       | Geschäftskunden            |

## Wortwahl

| Nicht                                 | Sondern                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Festpreis, verbindlich, garantiert    | voraussichtlich, Richtpreis                                                              |
| Ihr Termin ist bestätigt / reserviert | Wir prüfen Ihren Wunschtermin und melden uns                                             |
| wie neu, makellos, perfekt            | gepflegt, gleichmäßiger Glanz, deutlich reduziert                                        |
| kratzfest, hält X Jahre               | erleichtert die Pflege; die Standzeit hängt von Beschichtung, Nutzung und Pflege ab      |
| Anzahlung                             | `{paymentNote}`                                                                          |
| Wir kommen zu Ihnen                   | Die Aufbereitung erfolgt in unserer Werkstatt in Horb am Neckar; Abholung nach Absprache |

## Aufbau einer E-Mail

1. **Betreff:** bei Antworten „Re: <Originalbetreff>“; bei einer neuen Mail „Ihre Anfrage bei White Gloss – <Leistung>“, mit Vorgangsnummer „Ihre Anfrage WG-<Nummer> bei White Gloss“.
2. **Begrüßung** (siehe Anrede).
3. **Dank mit Bezug** in einem Satz: „vielen Dank für Ihre Anfrage zur Keramikversiegelung für Ihren <Fahrzeug>.“
4. **Antworten** auf die Fragen, je ein kurzer Absatz, das Wichtigste zuerst.
5. **Richtpreis** (Baustein unten).
6. **Termin**, falls ein Wunsch genannt ist (Baustein unten).
7. **Rückfragen**, höchstens drei, als kurze Liste.
8. **Nächster Schritt** in einem Satz.
9. **Gruß und Signatur.**

In der Regel 80 bis 200 Wörter. Mehr als zwei Positionen als kurze Liste, sonst im Fließtext.

## Signatur

```
Freundliche Grüße
{owner}
{legalName}
{street}, {postalCode} {city}
Tel. {phoneDisplay}
{bookingEmail} · {website ohne https://}
```

Beim Duzen „Viele Grüße“ statt „Freundliche Grüße“.

## Bausteine

**Richtpreis**

> Für <Paket bzw. Leistungen> an Ihrem <Fahrzeug> liegt der voraussichtliche Preis bei <Betrag> inkl. MwSt.<, einschließlich Hol- und Bringservice aus <Ort>>. Den verbindlichen Preis nennen wir Ihnen, sobald wir Fotos bzw. Ihr Fahrzeug gesehen haben – Verschmutzung, Lackzustand und Material können den Aufwand verändern.

Ist die Abholung „auf Anfrage“: „Den Hol- und Bringservice aus <Ort> stimmen wir gesondert mit Ihnen ab.“

**Termin mit Wunsch**

> Ihren Wunschtermin am <Datum> mit Fahrzeugabgabe um <Uhrzeit> Uhr prüfen wir und melden uns mit einer Bestätigung oder einem Alternativvorschlag.

**Termin ohne Wunsch**

> Nennen Sie uns gern zwei oder drei mögliche Tage. Die Fahrzeugabgabe ist von {openingHours.daysLabel} um {dropOffTimes als Aufzählung mit „oder“} Uhr möglich.

**Fotos**

> Damit wir den Preis genauer einschätzen können, schicken Sie uns gern zwei oder drei Fotos bei Tageslicht und ohne Blitz – eine Übersicht und Nahaufnahmen der betroffenen Stellen. Sie können einfach auf diese E-Mail antworten.

**Online-Anfrage** (nur, wenn noch kein Vorgang `WG-…` existiert und der Kunde buchen möchte)

> Wenn Sie möchten, stellen Sie Ihre Anfrage mit Wunschtermin direkt über unseren Online-Rechner: {bookingUrl}. Nach dem Absenden können Sie dort auch Fotos hochladen.

## WhatsApp-Variante

- Zwei bis sechs kurze Sätze; kein Betreff, keine Signatur, keine Tabelle.
- Dieselben Regeln zu Preis und Termin.
- Schluss: „Viele Grüße, Lars von White Gloss“.

> Guten Tag Frau Berger, vielen Dank für Ihre Nachricht! Für <Leistung> an Ihrem <Fahrzeug> liegt der voraussichtliche Preis bei <Betrag> inkl. MwSt.; den genauen Preis nennen wir nach einem Blick auf Fotos. Schicken Sie uns gern zwei oder drei Bilder bei Tageslicht. Ihren Wunschtermin am <Datum> prüfen wir und melden uns. Viele Grüße, Lars von White Gloss
