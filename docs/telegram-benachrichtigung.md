# Telegram-Benachrichtigung einrichten

Sobald eine Terminanfrage oder eine Zustandsmeldung eingeht, kommt sofort
eine Nachricht aufs Handy. Die E-Mail läuft davon unabhängig weiter.

**Aufwand: etwa zehn Minuten. Kosten: keine.** Kein Genehmigungsverfahren,
keine Nachrichtenvorlagen, keine Wartezeit — der Unterschied zu WhatsApp,
wo all das anfällt.

Nötig ist die Telegram-App auf dem Handy. Wenn Sie sie noch nicht haben:
kostenlos in App Store oder Play Store, Anmeldung mit der Handynummer.

---

## Schritt 1 – Bot anlegen

Ein „Bot" ist hier nichts Kompliziertes: nur ein Absender, der Ihnen
schreiben darf.

1. Telegram öffnen, oben in die Suche **`BotFather`** eingeben.
2. Den Treffer mit dem **blauen Haken** antippen — es gibt Nachahmer ohne.
3. **Starten** drücken.
4. `/newbot` senden.
5. BotFather fragt nach dem **Namen**. Frei wählbar, zum Beispiel:
   `White Gloss Meldungen`
6. Dann fragt er nach dem **Benutzernamen**. Der muss weltweit einmalig sein
   und auf `bot` enden, zum Beispiel: `white_gloss_meldungen_bot`
   Ist er vergeben, sagt BotFather das und Sie versuchen einen anderen.
7. BotFather antwortet mit einem Text, in dem steht:

   > Use this token to access the HTTP API:
   > `8123456789:AAF3k9_Beispiel-Zeichenkette-xyz`

**Diese Zeichenkette ist das Token.** Kopieren und sicher ablegen.

**Das Token ist ein Passwort.** Wer es hat, kann als dieser Bot schreiben.
Es gehört ausschließlich auf den Server — nicht ins Projekt, nicht in einen
Chatverlauf, nicht in eine Datei mit `VITE_`-Präfix.

## Schritt 2 – Dem Bot einmal selbst schreiben

**Dieser Schritt wird am häufigsten vergessen, und ohne ihn geht gar
nichts.** Ein Telegram-Bot darf kein Gespräch beginnen. Erst wenn Sie ihm
geschrieben haben, darf er antworten.

1. In der Telegram-Suche den Benutzernamen Ihres Bots eingeben, etwa
   `@white_gloss_meldungen_bot`.
2. Chat öffnen, **Starten** drücken (oder `/start` senden).

Das war's. Der Chat sieht leer aus — das ist richtig so.

## Schritt 3 – Chat-Kennung herausfinden

Der Server muss wissen, wohin er schreiben soll. Das ist keine
Telefonnummer, sondern eine Zahl.

**Der einfache Weg:**

1. In der Telegram-Suche **`userinfobot`** eingeben, Chat öffnen,
   **Starten** drücken.
2. Er antwortet sofort mit Ihren Angaben. Die Zeile **`Id:`** enthält die
   Zahl, zum Beispiel `123456789`.

**Falls das nicht klappt**, geht es auch direkt. Diese Adresse im Browser
öffnen und `<TOKEN>` durch Ihr Token aus Schritt 1 ersetzen:

```
https://api.telegram.org/bot<TOKEN>/getUpdates
```

In der Antwort steht `"chat":{"id":123456789,` — diese Zahl ist es. Kommt
`{"ok":true,"result":[]}` zurück, haben Sie Schritt 2 noch nicht gemacht.

## Schritt 4 – Werte auf den Server

In `/etc/white-gloss/environment` ergänzen:

```
TELEGRAM_BOT_TOKEN=8123456789:AAF3k9_Beispiel-Zeichenkette-xyz
TELEGRAM_CHAT_ID=123456789
```

Danach den Dienst neu starten.

## Schritt 5 – Testen

Im Adminbereich erscheint die Karte **Sofortbenachrichtigung**. Steht bei
Telegram ein grünes Häkchen, drücken Sie **Testnachricht**. Die Meldung
sollte binnen Sekunden auf dem Handy sein.

Kommt nichts an, sagt die Fehlermeldung, woran es liegt:

| Meldung                      | Ursache                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| Chat nicht gefunden          | Schritt 2 fehlt, oder die Kennung stimmt nicht                   |
| Das Bot-Token wird abgelehnt | Token falsch kopiert — oft fehlt ein Zeichen am Anfang oder Ende |
| Der Bot wurde blockiert      | In Telegram den Chat öffnen und die Blockierung aufheben         |

---

## Wenn mehrere Personen mitlesen sollen

Statt an Sie persönlich kann die Meldung auch in eine Gruppe gehen:

1. In Telegram eine Gruppe anlegen, etwa „White Gloss Meldungen".
2. Den Bot als Mitglied hinzufügen.
3. Eine beliebige Nachricht in die Gruppe schreiben.
4. `https://api.telegram.org/bot<TOKEN>/getUpdates` aufrufen und die
   `chat.id` der Gruppe ablesen.

**Gruppen-Kennungen sind negativ**, etwa `-1001234567890`. Das Minuszeichen
gehört dazu und ist kein Fehler.

## Was verschickt wird

> Neue Terminanfrage WGD-2026-1001 · Max Mustermann · SUV / Limousine,
> Premium Glanz · Wunschtermin 03.09.2026 · 436,25 € · Abholung Nagold

**Ohne E-Mail-Adresse und ohne Telefonnummer der Kundschaft.** Für den
Zweck — „es ist etwas eingegangen, schau in die Verwaltung" — braucht es
die nicht. Vollständig stehen sie in der E-Mail und im Adminbereich.

Ausgelöst wird die Nachricht bei:

- einer neuen Terminanfrage über den Buchungsassistenten,
- einer neuen Zustandsmeldung mit Fotos.

## Zum Datenschutz

Bei aktiver Anbindung gehen Name und Eckdaten der Anfrage an Telegram. Das
ist eine Auftragsverarbeitung und gehört ins Verarbeitungsverzeichnis; die
Datenschutzerklärung sollte einen entsprechenden Absatz bekommen, sobald
die Anbindung scharf geschaltet ist. Solange die Zugangsdaten fehlen, wird
nichts übertragen.

Telegram ist ein Anbieter außerhalb der EU. Wer das vermeiden will, hat mit
der E-Mail-Benachrichtigung bereits einen Weg, der vollständig über den
eigenen Server und IONOS läuft — sie bleibt ohnehin aktiv.

## Beide Wege nebeneinander

Telegram und WhatsApp schließen sich nicht aus. Sind beide eingerichtet,
geht die Meldung über beide. Jeder Weg scheitert für sich: Ein defektes
Telegram-Token hält den WhatsApp-Versand nicht auf, und umgekehrt. Keiner
von beiden kann eine bereits gespeicherte Buchung zu einem Fehler für die
Kundschaft machen.

Die WhatsApp-Einrichtung steht in
[`whatsapp-benachrichtigung.md`](whatsapp-benachrichtigung.md).
