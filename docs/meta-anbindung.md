# Meta-Anbindung (Facebook und Instagram)

Wie bei Google ist die Technik fertig; es fehlen die Werte aus dem Meta-Konto.
Solange sie fehlen, ist die gesamte Anbindung inaktiv – es wird kein Skript
geladen und nichts gesendet.

| Wert                     | Wohin                                              | Geheim?                          |
| ------------------------ | -------------------------------------------------- | -------------------------------- |
| `VITE_META_PIXEL_ID`     | eingecheckte `.env`                                | nein, steht ohnehin im Quelltext |
| `META_PIXEL_ID`          | `/etc/white-gloss/environment` auf dem VPS         | nein, aber serverseitig nötig    |
| `META_CAPI_ACCESS_TOKEN` | **nur** `/etc/white-gloss/environment` auf dem VPS | **ja – niemals ins Repository**  |

Das Zugriffstoken darf unter keinen Umständen ein `VITE_`-Präfix bekommen.
Damit läge es im Browser-Bündel und wäre für jeden lesbar, der die Seite
aufruft. Schicken Sie es auch nicht per Chat – es gehört direkt auf den
Server.

## Schritt 1 – Pixel-ID holen

1. https://business.facebook.com/events_manager öffnen
2. Datenquelle für `white-gloss.de` auswählen oder anlegen
3. Die **Pixel-ID** ist eine 15- bis 16-stellige Zahl und steht unter dem
   Namen der Datenquelle
4. Als `VITE_META_PIXEL_ID` in `.env` eintragen und deployen

Den Code-Schnipsel, den Meta beim Einrichten anbietet, **nicht** zusätzlich
einbauen. Die Website lädt den Pixel selbst – und zwar erst nach der
Einwilligung.

## Schritt 2 – Conversions API (optional, aber wirksam)

Die Conversions API meldet dieselben Ereignisse zusätzlich vom Server aus.
Sinn der Sache: Werbeblocker und Browser-Schutzmechanismen unterdrücken den
Pixel bei einem erheblichen Teil der Besucher; diese Anfragen gingen sonst
verloren. Doppelt gezählt wird nichts – Pixel und Server senden dieselbe
Ereigniskennung, Meta erkennt daran das Duplikat.

1. Im Events Manager: _Einstellungen → Conversions API → Zugriffstoken
   erstellen_
2. Token direkt auf dem Server in `/etc/white-gloss/environment` eintragen,
   zusammen mit `META_PIXEL_ID`
3. Dienst neu starten

## Welche Ereignisse die Website meldet

| Ereignis           | Wann                                                       | Auch serverseitig |
| ------------------ | ---------------------------------------------------------- | ----------------- |
| `PageView`         | bei jedem Seitenaufruf, auch beim Wechsel ohne Neuladen    | nein              |
| `ViewContent`      | beim Lesen eines Ratgeber-Beitrags                         | nein              |
| `Contact`          | Klick auf Anrufen oder WhatsApp aus einem Inhaltsabschnitt | ja                |
| `InitiateCheckout` | Klick auf „Termin anfragen" aus einem Inhaltsabschnitt     | nein              |
| `Lead`             | **abgeschickte** Terminanfrage, mit Angebotswert in Euro   | ja                |

`Lead` wird an genau einer Stelle gesendet: beim erfolgreichen Abschicken.
Der Klick auf „Termin anfragen" meldet bewusst `InitiateCheckout`, weil er
erst an den Anfang des Buchungsassistenten führt. Würden beide `Lead` melden,
zählte eine einzige Anfrage doppelt – die Ereigniskennungen unterscheiden
sich, Meta könnte sie nicht als Dublette erkennen.

## Datenschutz

Pixel und Conversions API laufen ausschließlich nach aktiver Einwilligung
(§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO). Sowohl das Nachladen des
Skripts als auch jedes einzelne Ereignis prüft die Einwilligung erneut, ein
Widerruf wirkt deshalb sofort. Die Datenschutzerklärung nennt Meta,
die verarbeiteten Daten und die gemeinsame Verantwortlichkeit nach Art. 26
DSGVO bereits.

**Zustandsfotos der Fahrzeuge werden niemals an Meta übertragen.** Sie liegen
in einem privaten Speicher und gehören zum Auftrag, nicht zur Werbung.

Wie bei Analytics gilt: Gezählt wird nur, wer „Akzeptieren" wählt. Die
tatsächlichen Zahlen liegen höher als die im Werbekonto angezeigten.
