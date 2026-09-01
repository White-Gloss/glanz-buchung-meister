# 🔧 Was du später tun musst

> Jeder Punkt mit exakter Erklärung, warum, und konkreten Links/Tools.

---

## 1. 📸 Galerie mit echten Vorher/Nachher-Fotos befüllen

**Warum:** Das ist der stärkste Conversion-Hebel im Detailing-Business. Kein Text verkauft so gut wie
ein zerkratzter Kotflügel, der danach spiegelt. Die `GallerySection`-Komponente ist bereits
programmiert und im Code eingebunden – sie ist nur noch **leer**.

**Was tun:**

1. Bei jedem Kundenprojekt 2–3 gute Fotos machen (vorher/nachher, gleicher Winkel, gute
   Beleuchtung).
2. Für den Start: 6–10 Bilder deiner bisher besten Arbeiten zusammentragen.
3. Bilder hochladen:
   - Entweder per **Supabase Storage** (Bucket `gallery`, öffentlich zugänglich)
   - Dateinamen-Schema: `fahrzeug-paket-vorher.jpg`, `fahrzeug-paket-nachher.jpg`
4. Daten in die `gallery_images`-Tabelle eintragen:
   ```sql
   INSERT INTO gallery_images (title, description, image_url, package, vehicle, published)
   VALUES (
     'Full-Restoration BMW 5er',
     'Lackkorrektur + Keramikversiegelung. 14 Stunden Arbeit.',
     'https://dein-supabase-projekt.supabase.co/storage/v1/object/public/gallery/bmw-5er-nachher.jpg',
     'Lackkorrektur',
     'BMW 520d',
     true
   );
   ```

**Tools:** Kamera/Smartphone, Supabase Dashboard (Storage + Table Editor)

---

## 2. ⭐ Google-Bewertungen als Widget einbinden

**Warum:** Echte Google-Rezensionen schaffen Vertrauen in Sekunden. Schon 5–6 positive
Bewertungen wirken stärker als jede Eigenwerbung.

**Was tun:**

