# Lexware Office-Umgebung (VPS)

Website-Buchungen bleiben lokal. Die durable Queue legt den Kundenkontakt in Lexware Office an und erzeugt bei Status **erledigt** eine **Entwurfsrechnung**. Odoo- und Qonto-Pfade bleiben parallel unverändert. Rechnungen werden weder finalisiert noch per API versendet — Freigabe und Versand nur in der Lexware-Oberfläche.

Das ist die **Lexware Office Public API** (`https://api.lexware.io/v1`), nicht Lexware Desktop. Desktop hat keine REST-API.

## Schlüssel eintragen

Bevorzugt im Admin unter **Dokumente** (nur Inhaber): Feld „Lexware-API-Schlüssel“ → Speichern.
Der Schlüssel bleibt auf dem Server und wird nicht zurück ins Browserformular gelegt.

Alternativ in `/etc/white-gloss/environment` (hat Vorrang vor dem Panel):

```text
LEXWARE_API_KEY="…"
```

Den Schlüssel nicht im Chat, in GitHub oder in WhatsApp schicken.

Optional:
LEXWARE_API_BASE (default https://api.lexware.io/v1, no trailing slash)

Schlüssel anlegen: [Public API](https://app.lexware.de/addons/public-api)
Authorization: Bearer. Rate limit: 2 requests/second.

## Was übertragen wird

- Jede gespeicherte Website-Buchung: Kontakt (Person, Rolle Kunde), Lookup per E-Mail, sonst neu.
- Nur bei Status `erledigt`: Rechnung als **draft** (ohne `finalize=true`).
- Positionsbeträge netto aus dem gespeicherten Bruttobetrag, 19 % MwSt., EUR, `shippingType=service`.
- Vermerk: `Website-Buchung WG-{id}`.
- Kein Backfill bestehender Buchungen. Der Schalter startet default **aus**.

## Deploy-Check

1. Env speichern und quoten
2. Schema legt sich beim ersten Speichern/Übertragen selbst an (kein blockierendes `0014` im Release)
3. systemctl restart white-gloss.service nach dem Release
4. Im Admin unter Dokumente Schlüssel einfügen, speichern, Übertragung einschalten
5. Testbuchung anlegen; nach **erledigt** Draft in Lexware Office prüfen
6. Qonto- und Odoo-Sync unverändert smoke-testen

## Nicht tun

- Secrets committen oder im Chat verlangen
- Odoo oder Qonto abschalten
- Rechnungen per API finalisieren oder versenden
- Historische Buchungen nachträglich in die Queue schreiben
- Lexware Desktop als API-Ziel behandeln
