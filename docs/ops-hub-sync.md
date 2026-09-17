# Hub-Sync (Betriebspanel)

Das Notiz-Hub liest und schreibt Website-Buchungen über `POST /api/hub`.
Qonto-Zugangsdaten bleiben auf dem VPS. Das Hub speichert nur Origin + Sync-Token.

## Server

In `/etc/white-gloss/environment` zusätzlich:

```
HUB_SYNC_TOKEN="<mindestens 32 Zeichen, zufällig>"
```

Ohne Token antwortet `/api/hub` mit 503 und ändert nichts.
Nach dem Setzen: Dienst neu starten, damit die Route live ist.

Der Token ist derselbe Wert, den das Hub unter Buchungen → „Webseite verbinden“ speichert.

Bestätigen im Hub ruft dieselbe manuelle Bestätigung auf wie `/admin`.
`erledigt` legt die Qonto-Rechnung an (ohne Auto-Mail).
„Rechnung per E-Mail“ im Hub sendet die Qonto-Rechnung.

## Nicht tun

- Token committen oder in den Chat legen
- Qonto-Login im Hub hinterlegen
- Die Route ohne Token öffentlich lassen (sie bleibt tot, solange die Variable fehlt)