1. Kunden nach erfolgreicher Aufbereitung um eine Google-Bewertung bitten.
   - Direktlink bereithalten: [Google Bewertungslink finden](https://support.google.com/business/answer/7035772)
2. Sobald du ≥ 5 Bewertungen hast: Widget einbinden.
   - Option A: [Elfsight Google Reviews Widget](https://elfsight.com/google-reviews-widget/) – kostenlos für bis 200 Views/Monat
   - Option B: [EmbedSocial](https://embedsocial.com/products/embedreviews/) – ab $19/Monat
   - Option C: Selber bauen mit [Google Places API](https://developers.google.com/maps/documentation/places/web-service/overview) (kostet pro API-Call)
3. Ich baue dir dann die Komponente ein, sobald du das Widget/einen API-Key hast.

**Akut:** Kundenbewertungen aktiv einfordern (WhatsApp-Nachricht mit Link nach Terminabschluss).

---

## 3. 📋 Google Business Profile (GMB) optimal pflegen

**Warum:** Dein Google-Eintrag ist für lokale Suchen („Fahrzeugaufbereitung Horb“) der
wichtigste Rankingfaktor. Die Website und das GBP müssen konsistent sein.

**Was tun:**

1. Einloggen unter [business.google.com](https://business.google.com)
2. Prüfen und ergänzen:
   - **Öffnungszeiten** aktuell?
   - **Dienstleistungen** mit den gleichen Namen wie auf der Website: „Innenraumreinigung“, „Lackkorrektur“, „Keramikversiegelung“
   - **Fotos** mit Geotag aus Horb hochladen (nicht aus dem Ausland/VPN)
   - **Posts** regelmäßig (alle 2–3 Wochen): Neues Projekt, Tipp des Monats, vorher/nachher
3. [GBP-Optimierungs-Guide von Moz](https://moz.com/blog/optimize-google-business-profile)

---

## 4. 🏦 Steuernummer + Bankdaten hinterlegen

**Warum:** Für rechtskonforme Rechnungen (Pflichtangaben nach §14 UStG) und die
Buchungsbestätigung benötigt die Website diese Daten.

**Was tun:**

1. Nach Gewerbeamt-Besuch (kommende Woche) mir durchgeben:
   - Steuernummer (vom Finanzamt)
   - IBAN + BIC (Geschäftskonto)
   - USt-IdNr. (falls vorhanden, vom Bundeszentralamt für Steuern)
2. Ich trage das dann ein in `src/lib/servicesConfig.ts`:
   - `company.taxId` → USt-IdNr. Sobald sie gesetzt ist, erscheint sie automatisch
     im Impressum; dort ist nichts von Hand zu ändern.
   - `company.bank.iban` und `company.bank.bic` → stehen danach in den
     Zahlungsinformationen der Belege statt „wird nachgereicht".
   - `company.taxNumber` → Steuernummer. Sie wird derzeit nirgends ausgegeben:
     ins Impressum gehört sie nicht, und die verbindliche Rechnung stellt
     Lexware aus, wo sie im Konto hinterlegt wird.

**Was du dafür NICHT tun musst:** `legalDetailsVerified` auf `true` setzen. Das Feld
wird von keiner Stelle im Code gelesen — ein früherer Hinweis hier behauptete eine
Freischaltung, die es nie gab. Die Belege greifen ohne Schalter auf die Werte zu und
schreiben „wird nachgereicht", solange ein Feld leer ist.

Die Rechnungsnummer musst du ebenfalls nicht setzen: Sie entsteht in der Datenbank
als `WGD-` + laufendes Jahr + fortlaufender Zähler.

---

## 5. 📅 Online-Terminbuchung einrichten

**Warum:** Ein Kalender mit Live-Verfügbarkeit spart dir Telefon-Pingpong und senkt die
Hemmschwelle für Kunden deutlich. Der BookingWizard existiert bereits, aber ohne echten
Kalender-Backend-Check (nur „bevorzugte Uhrzeit“).

**Was tun (3 Optionen, leicht → aufwändig):**

| Option                    | Aufwand            | Kosten              | Link                                 |
| ------------------------- | ------------------ | ------------------- | ------------------------------------ |
| **Calendly**              | 1h einrichten      | $10/Monat           | [calendly.com](https://calendly.com) |
| **Cal.com** (self-hosted) | 2h Docker + Domain | 0€ (eigener Server) | [cal.com](https://cal.com)           |
| **Supabase-native**       | 4–6h Entwicklung   | 0€ (Free Tier)      | Ich baue es dir                      |

**Empfehlung:** Fange mit Calendly an (schnell, professionell). Einbetten per iframe oder Link
im BookingWizard. Später kannst du auf eine native Lösung upgraden.

---

## 6. 📝 Blog-Artikel aus echten Kundenfragen schreiben

**Warum:** Die FAQ und der Ratgeber sind gut, aber die SEO-Treffer kommen von Artikeln, die
echte Google-Suchanfragen abdecken („muss ich mein auto vor der aufbereitung waschen“, „was
kostet lackkorrektur bmw 3er“).

**Was tun:**

1. Sammle die 10 häufigsten Kundenfragen aus WhatsApp/Telefon/Formularanfragen.
2. Für jede Frage einen kurzen Artikel (400–800 Wörter) schreiben.
3. Artikel im Blog-Verzeichnis ablegen: `blog-articles/03-fragethema.md`
4. Ich helfe dir mit Struktur, SEO-Titel und Formatierung.

**Schema pro Artikel:**

```md
---
title: "Titel als Suchanfrage"
date: 2026-08-15
slug: url-slug
published: true
---

Einleitung (1 Satz, beantwortet die Frage sofort)

## Die kurze Antwort

...

## Die Details

...

## Was bedeutet das für Ihre Aufbereitung?

...

## Fazit

...
```

---

## 7. 🔄 PWA (Offline-Fähigkeit) für den BookingWizard

**Warum:** Wenn du auf einem Kundenparkplatz stehst und das mobile Netz schlecht ist, kann
der Kunde den Konfigurator trotzdem nutzen – die Daten werden synchronisiert, sobald wieder
Netz da ist.

**Was tun:**

1. [Workbox](https://developer.chrome.com/docs/workbox) in Vite integrieren
   → Plugin: [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/)
2. Ich kann das einbauen, sobald du sagst, wie aggressiv die Caching-Strategie sein soll:
   - **Network-first** (immer aktuell, offline nur Fallback) – gut für Preisseite
   - **Cache-first** (schnell, offline priorisiert) – gut für BookingWizard
   - **Stale-while-revalidate** (zeigt Cache, aktualisiert im Hintergrund) – gut für Galerie

**Empfehlung:** Cache-first für den BookingWizard. Ich baue es dir mit `vite-plugin-pwa` ein.

---

## 8. 📱 Meta Pixel / Facebook Conversion Tracking aktivieren

**Warum:** Der Code ist bereits vollständig implementiert (Meta Pixel + CAPI/Conversions API).
Du musst nur deine Pixel-ID und den CAPI-Token eintragen, damit das Tracking startet.

**Was tun:**

1. Im [Meta Events Manager](https://business.facebook.com/events_manager2/) eine Pixel-ID
   erstellen (falls noch keine existiert).
2. CAPI-Token generieren (Einstellungen → Conversions API → Token generieren).
3. Die beiden Werte gehören an **zwei verschiedene Orte** — das ist keine Förmlichkeit:

   - **Pixel-ID** → `VITE_META_PIXEL_ID` in der `.env`. Sie ist öffentlich und steht
     ohnehin im Quelltext jeder Seite.
   - **CAPI-Token** → `META_CAPI_ACCESS_TOKEN` in den geschützten Umgebungsvariablen
     des Hostings, **niemals** in eine Datei im Repository. Das Token ist ein
     Geheimnis: Wer es hat, kann in deinem Namen Ereignisse an Meta melden. Alles,
     was im Repository liegt, ist für jeden lesbar, der Zugriff darauf bekommt —
     und aus der Git-Historie bekommt man es auch nachträglich nicht mehr heraus.

   Die Felder `company.meta.pixelId` und `company.meta.capiToken` in
   `src/lib/servicesConfig.ts` sind nur ein Notnagel für die lokale Entwicklung und
   bleiben im Repository leer.

---

## Zusammenfassung: Priorität

| #   | Aufgabe                            | Zeitaufwand | Impact         |
| --- | ---------------------------------- | ----------- | -------------- |
| 1   | Galerie-Bilder sammeln & hochladen | 2h          | 🔥🔥🔥         |
| 2   | Google-Bewertungen einholen        | laufend     | 🔥🔥🔥         |
| 3   | Google Business Profile pflegen    | 30min       | 🔥🔥           |
| 4   | Steuernummer + IBAN durchgeben     | 5min        | 🔥🔥 (Pflicht) |
| 6   | Kundenfragen sammeln               | laufend     | 🔥             |
| 5   | Calendly einrichten                | 1h          | 🔥             |
| 8   | Meta Pixel aktivieren              | 15min       | 🔥             |
| 7   | PWA einbauen                       | 2h (ich)    | ⚡             |
