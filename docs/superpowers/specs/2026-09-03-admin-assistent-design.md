# Admin-Assistent (Posteingang) — Design

Datum: 2026-09-03  
Repo: `White-Gloss/glanz-buchung-meister`

## Kontext

Website und Buchungssystem (TanStack Start, React, TypeScript, Tailwind, Supabase, better-auth). Bestehendes Admin unter `/admin`, inkl. `/admin/posteingang` mit `listInbox`, `markInboxRead`, `replyInbox`. WhatsApp existiert bisher vor allem als ausgehende Benachrichtigung (`docs/whatsapp-benachrichtigung.md`).

## Ziel

Eigenen Chat-Assistenten **nur für den Operator** im Admin-Panel. Fokus: Posteingang, in dem Nachrichten aus Buchungen, E-Mail und (neu) WhatsApp zusammenlaufen. Der Operator kann antworten. Der Assistent hilft mit Zusammenfassungen, Antwortentwürfen und Admin-Aktionen (Termine, Inhalte, Status) über Tools.

KI-Anbieter: **Google Gemini** (serverseitig).

## Nicht-Ziele (v1)

- Kein öffentlicher Kunden-Chat auf der Website
- Kein separater KI-Microservice in v1
- Kein automatisches Senden von Kundenantworten ohne Operator-Prüfung
- Kein Ersetzen des gesamten Admin-UI

## UX

- Aufklappbares Chat-Panel rechts im Admin; besonders nützlich auf `/admin/posteingang`, auf Admin-Routen erreichbar
- Nur für authentifizierte Operatoren
- Deutsch als Standardsprache
- Bei ausgeführten Admin-Aktionen: kurze Rückmeldung im Chat (z. B. „Termin X auf bestätigt gesetzt“)
- Kundenantworten: Assistent erstellt **Entwurf** → Operator prüft → Operator sendet (`replyInbox` / künftige WhatsApp-Antwort)

## Architektur

- Gemini nur serverseitig; Env `GEMINI_API_KEY` (kein `VITE_`-Leak)
- API-Route hinter derselben Operator-Auth wie andere Admin-Funktionen
- Tool-Calling: serverseitige Tools wrappen bestehende Admin-/Inbox-Funktionen (kein wildes DB-Bypass)
- Wissenskontext v1: System-Prompt + relevante Betriebsinfos (Leistungen, Preise, Abläufe) aus vorhandenen Daten/Docs; kein separates RAG-Produkt nötig, falls der Kontext kurz bleibt

## Fähigkeiten (Tools) — v1

**Lesen / Zusammenfassen:** Inbox-Einträge, Buchungen, Kunden, Leistungen/Preise (wo Admin-APIs existieren).

**Schreiben:** erlaubte Admin-Änderungen (Status, Notizen, Termine) über bestehende Funktionen — ohne Extra-Bestätigungsdialog im Chat, aber mit klarer Audit-Meldung in der Assistenten-Antwort.

**Antworten an Kunden:** nur Entwurf; Senden bleibt Operator-Aktion.

## WhatsApp

**Heute:** ausgehende Benachrichtigungen.

**Ziel (Phase B):** WhatsApp als Kanal im Posteingang (eingehend + Antworten), analog zu bestehenden Inbox-Channels.

Hinweise: Meta Cloud API, Webhook, Phone-Number-ID/Token nur serverseitig; freier Text nur im 24h-Fenster; Vorlagen außerhalb. Geschäftsnummer vs. API-Nummer beachten (bestehende Projektdoku).

## Sicherheit

- Strikt operator-gated
- Keine Secrets im Client
- Rate-Limits analog bestehender Admin-APIs
- Keine erfundenen Kundendaten, Steuer-IDs oder Bankdaten in Entwürfen

## Erfolgskriterien

1. Operator öffnet Admin-Chat, fragt zu Inbox/Buchung, bekommt hilfreiche Gemini-Antwort.
2. Assistent liest Admin-Daten über Tools und führt erlaubte Änderungen aus.
3. Antwortentwurf für eine Kundenanfrage erscheint; Senden erst nach Operator-Prüfung.
4. Pfad für WhatsApp-Kanal im Posteingang ist spezifiziert; Umsetzung darf gestaffelt sein.

## Lieferphasen

- **Phase A:** Chat-UI + Gemini + Tools auf dem bestehenden Posteingang/Admin.
- **Phase B:** WhatsApp inbound/outbound im Posteingang.

## Offene Punkte (bei Implementierung)

- Konkretes Gemini-Modell (z. B. `gemini-2.0-flash`)
- Persistenz des Chat-Verlaufs (Empfehlung: pro Operator serverseitig, nicht nur `localStorage`)
