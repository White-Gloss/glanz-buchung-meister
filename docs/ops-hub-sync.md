# Hub-Sync (Betriebspanel)

Das Notiz-Hub liest und schreibt Website-Buchungen über `POST /api/hub`.
Qonto-Zugangsdaten bleiben auf dem VPS. Das Hub speichert nur Origin + Sync-Token.

## Token setzen (bevorzugt)

Im Admin unter [Einstellungen](https://white-gloss.de/admin/einstellungen), nur Inhaber:

1. **Hub-Token erzeugen**
2. Den angezeigten Wert **einmal** kopieren
3. Im Hub unter Buchungen → **Webseite verbinden** denselben Wert speichern

Der Token liegt in `shop_settings.hub_sync_token` und wird nicht zurück ins Formular gelegt.
Erzeugen ersetzt den bisherigen Panel-Token. Die Hub-Verbindung muss dann neu gesetzt werden.

## Server-Datei (hat Vorrang)

In `/etc/white-gloss/environment`:

```
HUB_SYNC_TOKEN="<mindestens 32 Zeichen, zufällig>"
```

Ist diese Variable gesetzt, ignoriert die Seite den Panel-Token. Nach dem Setzen in der Datei: Dienst neu starten.

Ohne Token (weder Datei noch Panel) antwortet `/api/hub` mit 503 und ändert nichts.

Bestätigen im Hub ruft dieselbe manuelle Bestätigung auf wie `/admin`.
`erledigt` legt die Qonto-Rechnung an (ohne Auto-Mail).
„Rechnung per E-Mail“ im Hub sendet die Qonto-Rechnung.

## Nicht tun

- Token committen oder in den Chat legen
- Qonto-Login im Hub hinterlegen
- Die Route ohne Token öffentlich lassen (sie bleibt tot, solange Datei und Panel leer sind)
