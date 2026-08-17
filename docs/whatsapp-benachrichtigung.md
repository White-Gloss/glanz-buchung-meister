# WhatsApp-Benachrichtigung einrichten

Sobald eine Terminanfrage oder eine Zustandsmeldung eingeht, kommt eine
kurze Nachricht aufs Geschäftshandy. Die E-Mail läuft davon unabhängig
weiter — die Nachricht kommt zusätzlich, weil man sie unterwegs sieht.

Ohne die Zugangsdaten passiert nichts: keine Fehler, keine Verzögerung. Der
Adminbereich zeigt dann nur an, dass die Anbindung fehlt.

## Drei Dinge, die man vorher wissen sollte

Das ist keine Bastelei mit fünf Minuten Aufwand. Meta hat die Regeln so
gesetzt, und daran führt kein Weg vorbei.

**1. Die WhatsApp-Business-App und die Schnittstelle vertragen sich nicht
auf derselben Nummer.** Eine Rufnummer kann entweder in der App laufen oder
über die Cloud API — nicht beides. Wer seine bestehende Geschäftsnummer in
die Schnittstelle übernimmt, verliert dort die App.

**Deshalb der empfohlene Aufbau:** Meta stellt beim Einrichten eine
kostenlose Testnummer als Absender bereit. Diese verschickt an bis zu fünf
selbst hinterlegte Empfängernummern. Für Benachrichtigungen an den eigenen
Betrieb genügt das vollständig — die vorhandene Geschäftsnummer bleibt
unangetastet in der App und empfängt.

**2. Vom Unternehmen ausgehende Nachrichten brauchen eine genehmigte
Vorlage.** Meta lässt freien Text nur zu, wenn die Gegenseite innerhalb der
letzten 24 Stunden geschrieben hat. Für den Dauerbetrieb wird also eine
Vorlage gebraucht; die Genehmigung dauert meist wenige Minuten bis Stunden.

**3. Kosten.** Benachrichtigungen an die eigene Nummer fallen bei Meta unter
Dienstleistungs- bzw. Utility-Konversationen. Für geringe Mengen ist das
üblicherweise kostenlos oder im Centbereich. Prüfen Sie die aktuellen
Konditionen im Meta-Konto — sie ändern sich gelegentlich.

---

## Schritt 1 – Meta-Konto und App anlegen

1. <https://developers.facebook.com> öffnen, mit dem Facebook-Konto des
   Betriebs anmelden.
2. _Meine Apps_ → **App erstellen** → Anwendungsfall **Andere** →
   Typ **Business**.
3. Der App das **Meta-Unternehmenskonto** zuordnen. Ist noch keines
   vorhanden, legt Meta eines mit an.
4. Im Produktkatalog **WhatsApp** hinzufügen.

## Schritt 2 – Absender und Empfänger festlegen

Unter _WhatsApp → API-Einrichtung_:

1. Meta zeigt oben eine **Testnummer** als Absender. Darunter steht die
   **Telefonnummer-ID** — eine lange Ziffernfolge. Diese notieren, sie wird
   als `WHATSAPP_PHONE_NUMBER_ID` gebraucht.
2. Bei „An" auf **Nummer verwalten** klicken und die eigene
   Geschäftsnummer hinzufügen. WhatsApp schickt einen Bestätigungscode an
   diese Nummer.
3. Ohne diesen Schritt weist Meta jeden Versand ab — die Testnummer darf
   nur an bestätigte Empfänger senden.

## Schritt 3 – Dauerhaftes Zugangstoken erzeugen

Das auf der Einrichtungsseite angezeigte Token läuft nach 24 Stunden ab und
taugt nur zum Ausprobieren. Für den Betrieb braucht es ein dauerhaftes:

1. <https://business.facebook.com/settings> öffnen.
2. _Nutzer → Systemnutzer_ → **Hinzufügen**, Rolle **Administrator**.
3. Beim neuen Systemnutzer auf **Assets hinzufügen** → die WhatsApp-App
   auswählen → Vollzugriff.
4. **Token generieren** → App auswählen → Ablauf **Nie** → Berechtigungen
   `whatsapp_business_messaging` und `whatsapp_business_management`.
5. Das Token wird **genau einmal** angezeigt. Sofort sichern.

**Das Token ist ein Passwort.** Es gehört ausschließlich auf den Server,
niemals ins Projekt, niemals in einen Chatverlauf, niemals in eine Datei mit
`VITE_`-Präfix.

## Schritt 4 – Nachrichtenvorlage anlegen

