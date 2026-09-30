# Hub-Sync: offene Website-Anfragen abholen

Der Hub holt offene Buchungsanfragen von der Website ab („Website-Anfragen holen“).
Die Website ruft den Hub nie auf. Die Route liest nur; sie bestätigt, blockiert,
mailt und rechnet nichts ab.

Route: `src/routes/api/hub.ts`, Logik: `src/lib/hub-inquiries.ts`.

## Token setzen

Nur als Server-Umgebungsvariable, in `/etc/white-gloss/environment`:

```
HUB_SYNC_TOKEN="<mindestens 32 Zeichen, zufällig>"
```

Danach den Dienst neu starten. Im Hub unter „Website-Anfragen holen“ denselben
Wert hinterlegen. Der Token gehört nicht ins Repo, nicht in Logs, nicht ins
Frontend und nicht in den Chat.

## Vertrag

```
POST https://white-gloss.de/api/hub
Content-Type: application/json
Accept: application/json
Authorization: Bearer <HUB_SYNC_TOKEN>

{"action":"list"}
```

| Fall                                     | Antwort                          |
| ---------------------------------------- | -------------------------------- |
| Andere Methode als POST                  | 405, leer                        |
| `HUB_SYNC_TOKEN` fehlt oder < 32 Zeichen | 503 `{"error":"not_configured"}` |
| Header fehlt oder Token falsch           | 401 `{"error":"unauthorized"}`   |
| `action` nicht `"list"`                  | 400 `{"error":"bad_request"}`    |
| Erfolg (auch ohne offene Anfrage)        | 200 `{"inquiries":[…]}`          |
| Datenbankfehler                          | 500 `{"error":"unavailable"}`    |

Die Route antwortet nie mit 410. Für den Hub heißt 410: Route aus.

Offen heißt: `status = 'neu'`, nicht bestätigt, nicht storniert, noch vor der
Annahme (`ops_stage` Anfrage, Prüfung oder Kundenrückmeldung), keine Rechnung
und keine Zahlung erfasst, in der RO App weder vom Inhaber bestätigt noch
abgeschlossen. Höchstens 40, neueste zuerst.

`id` ist die bestehende Buchungsnummer (WG-Nummer ohne Präfix). Beträge sind
ganze Cent, `total_cents` ist der gespeicherte Ab-Preis inklusive Klasse,
Extras und Abholung. Fotos liegen privat; `note` nennt nur ihre Anzahl, nie
Pfade oder signierte Links.

## Prüfen, ohne den Token auszugeben

```sh
# erwartet 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://white-gloss.de/api/hub \
  -H 'content-type: application/json' -d '{"action":"list"}'
```

Mit Token nur aus einer Datei oder Variable lesen, nie in die Kommandozeile tippen.
