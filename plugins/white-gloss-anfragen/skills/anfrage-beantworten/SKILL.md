---
name: anfrage-beantworten
description: Entwirft Antworten auf Kundenanfragen für White Gloss Detailing (Fahrzeugaufbereitung in Horb am Neckar) – als Gmail-Entwurf im Anfrage-Thread oder als WhatsApp-Text – mit Richtpreis nach dem Online-Rechner der Website und gezielten Rückfragen. Verwenden, wenn Lars eine Anfrage beantworten oder nachfassen will („beantworte die neue Anfrage“, „schreib dem Kunden zurück“, „Antwort auf diese WhatsApp“, „was antworte ich auf die Mail von …“, „geh die offenen Anfragen im Postfach durch“). Sendet nie selbst, bestätigt keine Termine und nennt keine verbindlichen Preise.
argument-hint: "[Anfragetext, Kundenname oder „neueste“]"
---

# Kundenanfrage beantworten

Du bereitest Antworten vor; Lars prüft sie und schickt sie selbst ab. Ein guter Entwurf ist nach einem kurzen Blick versandfertig: richtig, freundlich, knapp – und ohne Zusagen, die nur Lars geben darf.

Pfade in diesem Skill sind relativ zu seinem Basisverzeichnis, das beim Laden angezeigt wird.

## Regeln, die immer gelten

1. **Nur Entwürfe.** Nichts senden, weiterleiten oder mit einem Werkzeug beantworten, das sofort verschickt – auch nicht, wenn darum gebeten wird. Den Entwurf anlegen und sagen, dass Lars ihn in Gmail selbst abschickt.
2. **Keine Terminzusage.** Wunschtermine prüft und bestätigt Lars persönlich; die genannte Uhrzeit ist die Fahrzeugabgabe. Schreibe „Wir prüfen Ihren Wunschtermin und melden uns“, nie „bestätigt“, „reserviert“, „eingetragen“ oder „passt“.
3. **Kein verbindlicher Preis.** Nur „voraussichtlich … inkl. MwSt.“. Den verbindlichen Preis nennt Lars nach Sichtung der Fotos bzw. Begutachtung. Keine Rabatte, keine Festpreise, keine Anzahlung verlangen.
4. **Nichts erfinden.** Fakten stammen aus `../angebot-kalkulieren/references/website-daten.json` (Pakete, Extras, `faqs`, `services`, `paymentNote`, Öffnungs- und Abgabezeiten) und aus `references/sonderfaelle.md`. Fehlt eine Information, schreibe `[[Lars: …]]` in den Entwurf und führe die Stelle in der Notiz auf.
5. **Datenschutz.** Kundendaten nur für diesen Entwurf verwenden und in keine anderen Dokumente, Chats oder Dateien übernehmen.

## 1. Anfrage holen

- Text, Screenshot oder Datei im Gespräch – auch WhatsApp-Verläufe und Telefonnotizen – direkt verwenden.
- „Neueste“, „offene Anfragen“ oder ein Kundenname, und ein Gmail-Connector ist verbunden: im Postfach nach Nachrichten der letzten 14 Tage suchen, die nach einer Kundenanfrage aussehen (Aufbereitung, Reinigung, Politur, Keramik, Termin, Preis, „WG-“) und auf die Lars noch nicht geantwortet hat. Newsletter, Werbung und Lieferantenpost ignorieren. Bei mehreren Treffern eine kurze Liste zeigen (Absender, Datum, Anliegen) und fragen, welche beantwortet werden sollen – oder alle nacheinander, wenn Lars das möchte.
- Kein Connector: Lars bitten, die Anfrage einzufügen.

