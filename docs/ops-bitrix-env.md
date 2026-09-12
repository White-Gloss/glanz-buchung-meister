# Bitrix24 / VibeCode-Umgebung (VPS)

Das öffentliche Buchungspanel bleibt auf [white-gloss.de/#buchung](https://white-gloss.de/#buchung).
Jede gespeicherte Anfrage (Pakete, Zusatzleistungen, Fahrzeugklasse, Abholung, Fotos)
wird als Bitrix-Auftrag angelegt und im Leitstand weitergeführt:
Prüfung → Termin → Bestätigungs-PDF → Leistungsabschluss → Rechnung.

Postgres bleibt die Buchungsquelle. Die durable Queue legt Kontakt, Deal, Positionen
und Fotos in Bitrix24 an.

## Variablen in /etc/white-gloss/environment

Werte mit Leerzeichen immer quoten. Niemals Secrets committen.

Required:

```
VIBE_API_KEY
```

Optional:

```
VIBE_API_BASE=https://vibecode.bitrix24.com/v1
VIBE_PRODUCT_MAP={"basis":2,"premium":4,"keramik":6,"felgen":20}
```

Auth: jeder Aufruf sendet `X-Api-Key`. Der Schlüssel ist persönlich und gehört
nicht ins Repository.

Ohne `VIBE_API_KEY` bleibt die Warteschlange liegen; die Website-Buchung ist trotzdem gespeichert.

Der IONOS-Deploy kann denselben Schlüssel aus dem GitHub-Secret `VIBE_API_KEY`
als Release-Overlay mitgeben, falls die Datei `/etc/white-gloss/environment`
noch keinen Eintrag hat.

## Leistungskatalog

Dieselben IDs wie auf der Website (`src/data/site.ts`):

| Website-ID | Bitrix-Produkt (Standard) |
| --- | --- |
| basis | 2 Basisreinigung 149 € |
| premium | 4 Reinigung & Politur 349 € |
| keramik | 6 Keramikschutz 899 € |
| felgen, ozon, motor, leder, alcantara, dachhimmel, scheinwerfer, glas, keramik-ultra, cabrio, tierhaar, leder-repair, stoff-loch | passende Zusatzprodukte |
| Abholung 20 / 50 km | 16 / 18 |

Fahrzeugklassen skalieren den Richtpreis: Kompakt 1,0 · SUV/Limousine 1,25 · Transporter 1,55.

## Deploy-Check

1. `VIBE_API_KEY` in `/etc/white-gloss/environment` oder als GitHub-Secret `VIBE_API_KEY` hinterlegen
2. GitHub-Deploy nach grünem CI abwarten. `0015_zoho_ops.sql` und `0016_bitrix_sync.sql` werden zur Laufzeit angelegt (wie Lexware) und blockieren den Healthcheck nicht
3. Testbuchung auf `/#buchung` mit Paket, Extra und optionalem Foto
4. In Bitrix24 Deal `WG-{id}` prüfen; im Leitstand Termin, PDF, Abschluss und Rechnung wie bisher

## Nicht tun

- Secrets committen
- Das Website-Buchungspanel durch ein zweites Formular ersetzen
- Kunden-Mails durch Bitrix ersetzen
- Zoho/RO/Lexware ohne Absprache abschalten
