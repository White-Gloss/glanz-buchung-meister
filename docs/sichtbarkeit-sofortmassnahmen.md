# Schneller bei Google sichtbar werden

Stand: 17. August 2026. Fünf Schritte in der Reihenfolge ihrer Wirkung.
Zusammen etwa zwei bis drei Stunden Arbeit, davon der größte Teil in
Schritt 4.

**Warum überhaupt:** Die Domain `white-gloss.de` ist eine Woche alt. Google
kennt sie kaum, niemand verlinkt sie, und das Unternehmensprofil ist
gesperrt. Die Website selbst ist technisch einwandfrei (PageSpeed: SEO
100/100) — es fehlt ausschließlich an Bekanntheit gegenüber Google.

---

## Schritt 1 – Indexierung einzeln beantragen

**Dauer: 10 Minuten. Wirkung: die schnellste, die es gibt.**

Statt zu warten, bis Google von allein vorbeischaut, stellen Sie jede
wichtige Seite einzeln in die Warteschlange. Erfahrungsgemäß ein bis drei
Tage statt mehrerer Wochen.

1. <https://search.google.com/search-console> öffnen und die Property
   `white-gloss.de` auswählen (oben links im Auswahlfeld).
2. Ganz oben ist ein breites Suchfeld mit dem Text „Beliebige URL in …
   prüfen". Dort die vollständige Adresse einfügen, mit `https://`.
3. `Enter` drücken. Google prüft etwa 10 bis 30 Sekunden.
4. Erscheint **„URL ist nicht auf Google"**, darunter auf
   **„Indexierung beantragen"** klicken.
5. Ein Kasten „Indexierung wird angefordert" erscheint, danach eine
   Bestätigung. Fenster schließen.
6. Mit der nächsten Adresse wiederholen.

Diese sieben, in dieser Reihenfolge:

```
https://white-gloss.de/
https://white-gloss.de/preise
https://white-gloss.de/leistungen
https://white-gloss.de/abholservice
https://white-gloss.de/luxusfahrzeuge
https://white-gloss.de/qualitaet
https://white-gloss.de/faq
```

**Grenzen:** Etwa zehn Anfragen pro Tag. Dieselbe Seite mehrfach zu
beantragen bringt nichts und kann als Missbrauch gewertet werden. Sagt
Google **„URL ist auf Google"**, ist die Seite bereits drin — dann nichts
weiter tun.

---

## Schritt 2 – Adressänderung melden

**Dauer: 5 Minuten. Wirkung: löst das Kernproblem des Umzugs.**

Ihre Search Console meldet unter „Warum Seiten nicht indexiert werden" den
Grund _Duplikat – Google hat eine andere Seite als kanonische Seite
bestimmt_. Bei einem Domainumzug heißt das: Google hält weiterhin
`whitegloss.de` für die richtige Adresse. Mit diesem Werkzeug sagen Sie
ausdrücklich, dass umgezogen wurde.

**Voraussetzung:** Beide Domains müssen als Property in der Search Console
angelegt **und bestätigt** sein — die alte `whitegloss.de` und die neue
`white-gloss.de`. Fehlt die alte, zuerst über _Property hinzufügen_
anlegen.

1. In der Search Console oben links die Property der **alten** Domain
   `whitegloss.de` auswählen. Das ist der Schritt, den fast alle falsch
   machen: Das Werkzeug sitzt bei der alten, nicht bei der neuen Domain.
2. Links unten auf **Einstellungen** (Zahnrad).
3. **Adressänderung** wählen.
4. Unter „Neue Website auswählen" `white-gloss.de` auswählen.
5. Google prüft nun automatisch drei Dinge: ob die Weiterleitungen
   funktionieren, ob beide Properties Ihnen gehören, und ob die neue
   Domain erreichbar ist. Alle drei sollten ein grünes Häkchen bekommen.
6. Auf **Validieren und aktualisieren** klicken.