Unter _WhatsApp → Vorlagen für Nachrichten_ → **Vorlage erstellen**:

| Feld          | Wert                                     |
| ------------- | ---------------------------------------- |
| Name          | `neue_anfrage`                           |
| Kategorie     | **Utility** (nicht Marketing)            |
| Sprache       | Deutsch                                  |
| Inhalt (Body) | `Neue Anfrage auf white-gloss.de: {{1}}` |

Die Kategorie ist wichtig: **Marketing** wird strenger geprüft und ist
teurer. Eine Benachrichtigung an den eigenen Betrieb ist Utility.

Der Platzhalter `{{1}}` nimmt die Zusammenfassung auf — Vorgangsnummer,
Name, Paket, Termin, Preis. Genau eine Variable, mehr nicht.

Beim Absenden verlangt Meta ein Beispiel für `{{1}}`. Dort etwa eintragen:
`WGD-2026-1001 · Max Mustermann · SUV, Premium Glanz · Wunschtermin 03.09.2026 · 436,25 €`

## Schritt 5 – Werte auf den Server

In `/etc/white-gloss/environment` ergänzen:

```
WHATSAPP_PHONE_NUMBER_ID=<Telefonnummer-ID aus Schritt 2>
WHATSAPP_ACCESS_TOKEN=<dauerhaftes Token aus Schritt 3>
WHATSAPP_TO=4915233540284
WHATSAPP_TEMPLATE=neue_anfrage
WHATSAPP_TEMPLATE_LANG=de
```

Zur Schreibweise von `WHATSAPP_TO`: international, **ohne** Pluszeichen,
ohne Leerzeichen, ohne führende Null. Aus `0152 33540284` wird
`4915233540284`. Andere Zeichen werden vom Programm entfernt, aber sauber
eingetragen ist besser.

Danach den Dienst neu starten.

## Schritt 6 – Testen

Im Adminbereich erscheint die Karte **WhatsApp-Benachrichtigung**. Sie zeigt
an, ob die Anbindung steht, und hat einen Knopf **Testnachricht senden**.

Kommt nichts an, sagt die Fehlermeldung meist genau, woran es liegt:

| Meldung von Meta                           | Ursache                                                   |
| ------------------------------------------ | --------------------------------------------------------- |
| `131030` Empfänger nicht in Erlaubnisliste | Schritt 2 fehlt — Nummer nicht bestätigt                  |
| `132001` Vorlage nicht gefunden            | Name oder Sprachcode stimmt nicht mit Meta überein        |
| `132000` Parameteranzahl falsch            | Die Vorlage hat nicht genau eine Variable                 |
| `190` Token ungültig                       | Token abgelaufen — Schritt 3 mit Ablauf „Nie" wiederholen |
| `470` außerhalb des Zeitfensters           | Keine Vorlage gesetzt, und die 24 Stunden sind vorbei     |

## Was verschickt wird

> Neue Terminanfrage WGD-2026-1001 · Max Mustermann · SUV / Limousine,
> Premium Glanz · Wunschtermin 03.09.2026 · 436,25 € · Abholung Nagold

**Ohne E-Mail-Adresse und ohne Telefonnummer der Kundschaft.** Die Nachricht
läuft über Meta, und für den Zweck — „es ist etwas eingegangen" — braucht es
diese Angaben nicht. Vollständig stehen sie in der E-Mail und im
Adminbereich.

Ausgelöst wird die Nachricht bei:

- einer neuen Terminanfrage über den Buchungsassistenten,
- einer neuen Zustandsmeldung mit Fotos.

## Zum Datenschutz

Bei aktiver Anbindung werden Name und Eckdaten der Anfrage an Meta
übermittelt. Das ist eine Auftragsverarbeitung und gehört in das
Verarbeitungsverzeichnis; die Datenschutzerklärung sollte einen
entsprechenden Absatz erhalten, sobald die Anbindung scharf geschaltet wird.
Sagen Sie Bescheid, dann wird er ergänzt — solange die Zugangsdaten fehlen,
wird nichts übertragen und der Absatz wäre unzutreffend.

## Falls Ihnen das zu aufwendig ist

Der gleiche Zweck — sofortige Meldung aufs Handy — ließe sich mit deutlich
weniger Aufwand über einen Telegram-Bot erreichen: kein Genehmigungsverfahren,
keine Vorlagen, keine Kosten, in etwa zehn Minuten eingerichtet. Der Nachteil
ist, dass eine zweite App nötig wird.
