# white-gloss-anfragen – Plugin für Claude Cowork

Kundenanfragen und Angebote für White Gloss Detailing. Das Plugin entwirft Antworten auf
Anfragen und berechnet Richtpreise genau wie der Online-Rechner auf white-gloss.de.

Es erstellt nur Entwürfe: Es sendet nichts, bestätigt keine Termine und nennt keine
verbindlichen Preise. Freigabe, Bestätigung und Rechnung bleiben bei Lars in Bitrix24.

## Inhalt

| Skill                 | Beispiel                                              | Ergebnis                                                                                |
| --------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `anfrage-beantworten` | „Beantworte die neueste Anfrage im Postfach“          | Gmail-Entwurf im Anfrage-Thread oder WhatsApp-Text, dazu eine Notiz mit offenen Punkten |
| `angebot-kalkulieren` | „Was kostet Keramikschutz für einen X3 aus Tübingen?“ | Richtpreis mit Positionen, wie sie auch nach Bitrix24 übertragen werden                 |

Claude nutzt die Skills automatisch, wenn eine Bitte dazu passt. In Claude Code lassen sie
sich auch direkt aufrufen, z. B. `/white-gloss-anfragen:anfrage-beantworten`.

Weitere Bausteine gibt es nicht: keine eigenen Connectoren, Agents oder Hooks. Für
Gmail-Entwürfe nutzt das Plugin den Gmail-Connector des Claude-Kontos. Ohne ihn liefert es
den Text zum Kopieren.

## Installation

- **Cowork, per Datei:** Unter **Customize → Plugins** die Upload-Option wählen und
  `white-gloss-anfragen.plugin` auswählen. Die Datei ist ein ZIP dieses Ordners (Bauanleitung
  unten).
- **Cowork, über dieses Repository:** Unter **Customize → Plugins** mit **Add marketplace**
  das Repository `White-Gloss/glanz-buchung-meister` hinzufügen und `white-gloss-anfragen`
  installieren. Cowork liest den Stand des Standard-Branches.
- **Claude Code:**

  ```
  /plugin marketplace add White-Gloss/glanz-buchung-meister
  /plugin install white-gloss-anfragen@white-gloss
  ```

  Zum Testen mit einem lokalen Checkout: `claude --plugin-dir ./plugins/white-gloss-anfragen`.

## Daten aktuell halten

Pakete, Preise, Fahrzeugklassen, Extras, Abholstaffel, Orte, Leistungstexte und FAQ stammen
aus `src/data/site.ts`. Das Plugin liest sie aus der Momentaufnahme
`skills/angebot-kalkulieren/references/website-daten.json`.

- Nach jeder Änderung an `src/data/site.ts`: `npm run cowork:data` ausführen und die Datei
  mit committen. Sonst schlägt `npm test` fehl (`scripts/cowork-plugin.test.mjs`).
- Derselbe Test prüft, dass `scripts/angebot.mjs` für alle Pakete, Klassen, Orte und viele
  Extra-Kombinationen denselben Betrag liefert wie `quoteTotal` der Website.
- Bei inhaltlichen Änderungen die Version in `.claude-plugin/plugin.json` und im
  Marktplatz (`.claude-plugin/marketplace.json` im Repository-Stamm) gemeinsam erhöhen.
- Tonfall, Anrede und Signatur stehen in `skills/anfrage-beantworten/references/tonalitaet.md`.

Datei für den Upload bauen (im Repository-Stamm):

```sh
(cd plugins/white-gloss-anfragen && zip -r /tmp/white-gloss-anfragen.plugin . -x '*.DS_Store')
```

## Grenzen

- Kein Zugriff auf Bitrix24: Verfügbarkeit, Freigabe, Buchungsbestätigung und Rechnung
  bleiben bei Lars.
- Richtpreise sind laut AGB Orientierungspreise. Verbindlich wird ein Preis erst nach Prüfung
  und Freigabe.
- Kein Versand: Auch auf ausdrückliche Bitte legt das Plugin nur Entwürfe an.