Danach überträgt Google die Wertung schrittweise. Das dauert einige Wochen
— aber ohne diesen Schritt dauert es deutlich länger oder passiert gar
nicht sauber.

**Wichtig:** Die Weiterleitung von `whitegloss.de` muss dabei bestehen
bleiben. Mindestens ein Jahr, besser länger. Erst danach darf die alte
Domain auslaufen.

---

## Schritt 3 – Sitemap einreichen

**Dauer: 2 Minuten.**

Die Sitemap ist ein Verzeichnis aller 30 Seiten. Damit muss Google sie
nicht über Links suchen.

1. Search Console, Property `white-gloss.de`.
2. Links im Menü auf **Sitemaps**.
3. Im Feld „Neue Sitemap hinzufügen" steht bereits `https://white-gloss.de/`
   fest. Dahinter eintragen: `sitemap.xml`
4. Auf **Senden** klicken.

Nach ein paar Minuten sollte in der Liste „Erfolgreich" stehen und eine
Zahl entdeckter Seiten. Steht dort ein Fehler, schicken Sie mir bitte einen
Screenshot.

Dasselbe für die alte Domain nicht nötig.

---

## Schritt 4 – Einträge in Verzeichnissen anlegen

**Dauer: 1,5 bis 2 Stunden. Wirkung: mittelfristig die größte.**

Ihre Domain hat derzeit praktisch keine Verweise von anderen Websites.
Google entdeckt und bewertet aber über solche Verweise. Zusätzlich prüft
Google, ob Ihre Firmendaten überall gleich lauten — das ist bei örtlichen
Betrieben ein direkter Ranking-Faktor und heilt nebenbei den
Duplikat-Verdacht.

### Der Textbaustein

Überall **exakt** diese Angaben verwenden. Nicht „White-Gloss", nicht
„White Gloss", nicht „Horb-Dettingen":

```
Firmenname:  White Gloss Detailing
Inhaber:     Lars Hägele
Straße:      Arnistal 27
PLZ / Ort:   72160 Horb am Neckar
Telefon:     0152 33540284
E-Mail:      info@white-gloss.de
Website:     https://white-gloss.de
Branche:     Fahrzeugaufbereitung / Autopflege
```

Kurzbeschreibung zum Kopieren (passt in die meisten Felder):

> White Gloss Detailing ist ein Fachbetrieb für Fahrzeugaufbereitung in
> Horb am Neckar. Wir übernehmen Innen- und Außenreinigung, mehrstufige
> Lackkorrektur, Keramikversiegelung und Lederpflege — für Privatkunden
> ebenso wie für Flotten und Leasingrückläufer. Auf Wunsch holen wir das
> Fahrzeug ab und bringen es zurück. Termine online anfragen unter
> white-gloss.de.

Längere Fassung, falls ein Verzeichnis mehr Text zulässt:

> White Gloss Detailing bereitet Fahrzeuge in Horb am Neckar und Umgebung
> auf. Das Leistungsspektrum reicht von der materialgerechten
> Innenreinigung über Lackknete, Politur und Keramikversiegelung bis zur
> Aufbereitung von Leasingrückläufern und Flottenfahrzeugen. Für
> Luxus-, Sport- und Sammlerfahrzeuge planen wir jede Aufbereitung nach
> persönlicher Begutachtung. Ein Hol- und Bringservice deckt die Region
> um Horb ab. Preise und Pakete sind auf white-gloss.de einsehbar,
> Termine lassen sich dort direkt anfragen.

### Wo eintragen

Alle kostenlos. Reihenfolge nach Nutzen:

| Verzeichnis       | Adresse               | Hinweis                                          |
| ----------------- | --------------------- | ------------------------------------------------ |
| Das Örtliche      | dasoertliche.de       | Eintrag über „Firmeneintrag" unten auf der Seite |
| Gelbe Seiten      | gelbeseiten.de        | „Kostenlos eintragen"                            |
| 11880             | 11880.com             | kostenloser Basiseintrag                         |
| Cylex             | cylex.de              | schnell angelegt, wird von Google gut erfasst    |
| meinestadt.de     | meinestadt.de         | regional stark, Horb am Neckar auswählen         |
| werkenntdenBESTEN | werkenntdenbesten.de  | Bewertungsportal, auch für Empfehlungen nützlich |
| Yelp              | yelp.de               | international, schadet nicht                     |
| Apple Karten      | mapsconnect.apple.com | wichtig für iPhone-Nutzer, wird oft vergessen    |

