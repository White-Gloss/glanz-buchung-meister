# Cutover: öffentliche Optik → White Gloss Live

**Status:** Branch `public-atelier-cutover`. **Nicht mergen**, bevor die Vorschau
freigegeben ist. IONOS deployt von `main`.

## Was dieser Branch tut

Chirurgischer Port der öffentlichen Fläche. Admin, Supabase, ERPNext,
WhatsApp, Telegram, Lexware, Auth (`_authenticated`) bleiben unangetastet.

1. **Fahrzeuggalerie:** Live-Galerie ist leer (Supabase-Bucket ohne
   veröffentlichte Bilder) und rendert deshalb `null`. Fallback zeigt das
   vorhandene Atelierfoto (`hero-car.avif`) als „Referenz aus dem Atelier“ –
   kein erfundenes Kundenfahrzeug, keine Fantasie-Kennzeichen.
2. **Private Client (`/luxusfahrzeuge`):** dieselbe ehrliche Referenz,
   2:1-Zuschnitt (Kennzeichen der Live-Datei liegt am unteren Rand und fällt
   so aus dem Bild).
3. **Kein 1:1-Dump der Vorschau.** Die Vorschau nutzt Better Auth + Neon.
   Production nutzt Supabase-Auth und den bestehenden Buchungsassistenten.
   Ein Überschreiben von `main` würde Buchungen, Inbox und ERPNext zerstören.

## Was bewusst nicht in diesem Branch liegt

- Sandbox-`index.tsx` (würde `BookingWizard` ersetzen)
- Sandbox-Admin / Better Auth / PGLite
- Tracking-Pixel (Google/Meta/Ahrefs) – CEO-Ladezeit und DSGVO
- Neue Kundennamen oder weitere Fahrzeuge (existieren im Repo nicht)
- `.env` und Secrets

## Kennzeichen

Die Live-Datei `src/assets/hero-car.jpg` zeigt noch ein Kennzeichen.
In der Vorschau ist es unkenntlich gemacht. Vor dem Merge:

- Entweder das Asset durch die maskierte Fassung aus der Vorschau ersetzen
  (`public/media/hero.jpg` / AVIF/WebP-Set), **oder**
- den 2:1-Zuschnitt belassen (Kennzeichen fällt unten raus).

## Hol- & Bringservice 20 €

Code in `servicesConfig.ts` ist bereits `0 € bis 10 km`. Zeigt die Live-Startseite
weiter 20 €, liegt ein Admin-Override in `service_prices` vor – nicht in diesem
Branch ändern, im Leitstand prüfen.

## Merge-Reihenfolge (erst nach Freigabe)

1. Vorschau visuell abnehmen (Startseite + `/luxusfahrzeuge`).
2. Optional: maskiertes Hero-Asset committen.
3. Diesen Branch nach `main` mergen → IONOS-Workflow.
4. Nach dem Deploy: Galerie, Buchung, WhatsApp, Admin einmal prüfen.
