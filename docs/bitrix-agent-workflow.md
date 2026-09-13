# White-Gloss: KI-Agent und Bitrix24-Zielablauf

## Implementiert

Der Agent steht unter `/admin/bitrix` und `/admin/automatisierung`. Er verwendet
serverseitig ausschließlich `bitrix/bitrixgpt-5.5` über
`https://vibecode.bitrix24.com/v1/chat/completions`.

Auswahl einer gespeicherten Buchung, Prüfung ihrer Version, optional bis zu vier
zugeordnete Fotos (JPEG/PNG/WebP, jeweils höchstens 3 MB). Videos und nicht lesbare
Dateien werden ausdrücklich als ungeprüft gemeldet. Keine Übermittlung privater
Storage-URLs oder Zugangsschlüssel an das Modell. Die Datenübergabe ist auf
relevante Buchungsfelder begrenzt; keine ganzen Tabellen oder API-Zugangsdaten.

Ergebnisse enthalten Zusammenfassung, Beobachtungen, fehlende Angaben, Vorschläge
und optional einen **ungesendeten** Kundentext. Es gibt keine KI-Schreibwerkzeuge.
Modellantworten werden nicht als Statusbefehle interpretiert. Die früher mögliche
Grok-Interpretation wurde entfernt; auch der alte Rechnungsbefehl erzeugt keine
Dokumente mehr.

Authentifizierung, Betriebsberechtigung, Herkunftsprüfung, Nutzerlimit,
Buchungsversion und serverseitige Analysekennung schützen den Aufruf.
`booking_agent_runs` speichert den Bearbeitungsstand; dieselbe Anfrage erzeugt
keinen zweiten Modellaufruf. RLS ist aktiv, PUBLIC erhält keine Tabellenrechte.
Analysefehler enthalten keine rohen Providerantworten. Eine abgebrochene Analyse
wird nicht automatisch neu gestartet. Ein neuer bewusster Analyseaufruf erhält
eine neue Kennung. Ergebnisse sind immer an ihren Buchungsstand gebunden.

## Schlüssel und Inbetriebnahme

Ein persönlicher `vibe_api_…`-Schlüssel mit `vibe:ai` ist erforderlich. Der schon
vorhandene, ausschließlich für den Inhaber zugängliche Schlüssel-Dialog unter
`/admin/bitrix` kann ihn hinterlegen. Der Schlüssel gehört niemals ins Repository,
in öffentliche Build-Variablen oder in Logs.

`VIBE_AI_API_KEY` kann serverseitig einen getrennten KI-Schlüssel bereitstellen.
Sonst verwendet der Agent die vorhandene VibeCode-Konfiguration. Ein für den
CRM-Abgleich gespeicherter REST-Webhook ist kein KI-Schlüssel. Das bestehende
Server-Overlay/`VIBE_API_KEY` hat weiterhin Vorrang vor dem Panel-Wert.

Die additive Migration `0017_bitrix_agent.sql` wird im lokalen Schema und beim
expliziten Datenbank-Migrationslauf berücksichtigt. Auf bestehenden VPS-Ständen
wird genau dasselbe SQL beim ersten autorisierten Analyseaufruf atomar angewandt.
Das ist über `RUNTIME_ENSURED_MIGRATIONS` im Release-Vertrag abgebildet. Fehler bei
der Schemaanlage verhindern den Modellaufruf, nicht die Speicherung von Buchungen.

## Verbindliche Regeln für die weitere Bitrix24-Integration

Die folgende Tabelle ist eine Soll-/Ist-Abgrenzung. Der neue KI-Agent allein
aktiviert keinen vollständigen Bitrix24-Buchungs- und Rechnungsbetrieb.