### Was Sie außerdem tun sollten

- **Instagram- und Facebook-Profil**: Im Profilfeld „Website"
  `https://white-gloss.de` eintragen. Kostet zwei Minuten und ist ein
  echter Verweis.
- **Handwerkskammer oder IHK**: Falls Sie dort geführt werden, prüfen, ob
  ein Eintrag im Mitgliederverzeichnis möglich ist.
- **Örtliche Partner**: Autohäuser, freie Werkstätten, Reifenhändler,
  Leasing- und Fuhrparkfirmen. Ein gegenseitiger Link auf der
  Partnerseite ist branchenüblich und in einem Telefonat vereinbart.

**Faustregel:** Lieber fünf Einträge mit exakt gleichen Daten als zwanzig
mit Abweichungen. Uneinheitliche Angaben schaden mehr, als zusätzliche
Einträge nützen.

---

## Schritt 5 – Bing einrichten

**Dauer: 10 Minuten.**

Bing ist klein, speist aber die Windows-Suche und mehrere KI-Assistenten.
Dort ist die Konkurrenz deutlich dünner als bei Google.

1. <https://www.bing.com/webmasters> öffnen.
2. **„Aus Google Search Console importieren"** wählen — das übernimmt
   Property und Bestätigung automatisch.
3. Falls der Import nicht klappt: Property manuell mit
   `https://white-gloss.de` anlegen und die Sitemap `sitemap.xml`
   einreichen.

---

## Was bewusst nicht auf dieser Liste steht

- **Mehrfach dieselbe Seite zur Indexierung anmelden.** Bringt nichts.
- **Links kaufen.** Schadet aktiv und ist schwer rückgängig zu machen.
- **Weitere Geschwindigkeitsoptimierung.** Die Website steht bei 100 von 100. Jede Stunde dort ist verglichen mit Schritt 1 bis 4 verschenkt.
- **Am gesperrten Unternehmensprofil weiterklicken.** Siehe
  [`google-unternehmensprofil.md`](google-unternehmensprofil.md).

## Wann was zu erwarten ist

| Zeitraum             | Was sichtbar wird                                         |
| -------------------- | --------------------------------------------------------- |
| 1–3 Tage             | Die sieben Seiten aus Schritt 1 erscheinen im Index       |
| 1–2 Wochen           | Suche nach „White Gloss Detailing" findet die neue Domain |
| 2–8 Wochen           | Die Wertung der alten Domain wandert über                 |
| 3–6 Monate           | Allgemeine Begriffe wie „Fahrzeugaufbereitung Horb"       |
| sofort nach Freigabe | Der Karteneintrag — der schnellste Weg zu Kundschaft      |

Der letzte Punkt ist der wichtigste: Sobald das Unternehmensprofil wieder
läuft, kommt die lokale Sichtbarkeit deutlich schneller als über die
Trefferliste. Deshalb bleibt der Wiederherstellungsantrag die Aufgabe mit
dem besten Verhältnis von Aufwand zu Wirkung.

## Der bezahlte Weg

**Google Ads** wirkt sofort und braucht kein Unternehmensprofil. In der
Region bieten kaum Mitbewerber auf Begriffe wie „Autoaufbereitung Horb",
entsprechend niedrig sind die Klickpreise. Die Website ist vorbereitet: Es
fehlen nur die Conversion-ID und das Conversion-Label aus einem Ads-Konto,
dann wird jede abgeschickte Terminanfrage automatisch als Erfolg gemeldet.
Die Schritte stehen in [`google-anbindung.md`](google-anbindung.md).
