# Setup-Guide: Meta Pixel, Google Search Console & Git-Deployment

## 1️⃣ Meta Pixel & Conversions API aktivieren

Damit das Meta Pixel und die Conversions API live gehen, müssen folgende Umgebungsvariablen gesetzt werden:

### Client-Seite (in `.env` im Repo – öffentlich, daher unbedenklich):
```env
VITE_META_PIXEL_ID="DEINE_PIXEL_ID"
```

Die Pixel-ID ist öffentlich – sie steht ohnehin im Quelltext jeder Seite. Du findest sie im Meta Events Manager unter **Datenquellen → Web → Pixel**.

### Server-Seite (in den geschützten Umgebungsvariablen der Deployment-Plattform – GEHEIM!):
In **hPanel → Hermes Agent → Dashboard → Environment**:
```env
META_PIXEL_ID=DEINE_PIXEL_ID
META_CAPI_ACCESS_TOKEN=DEIN_TOKEN
```

Das CAPI-Token erstellst du im Meta Events Manager unter **Einstellungen → Conversions API → Zugriffstoken generieren**.

### Nach dem Setzen:
1. Im Repo die `.env` aktualisieren
2. Nach `main` pushen
3. Git-Deployment auslösen

> **Testen**: Nach dem Deployment auf https://whitegloss.de gehen, im Cookie-Banner "Akzeptieren" klicken und in der Browser-Console prüfen, ob `fbq` geladen wird. Im Meta Events Manager sollten "Aktiv (Browser)" und "Aktiv (Server)" erscheinen.

## 2️⃣ Google Search Console & Local SEO

### Google Search Console:
1. Gehe zu https://search.google.com/search-console
2. Eigenschaft **"whitegloss.de"** (Domain-Property) hinzufügen
3. Als Verifikationsmethode **"DNS-Eintrag"** wählen
4. Den TXT-Record im IONOS-DNS-Manager eintragen

Alternativ: Meta-Tag-Verifikation. Dafür müsste in den `<head>`-Bereich der Seite ein Tag eingefügt werden. Bei Bedarf den Code-Ort nennen.

### Sitemap einreichen:
Nach der Verifikation unter **Sitemaps** eintragen:
```
https://whitegloss.de/sitemap.xml
```

### Aktueller SEO-Status (bereits implementiert):
- ✅ Sitemap mit 29 URLs
- ✅ robots.txt korrekt
- ✅ 13 regionale Abholservice-Seiten mit unique content
- ✅ JSON-LD Structured Data (LocalBusiness, Service, FAQ, BlogPosting)
- ✅ SEO-Meta-Tags pro Seite
- ✅ Bild-Optimierung (AVIF, WebP, JPG)

### Noch offen:
- ❌ Google Search Console Verifikation
- ❌ Sitemap einreichen
- ❌ Sitemap zu Bing Webmaster Tools hinzufügen

## 3️⃣ Git & Deployment

### Für Push-Zugriff auf GitHub:
1. Gehe zu https://github.com/White-Gloss/glanz-buchung-meister/settings/keys
2. **Deploy keys** → **Add deploy key**
3. Name: `hermes-agent-deploy`
4. Public Key:
   ```
   ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEbpXqR4PJyACN7kRDegt52kYTRf3byizP1I8u87cbUn hermes-agent-deploy@whitegloss
   ```
5. **Allow write access** aktivieren ✅
6. **Add key**

Danach kann ich per SSH pushen:
```bash
git remote set-url origin git@github.com:White-Gloss/glanz-buchung-meister.git
git push origin main
```

### Deployment-Automatisierung (optional):
Im hPanel bei der Git-Bereitstellung die **Webhook-URL** kopieren und in GitHub unter **Settings → Webhooks → Add webhook** einfügen. Dann löst jeder Push auf `main` automatisch ein Deployment aus.

## 4️⃣ Blog-Artikel importieren

Die 6 vorbereiteten Artikel liegen in:
- **Lokal**: `blog-articles/` im Repository
- **Server**: `/home/u556297683/domains/whitegloss.de/hbuilds/last-source/blog-articles/`

**Import**: Über das Admin-Panel unter https://whitegloss.de/auth anmelden → Beiträge verwalten → Neuen Beitrag → Metadaten + Markdown-Content aus den Dateien übernehmen.

## Prioritäten-Empfehlung

1. **Heute**: GitHub Deploy Key hinzufügen → ich pushe die Blog-Artikel
2. **Heute**: Meta Pixel-ID mitteilen → ich aktualisiere die `.env`
3. **Diese Woche**: Google Search Console Verifikation
4. **Diese Woche**: CAPI-Token generieren
5. **Später**: Webhook für automatisches Deployment