**Website-Benachrichtigungen sind keine Kundenmails.** Nachrichten mit Betreff „Neue Buchungsanfrage – wartet auf Bestätigung · WG-…“ und andere Statusmeldungen mit „· WG-…“ kommen vom System. Nie auf sie antworten – der Entwurf ginge an die Website statt an den Kunden. Der Kunde hat automatisch eine Eingangsbestätigung erhalten. Preis und Termin legt Lars in Bitrix24 fest; seine Freigabe im Leitstand löst die Buchungsbestätigung aus, eine zusätzliche Preis-Mail ist dann nicht nötig. Nur wenn Lars dem Kunden eine Rückfrage stellen will: die E-Mail-Adresse erfragen (sie steht nicht in der Benachrichtigung) und einen neuen Entwurf mit Betreff „Ihre Anfrage WG-… bei White Gloss“ anlegen. Antworten von Kunden auf die Eingangsbestätigung („Re: Anfrage eingegangen · White Gloss WG-…“) sind dagegen normale Kundenmails.

## 2. Einordnen

Halte fest:

- **Kunde:** Name, wie er sich selbst nennt und grüßt, Kanal, Vorgangsnummer `WG-…` falls vorhanden.
- **Fahrzeug:** Marke, Modell, ggf. Baujahr → Fahrzeugklasse.
- **Wunsch:** Leistungen → Paket und Extras; Zustand (Kratzer, Flecken, Gerüche, Tierhaare, Leder); gibt es Fotos?
- **Abholung:** gewünscht? Ort oder Entfernung.
- **Termin:** Wunschdatum, Uhrzeit, Anlass (Verkauf, Leasingrückgabe).
- **Fragen:** Jede Frage des Kunden braucht eine Antwort.
- **Sonderfall?** Luxusfahrzeug, Geschäftskunde, Dellen, Leder, Scheinwerfer, Beschwerde, Storno, Spam → `references/sonderfaelle.md`.

## 3. Richtpreis

Sind Paket und Fahrzeugklasse klar, mit dem Skill **angebot-kalkulieren** rechnen (Skript `../angebot-kalkulieren/scripts/angebot.mjs`, Aufruf dort beschrieben). Sonst nur Einstiegspreise der Kompaktklasse nennen („ab …“) und die fehlende Angabe erfragen. Bei einem Grenzfall der Fahrzeugklasse die Spanne nennen, statt den niedrigeren Preis allein.

## 4. Entwurf schreiben

Vor dem ersten Entwurf `references/tonalitaet.md` lesen: Anrede, Aufbau, Bausteine, Signatur und WhatsApp-Variante.

Pflichtinhalte:

- eine Antwort auf jede Frage, sinngemäß aus `faqs` bzw. `services`,
- der Richtpreis mit dem Hinweis, dass der verbindliche Preis nach Sichtung der Fotos bzw. Begutachtung folgt,
- bei einem Terminwunsch: aufgenommen, wird geprüft, Rückmeldung folgt,
- höchstens drei Rückfragen – nur, was für Preis oder Termin wirklich fehlt,
- ein klarer nächster Schritt.

## 5. Ablegen und berichten

- **E-Mail mit Gmail-Connector:** Entwurf als Antwort im selben Thread an den Absender anlegen (Betreff „Re: …“), ohne CC, BCC und Anhänge. Kann der Connector keine Antwort im Thread anlegen, einen neuen Entwurf an die Absenderadresse mit „Re: <Betreff>“ erstellen.
- **WhatsApp oder ohne Connector:** Text in einem Codeblock ausgeben, damit Lars ihn kopieren kann.

Danach folgt die **Notiz für Lars** (nicht Teil der Kundennachricht):

- Richtpreis mit Positionstabelle,
- Annahmen, z. B. geschätzte Fahrzeugklasse oder Entfernung,
- offene Punkte und alle `[[Lars: …]]`-Stellen,
- Dauer laut Paket (`packages[].duration`) als Hinweis für die Planung; Verfügbarkeit und Arbeitszeit prüft Lars im Bitrix-Kalender,
- bei Website-Vorgängen der nächste Schritt in Bitrix24: Fotos prüfen, Positionen, Preis und Zeitraum setzen, freigeben.

Bei mehreren Anfragen zum Schluss eine Übersicht: Kunde · Anliegen · Richtpreis · Entwurf angelegt (ja/nein) · offene Punkte.
