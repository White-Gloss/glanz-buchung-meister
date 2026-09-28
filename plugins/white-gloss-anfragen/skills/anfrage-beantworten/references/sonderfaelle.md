# Sonderfälle

Kurzregeln für Anfragen, die vom Standard abweichen. Wo ein Feld genannt ist, steht der Wortlaut in `../angebot-kalkulieren/references/website-daten.json` (Pfad relativ zum Basisverzeichnis des Skills). Dort nachlesen, statt aus dem Gedächtnis zu zitieren.

## Termine

- Abgabe von `openingHours.daysLabel` zu den Zeiten in `dropOffTimes`. Die Uhrzeit ist die Fahrzeugabgabe, nicht das Ende der Arbeit.
- Die Belegung kennst du nicht. Lars prüft Verfügbarkeit und Arbeitszeit im Bitrix-Kalender – nie „frei“ oder „passt“ schreiben.
- Dauer laut Paket (`packages[].duration`); bei starker Verschmutzung oder Gerüchen kann es länger dauern (`faqs`).
- Wochenende, Feiertag oder Abgabe außerhalb der Abgabezeiten: nicht zusagen, `[[Lars: … möglich?]]` setzen.
- Kurzfristige Wünsche (in den nächsten drei Tagen) in der Notiz hervorheben. Laut AGB werden Hol- und Bringservice und Übergabe in der Regel drei bis vier Tage vor dem Termin abgestimmt.
- Umbuchung oder Storno eines bestehenden Vorgangs: nur den Eingang bestätigen („Wir haben Ihre Nachricht erhalten und melden uns.“). Ändern oder stornieren kann nur Lars.

## Hol- und Bringservice

- Nur nach vorheriger Bestätigung. Abholort, Übergabezeit und Preis werden vereinbart; die Gebühr kommt aus `pickup` bzw. vom Rechenskript.
- Die Aufbereitung erfolgt immer in der Werkstatt in Horb am Neckar. Es gibt keinen mobilen Service beim Kunden.
- Versicherung während der Überführung: keine pauschale Zusage. Die passende Antwort aus `faqs` sinngemäß wiedergeben; will der Kunde Details, `[[Lars: Versicherungsschutz]]` setzen.

## Preise und Zahlung

- Zahlung: `paymentNote` – keine Anzahlung. Laut AGB ist der Betrag nach der Leistung vor Ort in bar oder innerhalb von sieben Tagen per Überweisung fällig.
- Rabatte oder Preisverhandlung: nicht darauf eingehen, `[[Lars: Preisnachlass?]]` setzen.
- Nennt der Kunde einen anderen oder älteren Preis: den aktuellen Richtpreis nennen und die Abweichung in der Notiz aufführen.
- Rechnungen, Mahnungen, Zahlungseingang: keine inhaltliche Antwort, nur Eingangsbestätigung; Lars klärt das.

## Leistungen mit Prüfung

- **Luxus-, Sport- und Sammlerfahrzeuge** (etwa ab 80.000 € Fahrzeugwert): kein Richtpreis. Antwort: Wir besprechen Ihre Wünsche gern am Telefon (Nummer aus `company.phoneDisplay`) und erstellen nach der Begutachtung ein individuelles Angebot.
- **Geschäftskunden, Flotten, Autohäuser, mehrere Leasingrückläufer:** individuelle Kalkulation. Erfragen: Anzahl, Fahrzeugtypen, Zustand, Zeitraum, Logistik.
- **Leasingrückgabe eines Fahrzeugs:** Einstiegspreis aus `services` → `leasingrueckgabe`. Rückgabetermin erfragen; relevante Gebrauchsspuren gemeinsam prüfen und ehrlich sagen, dass nicht jede Spur verschwindet.
- **Dellen / Smart Repair:** lackschadenfreie Dellenentfernung, sofern technisch möglich. Preis und Zusage erst nach Begutachtung; bei kleinen Stellen reicht oft ein Foto für eine erste Einschätzung. Steinschläge oder Lackschäden nicht zusagen, sondern `[[Lars: Umfang Smart Repair]]` setzen.
- **Lederreparatur:** nur bei geeignetem Material; Preise je Stelle aus `services` → `lederreparatur` → `priceRows`, erst nach Prüfung. Farbunterschiede können sichtbar bleiben; ein ungeeigneter Reparaturversuch kostet nichts (`honestNote`).
- **Scheinwerferaufbereitung:** derzeit nicht buchbar. Auf Fachwerkstatt oder Prüforganisation verweisen (`honestNote`).
- **Keramik:** keine Standzeit versprechen, nicht kratzfest; Waschanlage und erste Wäsche laut `faqs`. Pflegehinweise gibt es bei der Übergabe.
- **Gerüche:** erst die Ursache, dann bei Bedarf Ozon. Bei starkem Nikotin- oder Schimmelgeruch können mehrere Behandlungen nötig sein.
- **Extras mit `inspect`** (z. B. zusätzliche Keramikschichten, Dachhimmel, Cabrioverdeck, Leder- und Textilreparatur): Preis „nach Prüfung“.

## Keine normale Antwort

- **Beschwerde, Schaden, Reklamation, rechtliche Fragen, Presse:** kein inhaltlicher Entwurf, kein Schuldeingeständnis, keine Zusage einer Entschädigung. Nur eine kurze, freundliche Eingangsbestätigung („… wir melden uns persönlich bei Ihnen“) und in der Notiz „persönlich klären“.
- **Spam, Werbung, Marketing- oder SEO-Angebote, Lieferanten, Bewerbungen:** nicht beantworten; in der Übersicht als „keine Kundenanfrage“ führen.
- **Fotos veröffentlichen:** nur mit Zustimmung und ohne sichtbares Kennzeichen; nie ungefragt eine Veröffentlichung ankündigen.
- **Andere Sprache:** in der Sprache des Kunden antworten, mit denselben Regeln; die Notiz für Lars bleibt auf Deutsch.