| Schritt | Verbindlicher Ablauf | Vorhanden / noch erforderlich |
| --- | --- | --- |
| Anfrage | Daten, Leistungen, Zustand, vor dem Absenden gewählte Fotos zusammen zuordnen; Richtpreis; unverbindlicher Termin | Website-Workflow, Fotozuordnung und Bitrix-Deal-Queue vorhanden; Live-Zuordnung prüfen |
| Eingang | Sofort E-Mail ohne PDF; Website zeigt nur Anfrageeingang | `queueBookingEvent` und `receiptEmailCopy` vorhanden; tatsächliche Zustellung hängt von Mail-Einrichtung ab |
| Prüfung | Inhaber bearbeitet Leistungen, Preis, Anfang und Ende; Ablehnung/Alternativangebot; erforderliche Zustimmung ausdrücklich für diese Angebotsfassung | Zeit-/Preisfelder und manuelle Funktionen im bisherigen Zoho-Modul vorhanden; noch kein vollständiger Bitrix-Rückkanal oder angebotsgebundener Zustimmungsnachweis |
| Reservierung | Atomare Prüfung der gesamten Dauer pro Kapazität; auch ganztägig, mehrtägig, über Mitternacht; Umbuchung/Storno und manuelle Sperren beidseitig berücksichtigen | Lokale `booking_time_blocks` vorhanden; Bitrix-Kalender nutzt bisher geschätzte Dauer und feste IDs. Aktualisierung/Storno und Import manueller Bitrix-Sperren fehlen |
| Bestätigung | Nach Freigabe und Reservierung eigene White-Gloss-PDF versenden, keine Rechnung | Logo-/PDF-Erzeugung im vorhandenen Dokumentmodul; zuverlässige Bitrix-Zuordnung und Versand nach bestätigter Reservierung noch anzubinden |
| Abschluss | Nur ausdrücklicher Leistungsabschluss; finale Positionen/Betrag und Barzahlung oder Überweisung prüfen | Vorhandener Abschluss mit Zahlung im Zoho-Modul; noch keine entsprechende Bitrix-Bedienung |
| Rechnung | Eigenständiges Dokument; bei Bar tatsächlicher Betrag/Datum, bezahlt nur vollständig, keine Mahnung; Überweisung: sieben Kalendertage, Bankverbindung, Referenz, offen bis Zahlung | Bitrix-Rechnung, Zahlung und Versand nicht implementiert. Vor Aktivierung genau einen Rechnungsersteller festlegen und bestehende fremde Jobs gegen Doppelverarbeitung abgrenzen |

Für jeden externen Schreibschritt sind eine dauerhafte Vorgangskennung,
Angebots-/Buchungsversion, gespeicherte Provider-ID und ein Zustand für unklare
Ergebnisse nötig. Ein Timeout nach möglicher Erstellung muss vor Wiederholung
beim Anbieter abgeglichen werden. Wiederholte Freigaben dürfen nie eine zweite
Rechnung, Zahlung, Kalenderreservierung oder Nachricht anlegen. Bloße
Deal-Phasenwechsel oder das Terminende sind keine Rechnungsfreigabe.

Vor Bitrix-Einbettung muss der benötigte App-Zugang/Placement separat geprüft
werden: ein persönlicher API-Schlüssel ist nicht automatisch eine eingebettete
Bitrix-App. Vorhandene Kundendaten und historische Rechnungen dürfen bei der
Umstellung nicht nochmals angelegt oder versendet werden.

## Tatsächlich geprüft am 13.09.2026

- Persönlicher VibeCode-Zugang und Modellverfügbarkeit über `/v1/me` bestätigt.
- Echter Modellaufruf mit einer synthetischen Ablauf-Frage erfolgreich, ohne Kundendaten.
- Tests für festen Anbieter/Modell, ungültige/abgebrochene Antworten, unerwartete
  Tool-Aufrufe, Fehlerredaktion, Versionskonflikte, konkurrierende Anfragen,
  Wiederholung, unveränderte Geschäftsdatensätze und RLS.
- Verbundenes Supabase-Projekt ist `mvlhoibkkvmudxlevtlt`; privater Bucket
  `condition-photos` vorhanden. Das historische Supabase-Buchungsschema ist nicht
  das aktuelle VPS-Anwendungsschema. Keine Vermischung oder Migration produktiver
  Altbuchungen im Rahmen dieser Agenten-Erweiterung.
- Live-Admin verlangte eine Anmeldung. Schlüsselablage und die vollständige
  Bedienung im produktiven Admin waren damit noch nicht prüfbar.

Offizielle Schnittstelle: <https://vibecode.bitrix24.com/docs/ai>.
