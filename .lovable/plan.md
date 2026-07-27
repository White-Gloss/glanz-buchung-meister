## Ziel

Der Hol- & Bringservice (Abholservice) wird im Buchungstool paketabhängig bepreist:

| Paket | Abholservice |
|---|---|
| High-End Keramik | inklusive (0 €) |
| Premium Glanz | 60 € |
| Basis Pflege | 60 € |

Heute ist er ein normales Add-on mit 49 €, das zusätzlich mit dem Fahrzeugfaktor (×1,25 / ×1,55) multipliziert wird. Das entfällt: 60 € gelten pauschal, unabhängig von der Fahrzeugklasse.

## Umsetzung

**1. Zentrale Konfiguration (`src/lib/servicesConfig.ts`)**
- Add-on `hol` erhält Preis 60 €, Beschreibung mit Hinweis „bei High-End Keramik inklusive".
- Neues Feld am Add-on-Typ: kein Fahrzeugfaktor (Pauschalpreis) sowie eine Liste der Pakete, in denen die Leistung bereits enthalten ist (`keramik`).
- Im Paket „High-End Keramik" wird „Hol- & Bringservice inklusive" als Feature ergänzt.

**2. Preisberechnung (`src/lib/bookings.ts`)**
- `calcLineItems` bekommt die Paket-Information mit: Pauschal-Add-ons ohne Faktor rechnen; ist die Leistung im gewählten Paket enthalten, erscheint sie als Position mit 0 € und Zusatz „inklusive" (damit sie auch auf der Rechnung sichtbar ist, aber den Betrag nicht erhöht).

**3. Booking-Wizard (Schritt 3, `src/components/BookingWizard.tsx`)**
- Der Abholservice zeigt bei gewähltem Keramik-Paket „Inklusive" statt eines Preises und ist automatisch aktiv/fixiert.
- Bei Basis/Premium wird pauschal „+60 €" angezeigt (nicht faktorisiert).
- Live-Preisrechner und Zusammenfassung übernehmen die neue Logik automatisch.

**4. Rechnung/Admin**
- Da PDF und Admin-Ansicht dieselben `calcLineItems` nutzen, erscheint die Position konsistent (60 € bzw. „inklusive", 0 €).

## Technische Details

- Betroffene Dateien: `src/lib/servicesConfig.ts`, `src/lib/bookings.ts`, `src/components/BookingWizard.tsx`; `src/lib/bookings.functions.ts` reicht die Paket-ID bereits an `calcLineItems` weiter, sodass die serverseitige Summe (und damit die 20 %-Anzahlung) identisch bleibt.
- Bestehende Buchungen werden neu berechnet dargestellt, sofern die Rechnung erneut generiert wird — Alt-Buchungen behalten ihren gespeicherten `total`-Wert in der Datenbank.
